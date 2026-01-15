#!/usr/bin/env python3
"""
Claude Agent Service - HTTP API for running Claude Code agents in headless mode.

This service wraps the AgentRunner class and provides an HTTP API for:
- Running any agent defined in .claude/agents/
- Session resume support
- Execution logging to database

Usage:
    python orchestrator/service.py [--port 8766]

API Endpoints:
    GET  /status        - Health check
    POST /run           - Run any agent (generic)
    POST /sourcing      - Run sourcing-agent (convenience)
    POST /classify      - Run response-classifier (convenience)
    POST /qualify       - Run qualify-agent (convenience)
    POST /package       - Run deal-packager (convenience)
"""

import argparse
import logging
import os
import sys
from dataclasses import asdict
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from orchestrator.agents.runner import AgentRunner, AgentResult
from orchestrator.config import get_config

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global runner instance (lazy initialized)
_runner: AgentRunner | None = None


def get_runner() -> AgentRunner:
    """Get or create the agent runner."""
    global _runner
    if _runner is None:
        _runner = AgentRunner()
    return _runner


def result_to_dict(result: AgentResult) -> dict:
    """Convert AgentResult to a JSON-serializable dict."""
    return {
        "success": result.success,
        "output": result.output,
        "session_id": result.session_id,
        "execution_id": result.execution_id,
        "error": result.error,
    }


@app.route("/status", methods=["GET"])
def status():
    """Health check endpoint."""
    config = get_config()

    # List available agents
    agents_dir = Path(config.agents_dir)
    available_agents = []
    if agents_dir.exists():
        available_agents = [
            f.stem for f in agents_dir.glob("*.md")
        ]

    return jsonify({
        "status": "running",
        "claude_path": config.claude_code_path,
        "agents_dir": str(agents_dir),
        "available_agents": available_agents,
        "dry_run": config.dry_run,
    })


@app.route("/run", methods=["POST"])
def run_agent():
    """
    Run any agent.

    Request body:
    {
        "agent": "sourcing-agent",    # Required: agent name (maps to .claude/agents/{name}.md)
        "prompt": "...",              # Required: the task prompt
        "context": {},                # Optional: context for feedback lookup
        "session_id": null,           # Optional: session ID to resume
        "max_turns": 10,              # Optional: max agent turns
        "allowed_tools": ["Read", "Write", "Bash", "Grep", "Glob"]  # Optional: allowed tools
    }

    Response:
    {
        "success": true/false,
        "output": "agent output text",
        "session_id": "...",          # For resume
        "execution_id": "...",        # For logging/tracking
        "error": null or "error message"
    }
    """
    data = request.json

    if not data:
        logger.error("No request body provided")
        return jsonify({"error": "Request body required"}), 400

    agent = data.get("agent")
    prompt = data.get("prompt")

    if not agent:
        logger.error("Missing agent field")
        return jsonify({"error": "Missing required field: agent"}), 400
    if not prompt:
        logger.error("Missing prompt field")
        return jsonify({"error": "Missing required field: prompt"}), 400

    logger.info(f"=== RUN REQUEST ===")
    logger.info(f"Agent: {agent}")
    logger.info(f"Prompt length: {len(prompt)} chars")
    logger.info(f"Max turns: {data.get('max_turns', 10)}")
    logger.info(f"Context: {data.get('context')}")

    try:
        runner = get_runner()
        logger.info(f"Claude path: {runner._claude_path}")

        result = runner.run(
            agent_name=agent,
            prompt=prompt,
            context=data.get("context"),
            session_id=data.get("session_id"),
            max_turns=data.get("max_turns", 10),
            allowed_tools=data.get("allowed_tools"),
        )

        logger.info(f"=== RUN RESULT ===")
        logger.info(f"Success: {result.success}")
        logger.info(f"Error: {result.error}")
        logger.info(f"Output length: {len(result.output) if result.output else 0} chars")
        logger.info(f"Session ID: {result.session_id}")
        logger.info(f"Execution ID: {result.execution_id}")
        if result.output:
            logger.info(f"Output preview: {result.output[:500]}...")

        return jsonify(result_to_dict(result))

    except FileNotFoundError as e:
        logger.error(f"Agent not found: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 404

    except Exception as e:
        logger.exception(f"Error running agent {agent}: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 500


@app.route("/sourcing", methods=["POST"])
def run_sourcing():
    """
    Run sourcing-agent with buyer criteria.

    Request body:
    {
        "criteria": { ... buyer criteria JSON ... },
        "context": {}  # Optional
    }
    """
    data = request.json

    if not data or "criteria" not in data:
        return jsonify({"error": "Missing required field: criteria"}), 400

    logger.info("Running sourcing-agent")

    try:
        runner = get_runner()
        result = runner.run_sourcing(
            criteria=data["criteria"],
            context=data.get("context"),
        )
        return jsonify(result_to_dict(result))

    except Exception as e:
        logger.exception(f"Error running sourcing-agent: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 500


@app.route("/classify", methods=["POST"])
def run_classifier():
    """
    Run response-classifier on an email.

    Request body:
    {
        "email": {
            "from_name": "...",
            "from_email": "...",
            "subject": "...",
            "body_text": "...",
            "matched_company_id": "...",
            "matched_property_id": "..."
        },
        "context": {}  # Optional
    }
    """
    data = request.json

    if not data or "email" not in data:
        return jsonify({"error": "Missing required field: email"}), 400

    logger.info("Running response-classifier")

    try:
        runner = get_runner()
        result = runner.run_classifier(
            email=data["email"],
            context=data.get("context"),
        )
        return jsonify(result_to_dict(result))

    except Exception as e:
        logger.exception(f"Error running response-classifier: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 500


@app.route("/qualify", methods=["POST"])
def run_qualify():
    """
    Run qualify-agent on a classified response.

    Request body:
    {
        "classification": { ... classification data ... },
        "qualification_data": { ... existing qualification data ... },
        "context": {}  # Optional
    }
    """
    data = request.json

    if not data or "classification" not in data:
        return jsonify({"error": "Missing required field: classification"}), 400

    logger.info("Running qualify-agent")

    try:
        runner = get_runner()
        result = runner.run_qualify(
            classification=data["classification"],
            qualification_data=data.get("qualification_data"),
            context=data.get("context"),
        )
        return jsonify(result_to_dict(result))

    except Exception as e:
        logger.exception(f"Error running qualify-agent: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 500


@app.route("/package", methods=["POST"])
def run_deal_packager():
    """
    Run deal-packager on qualified data.

    Request body:
    {
        "qualification_data": { ... qualified deal data ... },
        "context": {}  # Optional
    }
    """
    data = request.json

    if not data or "qualification_data" not in data:
        return jsonify({"error": "Missing required field: qualification_data"}), 400

    logger.info("Running deal-packager")

    try:
        runner = get_runner()
        result = runner.run_deal_packager(
            qualification_data=data["qualification_data"],
            context=data.get("context"),
        )
        return jsonify(result_to_dict(result))

    except Exception as e:
        logger.exception(f"Error running deal-packager: {e}")
        return jsonify({
            "success": False,
            "output": "",
            "error": str(e),
        }), 500


def main():
    parser = argparse.ArgumentParser(description="Claude Agent Service")
    parser.add_argument("--port", type=int, default=8766, help="Port to run on (default: 8766)")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host to bind to (default: 0.0.0.0)")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    config = get_config()

    logger.info(f"Starting Claude Agent Service on port {args.port}")
    logger.info(f"Claude Code path: {config.claude_code_path}")
    logger.info(f"Agents directory: {config.agents_dir}")
    logger.info(f"Dry run mode: {config.dry_run}")
    logger.info("")
    logger.info("Endpoints:")
    logger.info("  GET  /status     - Health check, list available agents")
    logger.info("  POST /run        - Run any agent (generic)")
    logger.info("  POST /sourcing   - Run sourcing-agent")
    logger.info("  POST /classify   - Run response-classifier")
    logger.info("  POST /qualify    - Run qualify-agent")
    logger.info("  POST /package    - Run deal-packager")

    app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)


if __name__ == "__main__":
    main()
