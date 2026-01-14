"""
Orchestrator configuration settings.
"""
import os
from dataclasses import dataclass, field


@dataclass
class SendLimits:
    """Email send rate limits to prevent spam flags."""
    daily: int = 10_000
    hourly: int = 1_000


@dataclass
class Timeouts:
    """Timeout settings in seconds."""
    agent_execution: int = 300  # 5 minutes per agent run
    extraction: int = 600  # 10 minutes for CoStar extraction
    email_send: int = 30  # 30 seconds per email


@dataclass
class PollingIntervals:
    """Polling intervals in seconds."""
    main_loop: int = 10  # Check for work every 10s
    email_sync: int = 60  # Sync emails every 60s


@dataclass
class SendWindow:
    """Email send window (business hours)."""
    start_hour: int = 9  # 9am
    end_hour: int = 17  # 5pm
    timezone: str = "America/Los_Angeles"
    weekdays_only: bool = True


@dataclass
class EmailSpacing:
    """Email spacing settings for drip campaigns."""
    min_delay_seconds: int = 30  # Minimum delay between emails
    max_delay_seconds: int = 90  # Maximum delay between emails
    batch_size: int = 50  # Pause after this many emails
    batch_pause_minutes: int = 5  # Pause duration between batches


@dataclass
class LoopIntervals:
    """Loop intervals in seconds."""
    send_loop: int = 30  # Check for due emails every 30s
    response_loop: int = 300  # Sync/classify every 5 minutes


@dataclass
class Config:
    """Main orchestrator configuration."""

    # Supabase connection
    supabase_url: str = field(
        default_factory=lambda: os.getenv(
            "SUPABASE_URL",
            "http://127.0.0.1:55321"
        )
    )
    supabase_key: str = field(
        default_factory=lambda: os.getenv(
            "SUPABASE_SERVICE_KEY",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
        )
    )

    # Database connection string (for direct psycopg2 access if needed)
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@127.0.0.1:55322/postgres"
        )
    )

    # Rate limits
    send_limits: SendLimits = field(default_factory=SendLimits)

    # Timeouts
    timeouts: Timeouts = field(default_factory=Timeouts)

    # Polling
    polling: PollingIntervals = field(default_factory=PollingIntervals)

    # Send window
    send_window: SendWindow = field(default_factory=SendWindow)

    # Email spacing
    email_spacing: EmailSpacing = field(default_factory=EmailSpacing)

    # Loop intervals
    loop_intervals: LoopIntervals = field(default_factory=LoopIntervals)

    # Dry run mode (no actual sends/extractions)
    dry_run: bool = field(
        default_factory=lambda: os.getenv("DRY_RUN", "false").lower() == "true"
    )

    # Claude Code path
    claude_code_path: str = field(
        default_factory=lambda: os.getenv("CLAUDE_CODE_PATH", "claude")
    )

    # Agent definitions directory
    agents_dir: str = field(
        default_factory=lambda: os.getenv(
            "AGENTS_DIR",
            os.path.join(os.path.dirname(__file__), "..", ".claude", "agents")
        )
    )

    # Project root for Claude Code working directory
    project_root: str = field(
        default_factory=lambda: os.getenv(
            "PROJECT_ROOT",
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
    )


# Global config instance
config = Config()


def get_config() -> Config:
    """Get the global config instance."""
    return config
