"""
Claude Code CLI headless runner.

Runs Claude Code in headless mode with multi-turn session support.
"""
import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..config import get_config
from ..db import get_db

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """Result from an agent execution."""
    success: bool
    output: str
    session_id: Optional[str] = None
    error: Optional[str] = None
    execution_id: Optional[str] = None


class AgentRunner:
    """
    Runs Claude Code agents in headless mode.

    Supports:
    - Single-turn execution
    - Multi-turn sessions with resume
    - Feedback injection from past runs
    - Execution logging
    """

    def __init__(self):
        self.config = get_config()
        self.db = get_db()
        self._agent_prompts: dict[str, str] = {}

    def _load_agent_prompt(self, agent_name: str) -> str:
        """Load agent prompt from .claude/agents/ directory."""
        if agent_name in self._agent_prompts:
            return self._agent_prompts[agent_name]

        agent_file = Path(self.config.agents_dir) / f"{agent_name}.md"
        if not agent_file.exists():
            raise FileNotFoundError(f"Agent definition not found: {agent_file}")

        content = agent_file.read_text(encoding="utf-8")

        # Strip YAML frontmatter if present
        if content.startswith("---"):
            end_idx = content.find("---", 3)
            if end_idx != -1:
                content = content[end_idx + 3:].strip()

        self._agent_prompts[agent_name] = content
        return content

    def _format_feedback(self, feedback: list[dict]) -> str:
        """Format feedback entries into a readable string."""
        lines = []
        for f in feedback:
            line = f"- {f.get('feedback_text', 'No feedback text')}"
            if f.get("adjustment_made"):
                line += f" -> {f['adjustment_made']}"
            outcome = f.get("actual_outcome")
            if isinstance(outcome, dict) and "summary" in outcome:
                line += f" (result: {outcome['summary']})"
            lines.append(line)
        return "\n".join(lines)

    def _build_prompt_with_feedback(
        self,
        agent_name: str,
        task_prompt: str,
        context: Optional[dict] = None
    ) -> str:
        """Build the full prompt with agent definition and feedback injection."""
        # Get agent system prompt
        agent_prompt = self._load_agent_prompt(agent_name)

        # Get relevant feedback
        feedback = self.db.get_relevant_feedback(
            agent_name=agent_name,
            criteria_type=context.get("criteria_type") if context else None,
            markets=context.get("markets") if context else None,
            limit=5
        )

        # Format feedback
        feedback_section = self._format_feedback(feedback) if feedback else "No prior feedback for this type of task."

        # Build full prompt
        full_prompt = f"""You are operating as: {agent_name}

{agent_prompt}

---

## LEARNINGS FROM PAST RUNS (APPLY THESE)
{feedback_section}

---

## YOUR TASK
{task_prompt}
"""
        return full_prompt

    def run(
        self,
        agent_name: str,
        prompt: str,
        context: Optional[dict] = None,
        session_id: Optional[str] = None,
        max_turns: int = 10,
        allowed_tools: Optional[list[str]] = None
    ) -> AgentResult:
        """
        Run an agent with the given prompt.

        Args:
            agent_name: Name of the agent (matches .claude/agents/{name}.md)
            prompt: The task prompt for the agent
            context: Optional context dict (criteria_type, markets, etc.)
            session_id: Optional session ID to resume a multi-turn conversation
            max_turns: Maximum number of turns (default 10)
            allowed_tools: List of allowed tools (default all)

        Returns:
            AgentResult with success, output, and session_id for resume
        """
        config = self.config

        # Build the full prompt with feedback injection
        if session_id:
            # For resume, just send the new prompt
            full_prompt = prompt
        else:
            # For new sessions, include agent definition and feedback
            full_prompt = self._build_prompt_with_feedback(
                agent_name, prompt, context
            )

        # Log the execution
        execution_id = self.db.log_agent_execution(
            agent_name=agent_name,
            prompt=full_prompt,
            session_id=session_id,
            context=context,
            status="running"
        )

        # Build Claude Code command
        cmd = [
            config.claude_code_path,
            "-p", full_prompt,
            "--output-format", "json",
            "--max-turns", str(max_turns),
        ]

        if session_id:
            cmd.extend(["--resume", session_id])

        if allowed_tools:
            cmd.extend(["--allowedTools", ",".join(allowed_tools)])

        # Run in the project directory
        try:
            logger.info(f"Running agent {agent_name} (execution_id={execution_id})")

            if config.dry_run:
                logger.info(f"[DRY RUN] Would run: {' '.join(cmd)}")
                result = AgentResult(
                    success=True,
                    output="[DRY RUN] Agent execution skipped",
                    execution_id=execution_id
                )
                self.db.update_agent_execution(
                    execution_id,
                    response=result.output,
                    status="completed"
                )
                return result

            process = subprocess.run(
                cmd,
                cwd=config.project_root,
                capture_output=True,
                text=True,
                timeout=config.timeouts.agent_execution
            )

            # Parse JSON output
            output = process.stdout
            try:
                output_json = json.loads(output)
                result_text = output_json.get("result", output)
                new_session_id = output_json.get("session_id")
            except json.JSONDecodeError:
                result_text = output
                new_session_id = None

            if process.returncode != 0:
                error_msg = process.stderr or f"Exit code {process.returncode}"
                logger.error(f"Agent {agent_name} failed: {error_msg}")

                self.db.update_agent_execution(
                    execution_id,
                    response=output,
                    status="failed",
                    error=error_msg
                )

                return AgentResult(
                    success=False,
                    output=output,
                    error=error_msg,
                    execution_id=execution_id,
                    session_id=new_session_id
                )

            logger.info(f"Agent {agent_name} completed successfully")

            self.db.update_agent_execution(
                execution_id,
                response=result_text,
                status="completed"
            )

            return AgentResult(
                success=True,
                output=result_text,
                execution_id=execution_id,
                session_id=new_session_id or session_id
            )

        except subprocess.TimeoutExpired:
            error_msg = f"Agent execution timed out after {config.timeouts.agent_execution}s"
            logger.error(f"Agent {agent_name} timed out")

            self.db.update_agent_execution(
                execution_id,
                status="failed",
                error=error_msg
            )

            return AgentResult(
                success=False,
                output="",
                error=error_msg,
                execution_id=execution_id
            )

        except Exception as e:
            error_msg = str(e)
            logger.exception(f"Agent {agent_name} error: {e}")

            self.db.update_agent_execution(
                execution_id,
                status="failed",
                error=error_msg
            )

            return AgentResult(
                success=False,
                output="",
                error=error_msg,
                execution_id=execution_id
            )

    def run_sourcing(
        self,
        criteria: dict,
        context: Optional[dict] = None
    ) -> AgentResult:
        """Run the sourcing agent with buyer criteria."""
        prompt = f"""Analyze this buyer criteria and generate CoStar search queries:

```json
{json.dumps(criteria, indent=2)}
```

Generate:
1. 1-5 CoStar API payloads targeting this criteria
2. A strategy summary explaining the approach

Output the payloads as JSON and explain your strategy.
"""
        return self.run(
            "sourcing-agent",
            prompt,
            context=context or {"criteria_type": criteria.get("type")},
            allowed_tools=["Read", "Grep", "Glob", "Write", "Bash"]
        )

    def run_classifier(
        self,
        email: dict,
        context: Optional[dict] = None
    ) -> AgentResult:
        """Run the response classifier on an email."""
        prompt = f"""Classify this email response:

From: {email.get('from_name', '')} <{email.get('from_email', '')}>
Subject: {email.get('subject', '')}

{email.get('body_text', '')}

---

Company ID: {email.get('matched_company_id', 'unknown')}
Property ID: {email.get('matched_property_id', 'unknown')}

Classify into one of: interested, pricing_given, question, referral, broker_redirect, soft_pass, hard_pass, bounce

Extract any pricing data if present.
"""
        return self.run(
            "response-classifier",
            prompt,
            context=context,
            allowed_tools=["Read", "Bash"]
        )

    def run_qualify(
        self,
        classification: dict,
        qualification_data: Optional[dict] = None,
        context: Optional[dict] = None
    ) -> AgentResult:
        """Run the qualify agent on a classified response."""
        prompt = f"""Process this classified email response:

Classification:
```json
{json.dumps(classification, indent=2)}
```

Existing Qualification Data:
```json
{json.dumps(qualification_data or {}, indent=2)}
```

Generate an appropriate follow-up email or escalate to a call if needed.
"""
        return self.run(
            "qualify-agent",
            prompt,
            context=context,
            allowed_tools=["Read", "Bash"]
        )

    def run_deal_packager(
        self,
        qualification_data: dict,
        context: Optional[dict] = None
    ) -> AgentResult:
        """Run the deal packager on qualified data."""
        prompt = f"""Package this qualified deal:

```json
{json.dumps(qualification_data, indent=2)}
```

Create a deal package and find matching clients to notify.
"""
        return self.run(
            "deal-packager",
            prompt,
            context=context,
            allowed_tools=["Read", "Write", "Bash"]
        )


# Global runner instance
_runner: Optional[AgentRunner] = None


def get_runner() -> AgentRunner:
    """Get the global agent runner instance."""
    global _runner
    if _runner is None:
        _runner = AgentRunner()
    return _runner
