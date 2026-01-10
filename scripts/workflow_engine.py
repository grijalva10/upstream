#!/usr/bin/env python3
"""
Workflow Engine

Executes agent workflows by processing steps sequentially.

Usage:
    # Start a new workflow run
    python workflow_engine.py start <workflow_name> --input '{"market": "Phoenix"}'

    # Process next step of a workflow run
    python workflow_engine.py step <workflow_run_id>

    # Resume a paused workflow
    python workflow_engine.py resume <workflow_run_id>

Environment:
    SUPABASE_URL - Supabase project URL
    SUPABASE_KEY - Supabase service role key
"""

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from typing import Optional, Any
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


def resolve_template(template: str, context: dict) -> str:
    """
    Resolve {{variable}} templates in a string.

    Supports:
    - {{context.key}} - from workflow context
    - {{trigger.key}} - from trigger input
    - $.path.to.value - JSONPath-like extraction (in output_mapping)
    """
    def replacer(match):
        path = match.group(1)
        parts = path.split(".")
        value = context
        for part in parts:
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                return match.group(0)  # Keep original if not found
        return str(value) if not isinstance(value, (dict, list)) else json.dumps(value)

    return re.sub(r"\{\{([^}]+)\}\}", replacer, template)


def resolve_input_mapping(mapping: dict, context: dict) -> dict:
    """Resolve all template variables in input mapping."""
    resolved = {}
    for key, value in mapping.items():
        if isinstance(value, str):
            resolved[key] = resolve_template(value, context)
        elif isinstance(value, dict):
            resolved[key] = resolve_input_mapping(value, context)
        else:
            resolved[key] = value
    return resolved


def extract_output(response: str, output_mapping: dict) -> dict:
    """
    Extract values from response using output_mapping.

    Simple implementation - looks for JSON in response.
    """
    extracted = {}

    # Try to find JSON in response
    try:
        # Look for JSON objects in response
        json_match = re.search(r"\{[^{}]*\}", response, re.DOTALL)
        if json_match:
            response_data = json.loads(json_match.group())
        else:
            response_data = {"response": response}
    except json.JSONDecodeError:
        response_data = {"response": response}

    for key, path in output_mapping.items():
        if path.startswith("$."):
            # Simple path extraction
            parts = path[2:].split(".")
            value = response_data
            for part in parts:
                if isinstance(value, dict) and part in value:
                    value = value[part]
                else:
                    value = None
                    break
            extracted[key] = value
        else:
            extracted[key] = path

    return extracted


def start_workflow(supabase: Client, workflow_name: str, trigger_input: dict) -> str:
    """Start a new workflow run."""
    # Get workflow
    workflow = supabase.table("agent_workflows")\
        .select("*")\
        .eq("name", workflow_name)\
        .eq("is_active", True)\
        .single()\
        .execute()

    if not workflow.data:
        raise ValueError(f"Workflow not found or inactive: {workflow_name}")

    workflow_data = workflow.data

    # Create workflow run
    run_id = str(uuid4())
    context = {
        "trigger": trigger_input,
        "workflow_id": workflow_data["id"],
        "workflow_name": workflow_name,
    }

    supabase.table("agent_workflow_runs").insert({
        "id": run_id,
        "workflow_id": workflow_data["id"],
        "status": "running",
        "current_step_order": 1,
        "context": context,
        "trigger_source": json.dumps(trigger_input),
        "started_at": datetime.utcnow().isoformat(),
    }).execute()

    print(f"Started workflow run: {run_id}")
    return run_id


def process_step(supabase: Client, run_id: str) -> bool:
    """
    Process the next step of a workflow run.

    Returns True if workflow should continue, False if done/paused.
    """
    # Get workflow run
    run = supabase.table("agent_workflow_runs")\
        .select("*, agent_workflows(*)")\
        .eq("id", run_id)\
        .single()\
        .execute()

    if not run.data:
        raise ValueError(f"Workflow run not found: {run_id}")

    run_data = run.data

    if run_data["status"] not in ("running", "pending"):
        print(f"Workflow not in running state: {run_data['status']}")
        return False

    current_step_order = run_data["current_step_order"]
    context = run_data["context"]

    # Get current step
    step = supabase.table("agent_workflow_steps")\
        .select("*, agent_definitions(*)")\
        .eq("workflow_id", run_data["workflow_id"])\
        .eq("step_order", current_step_order)\
        .single()\
        .execute()

    if not step.data:
        # No more steps - complete
        supabase.table("agent_workflow_runs").update({
            "status": "completed",
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", run_id).execute()
        print("Workflow completed - no more steps")
        return False

    step_data = step.data

    print(f"Processing step {current_step_order}: {step_data['step_name']}")

    # Create step run record
    step_run_id = str(uuid4())
    supabase.table("agent_workflow_step_runs").insert({
        "id": step_run_id,
        "workflow_run_id": run_id,
        "workflow_step_id": step_data["id"],
        "status": "running",
        "started_at": datetime.utcnow().isoformat(),
    }).execute()

    try:
        step_type = step_data["step_type"]

        if step_type == "agent":
            # Run Claude agent
            result = run_agent_step(supabase, step_data, context)

        elif step_type == "wait_manual":
            # Pause for manual action
            supabase.table("agent_workflow_step_runs").update({
                "status": "waiting",
            }).eq("id", step_run_id).execute()

            supabase.table("agent_workflow_runs").update({
                "status": "paused",
                "paused_at": datetime.utcnow().isoformat(),
            }).eq("id", run_id).execute()

            message = step_data.get("input_mapping", {}).get("message", "Manual action required")
            print(f"PAUSED - {message}")
            return False

        elif step_type == "condition":
            # Evaluate condition
            result = evaluate_condition(step_data, context)

        elif step_type == "webhook":
            # Call webhook (not implemented)
            raise NotImplementedError("Webhook steps not yet implemented")

        else:
            raise ValueError(f"Unknown step type: {step_type}")

        # Step succeeded
        output_data = result.get("output", {})

        # Merge output into context
        context.update(output_data)

        supabase.table("agent_workflow_step_runs").update({
            "status": "completed",
            "output_data": output_data,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", step_run_id).execute()

        # Determine next step
        on_success = step_data.get("on_success", "next")

        if on_success == "complete":
            supabase.table("agent_workflow_runs").update({
                "status": "completed",
                "context": context,
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", run_id).execute()
            print("Workflow completed")
            return False

        elif on_success == "next":
            next_step = current_step_order + 1

        elif on_success.startswith("goto:"):
            next_step = int(on_success.split(":")[1])

        else:
            next_step = current_step_order + 1

        # Update workflow run
        supabase.table("agent_workflow_runs").update({
            "current_step_order": next_step,
            "context": context,
        }).eq("id", run_id).execute()

        return True

    except Exception as e:
        # Step failed
        error_msg = str(e)
        print(f"Step failed: {error_msg}")

        supabase.table("agent_workflow_step_runs").update({
            "status": "failed",
            "error_message": error_msg,
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", step_run_id).execute()

        on_failure = step_data.get("on_failure", "abort")

        if on_failure == "abort":
            supabase.table("agent_workflow_runs").update({
                "status": "failed",
                "error_message": error_msg,
                "completed_at": datetime.utcnow().isoformat(),
            }).eq("id", run_id).execute()
            return False

        elif on_failure == "skip":
            next_step = current_step_order + 1
            supabase.table("agent_workflow_runs").update({
                "current_step_order": next_step,
            }).eq("id", run_id).execute()
            return True

        elif on_failure == "retry":
            retry_count = step_data.get("attempt_number", 1)
            max_retries = step_data.get("max_retries", 0)
            if retry_count < max_retries:
                return True  # Retry
            else:
                supabase.table("agent_workflow_runs").update({
                    "status": "failed",
                    "error_message": f"Max retries exceeded: {error_msg}",
                }).eq("id", run_id).execute()
                return False

        return False


def run_agent_step(supabase: Client, step_data: dict, context: dict) -> dict:
    """Run an agent step using Claude CLI."""
    agent_def = step_data.get("agent_definitions", {})
    agent_name = agent_def.get("name") or step_data.get("agent_definition_id")

    if not agent_name:
        raise ValueError("Agent step missing agent definition")

    # Resolve input mapping
    input_mapping = step_data.get("input_mapping", {})
    resolved_input = resolve_input_mapping(input_mapping, context)

    # Build prompt
    prompt = resolved_input.get("prompt", json.dumps(resolved_input))

    print(f"Running agent: {agent_name}")
    print(f"Prompt: {prompt[:200]}...")

    # Run Claude CLI
    # Note: In production, you'd want to use proper subprocess management
    cmd = [
        "claude",
        "-p", prompt,
        "--output-format", "stream-json",
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=step_data.get("timeout_seconds", 300),
    )

    if result.returncode != 0:
        raise RuntimeError(f"Agent failed: {result.stderr}")

    response = result.stdout

    # Extract output
    output_mapping = step_data.get("output_mapping", {})
    output = extract_output(response, output_mapping)
    output["response"] = response

    return {"output": output}


def evaluate_condition(step_data: dict, context: dict) -> dict:
    """Evaluate a condition step."""
    condition = step_data.get("condition", {})

    field = condition.get("field", "")
    op = condition.get("op", "eq")
    value = condition.get("value")

    # Get field value from context
    field_value = context
    for part in field.split("."):
        if isinstance(field_value, dict) and part in field_value:
            field_value = field_value[part]
        else:
            field_value = None
            break

    # Evaluate condition
    if op == "eq":
        result = field_value == value
    elif op == "ne":
        result = field_value != value
    elif op == "gt":
        result = field_value > value
    elif op == "lt":
        result = field_value < value
    elif op == "contains":
        result = value in str(field_value)
    else:
        result = False

    return {"output": {"condition_result": result}}


def resume_workflow(supabase: Client, run_id: str, resume_data: Optional[dict] = None):
    """Resume a paused workflow."""
    run = supabase.table("agent_workflow_runs")\
        .select("*")\
        .eq("id", run_id)\
        .single()\
        .execute()

    if not run.data:
        raise ValueError(f"Workflow run not found: {run_id}")

    if run.data["status"] != "paused":
        raise ValueError(f"Workflow not paused: {run.data['status']}")

    # Merge resume data into context
    context = run.data["context"]
    if resume_data:
        context.update(resume_data)

    # Mark current step as completed
    step_run = supabase.table("agent_workflow_step_runs")\
        .select("*")\
        .eq("workflow_run_id", run_id)\
        .eq("status", "waiting")\
        .single()\
        .execute()

    if step_run.data:
        supabase.table("agent_workflow_step_runs").update({
            "status": "completed",
            "output_data": resume_data or {},
            "completed_at": datetime.utcnow().isoformat(),
        }).eq("id", step_run.data["id"]).execute()

    # Move to next step
    next_step = run.data["current_step_order"] + 1

    supabase.table("agent_workflow_runs").update({
        "status": "running",
        "current_step_order": next_step,
        "context": context,
        "paused_at": None,
    }).eq("id", run_id).execute()

    print(f"Resumed workflow at step {next_step}")


def main():
    parser = argparse.ArgumentParser(description="Workflow Engine")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # start command
    start_parser = subparsers.add_parser("start", help="Start a new workflow")
    start_parser.add_argument("workflow_name", help="Workflow name")
    start_parser.add_argument("--input", help="Trigger input as JSON", default="{}")

    # step command
    step_parser = subparsers.add_parser("step", help="Process next step")
    step_parser.add_argument("run_id", help="Workflow run ID")

    # resume command
    resume_parser = subparsers.add_parser("resume", help="Resume paused workflow")
    resume_parser.add_argument("run_id", help="Workflow run ID")
    resume_parser.add_argument("--data", help="Resume data as JSON", default="{}")

    # run command (start + process all steps)
    run_parser = subparsers.add_parser("run", help="Run workflow to completion")
    run_parser.add_argument("workflow_name", help="Workflow name")
    run_parser.add_argument("--input", help="Trigger input as JSON", default="{}")

    args = parser.parse_args()

    try:
        supabase = get_supabase_client()

        if args.command == "start":
            trigger_input = json.loads(args.input)
            run_id = start_workflow(supabase, args.workflow_name, trigger_input)
            print(f"Run ID: {run_id}")

        elif args.command == "step":
            process_step(supabase, args.run_id)

        elif args.command == "resume":
            resume_data = json.loads(args.data)
            resume_workflow(supabase, args.run_id, resume_data)

        elif args.command == "run":
            trigger_input = json.loads(args.input)
            run_id = start_workflow(supabase, args.workflow_name, trigger_input)

            # Process steps until done
            while process_step(supabase, run_id):
                pass

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
