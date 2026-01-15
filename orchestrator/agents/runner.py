"""
Claude Code CLI headless runner.

Runs Claude Code in headless mode with multi-turn session support.
"""
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from ..config import get_config
from ..db import get_db, get_costar_lookups_cached

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
        self._claude_path = self._resolve_claude_path()

    def _resolve_claude_path(self) -> str:
        """Resolve the full path to claude CLI, handling Windows .cmd files."""
        config_path = self.config.claude_code_path

        # If it's already an absolute path, use it
        if os.path.isabs(config_path) and os.path.exists(config_path):
            return config_path

        # Try to find it with shutil.which (handles .cmd on Windows)
        resolved = shutil.which(config_path)
        if resolved:
            return resolved

        # On Windows, also try with .cmd extension
        if sys.platform == "win32":
            resolved = shutil.which(f"{config_path}.cmd")
            if resolved:
                return resolved

        # Fallback to config value
        return config_path

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
        context: Optional[dict] = None,
        include_agent_definition: bool = True
    ) -> str:
        """Build the full prompt with optional agent definition and feedback injection."""
        # Get agent system prompt (can skip if Claude already has it loaded)
        agent_prompt = self._load_agent_prompt(agent_name) if include_agent_definition else ""

        # Get relevant feedback (skip DB call if not needed)
        feedback = []
        if context:
            feedback = self.db.get_relevant_feedback(
                agent_name=agent_name,
                criteria_type=context.get("criteria_type") if context else None,
                markets=context.get("markets") if context else None,
                limit=3  # Reduced from 5
            )

        # Format feedback section (skip if empty)
        feedback_section = ""
        if feedback:
            feedback_section = f"""
---

## LEARNINGS FROM PAST RUNS (APPLY THESE)
{self._format_feedback(feedback)}
"""

        # Get CoStar lookups for agents that need them
        lookups_section = ""
        if agent_name in ("sourcing-agent",):
            lookups_section = self._format_costar_lookups()

        # Build full prompt (streamlined - skip empty sections)
        parts = [f"You are operating as: {agent_name}"]

        if agent_prompt:
            parts.append(agent_prompt)

        if lookups_section:
            parts.append(lookups_section)

        if feedback_section:
            parts.append(feedback_section)

        parts.append(f"## YOUR TASK\n{task_prompt}")

        return "\n\n---\n\n".join(parts)

    def _format_costar_lookups(self) -> str:
        """Format CoStar lookups as a section for the agent prompt."""
        try:
            lookups = get_costar_lookups_cached()
            if not lookups:
                logger.warning("No CoStar lookups found in database")
                return ""

            sections = ["## COSTAR API REFERENCE DATA\n\nUse these exact IDs in your query payloads. Do NOT read reference files - use this data."]

            # Markets - format as name: ID pairs
            if "markets" in lookups:
                markets = lookups["markets"]
                sections.append(f"### Markets ({len(markets)} total)\n```json\n{json.dumps(markets, indent=2)}\n```")

            # Property Types
            if "property_types" in lookups:
                sections.append(f"### Property Types\n```json\n{json.dumps(lookups['property_types'], indent=2)}\n```")

            # Owner Types
            if "owner_types" in lookups:
                sections.append(f"### Owner Types\n```json\n{json.dumps(lookups['owner_types'], indent=2)}\n```")

            # Loan Filters
            if "loan_filters" in lookups:
                sections.append(f"### Loan Filters (for distress queries)\n```json\n{json.dumps(lookups['loan_filters'], indent=2)}\n```")

            # Construction Status
            if "construction_status" in lookups:
                sections.append(f"### Construction Status\n```json\n{json.dumps(lookups['construction_status'], indent=2)}\n```")

            # Building Class
            if "building_class" in lookups:
                sections.append(f"### Building Class\n```json\n{json.dumps(lookups['building_class'], indent=2)}\n```")

            # Tenancy
            if "tenancy" in lookups:
                sections.append(f"### Tenancy\n```json\n{json.dumps(lookups['tenancy'], indent=2)}\n```")

            return "\n\n".join(sections)

        except Exception as e:
            logger.exception(f"Error formatting CoStar lookups: {e}")
            return ""

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

        # Run in the project directory
        try:
            logger.info(f"Running agent {agent_name} (execution_id={execution_id})")

            if config.dry_run:
                logger.info(f"[DRY RUN] Would run: {self._claude_path} --output-format json --max-turns {max_turns}")
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

            # Write prompt to temp file to avoid Windows command line length limits
            # Then pipe it to Claude CLI using shell
            logger.info(f"Working dir: {config.project_root}")
            logger.info(f"Prompt length: {len(full_prompt)} chars")

            # Create temp file with prompt
            with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False, encoding='utf-8') as f:
                f.write(full_prompt)
                prompt_file = f.name

            try:
                # Use shell to pipe the prompt file content to Claude
                if sys.platform == "win32":
                    shell_cmd = f'type "{prompt_file}" | {self._claude_path} --output-format json --max-turns {max_turns}'
                    if session_id:
                        shell_cmd += f' --resume {session_id}'
                    if allowed_tools:
                        shell_cmd += f' --allowedTools {",".join(allowed_tools)}'
                else:
                    shell_cmd = f'cat "{prompt_file}" | {self._claude_path} --output-format json --max-turns {max_turns}'
                    if session_id:
                        shell_cmd += f' --resume {session_id}'
                    if allowed_tools:
                        shell_cmd += f' --allowedTools {",".join(allowed_tools)}'

                logger.info(f"Shell command: {shell_cmd}")

                process = subprocess.run(
                    shell_cmd,
                    cwd=config.project_root,
                    capture_output=True,
                    shell=True,
                    timeout=config.timeouts.agent_execution
                )
            finally:
                # Clean up temp file
                try:
                    os.unlink(prompt_file)
                except Exception:
                    pass

            # Parse JSON output (decode from bytes since we used binary mode for UTF-8 input)
            output = process.stdout.decode('utf-8', errors='replace')
            stderr = process.stderr.decode('utf-8', errors='replace')

            logger.info(f"Return code: {process.returncode}")
            logger.info(f"Stdout length: {len(output)} chars")
            logger.info(f"Stderr length: {len(stderr)} chars")
            if stderr:
                logger.warning(f"Stderr: {stderr[:500]}")

            try:
                output_json = json.loads(output)
                result_text = output_json.get("result", output)
                new_session_id = output_json.get("session_id")
                logger.info(f"Parsed JSON - type: {output_json.get('type')}, subtype: {output_json.get('subtype')}")
                logger.info(f"Result text length: {len(result_text) if result_text else 0}")
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON output: {e}")
                logger.warning(f"Raw output preview: {output[:500]}")
                result_text = output
                new_session_id = None

            if process.returncode != 0:
                error_msg = stderr or f"Exit code {process.returncode}"
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
