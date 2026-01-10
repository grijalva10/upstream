#!/usr/bin/env python3
"""
Capture Agent Run Script

Captures Claude CLI output (stream-json format) and stores in database.

Usage:
    claude -p "your prompt" --output-format stream-json | python capture_agent_run.py --agent query-builder

    # With task ID (from task queue):
    claude -p "your prompt" --output-format stream-json | python capture_agent_run.py --agent query-builder --task-id <uuid>

Environment:
    SUPABASE_URL - Supabase project URL
    SUPABASE_KEY - Supabase service role key
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional
from uuid import uuid4

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Run: pip install supabase", file=sys.stderr)
    sys.exit(1)


def get_supabase_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables required")

    return create_client(url, key)


def get_agent_definition_id(supabase: Client, agent_name: str) -> Optional[str]:
    """Look up agent definition ID by name."""
    result = supabase.table("agent_definitions").select("id").eq("name", agent_name).execute()
    if result.data:
        return result.data[0]["id"]
    return None


def capture_stream_json(stdin) -> dict:
    """
    Parse stream-json format from stdin.

    Stream-json emits one JSON object per line with types like:
    - {"type": "text", "text": "..."}
    - {"type": "tool_use", ...}
    - {"type": "result", "result": {...}}
    - {"type": "error", "error": "..."}

    Returns aggregated data with full response and token counts.
    """
    response_parts = []
    input_tokens = 0
    output_tokens = 0
    error_message = None
    status = "completed"

    for line in stdin:
        line = line.strip()
        if not line:
            continue

        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = event.get("type")

        if event_type == "text":
            response_parts.append(event.get("text", ""))

        elif event_type == "result":
            result = event.get("result", {})
            # Claude CLI reports usage in result
            usage = result.get("usage", {})
            input_tokens = usage.get("input_tokens", input_tokens)
            output_tokens = usage.get("output_tokens", output_tokens)

        elif event_type == "error":
            error_message = event.get("error", "Unknown error")
            status = "failed"

        elif event_type == "tool_use":
            # Include tool calls in response
            tool_name = event.get("name", "unknown")
            tool_input = event.get("input", {})
            response_parts.append(f"\n[Tool: {tool_name}]\n{json.dumps(tool_input, indent=2)}\n")

        elif event_type == "tool_result":
            # Include tool results
            content = event.get("content", "")
            if isinstance(content, str):
                response_parts.append(f"\n[Tool Result]\n{content[:500]}...\n" if len(content) > 500 else f"\n[Tool Result]\n{content}\n")

    return {
        "response": "".join(response_parts),
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "error_message": error_message,
        "status": status,
    }


def create_execution(
    supabase: Client,
    agent_name: str,
    prompt: Optional[str],
    result: dict,
    task_id: Optional[str] = None,
    started_at: Optional[str] = None,
) -> str:
    """Create agent_execution record and return ID."""
    agent_def_id = get_agent_definition_id(supabase, agent_name)

    execution_id = str(uuid4())
    completed_at = datetime.utcnow().isoformat()

    execution_data = {
        "id": execution_id,
        "agent_definition_id": agent_def_id,
        "agent_name": agent_name,
        "prompt": prompt,
        "response": result["response"],
        "status": result["status"],
        "error_message": result["error_message"],
        "input_tokens": result["input_tokens"],
        "output_tokens": result["output_tokens"],
        "started_at": started_at or completed_at,
        "completed_at": completed_at,
    }

    # Calculate duration if we have started_at
    if started_at:
        start = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
        end = datetime.fromisoformat(completed_at)
        execution_data["duration_ms"] = int((end - start).total_seconds() * 1000)

    supabase.table("agent_executions").insert(execution_data).execute()

    # Update task if provided
    if task_id:
        supabase.table("agent_tasks").update({
            "agent_execution_id": execution_id,
            "status": result["status"],
            "error_message": result["error_message"],
            "completed_at": completed_at,
        }).eq("id", task_id).execute()

    return execution_id


def main():
    parser = argparse.ArgumentParser(description="Capture Claude CLI output to database")
    parser.add_argument("--agent", required=True, help="Agent name (e.g., query-builder)")
    parser.add_argument("--prompt", help="Original prompt (for logging)")
    parser.add_argument("--task-id", help="Agent task UUID to update")
    parser.add_argument("--started-at", help="ISO timestamp when execution started")

    args = parser.parse_args()

    # Check if stdin has data
    if sys.stdin.isatty():
        print("Error: No input. Pipe Claude CLI output to this script.", file=sys.stderr)
        print("Example: claude -p 'prompt' --output-format stream-json | python capture_agent_run.py --agent query-builder", file=sys.stderr)
        sys.exit(1)

    started_at = args.started_at or datetime.utcnow().isoformat()

    print(f"Capturing output for agent: {args.agent}", file=sys.stderr)

    # Parse stream-json input
    result = capture_stream_json(sys.stdin)

    print(f"Status: {result['status']}", file=sys.stderr)
    print(f"Tokens: {result['input_tokens']} in / {result['output_tokens']} out", file=sys.stderr)

    # Store in database
    try:
        supabase = get_supabase_client()
        execution_id = create_execution(
            supabase,
            agent_name=args.agent,
            prompt=args.prompt,
            result=result,
            task_id=args.task_id,
            started_at=started_at,
        )
        print(f"Execution ID: {execution_id}", file=sys.stderr)

        # Output the response to stdout (for piping)
        print(result["response"])

    except Exception as e:
        print(f"Error storing execution: {e}", file=sys.stderr)
        # Still output the response even if storage fails
        print(result["response"])
        sys.exit(1)


if __name__ == "__main__":
    main()
