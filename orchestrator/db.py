"""
Supabase database client and helpers.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

import psycopg2
from psycopg2.extras import RealDictCursor
from supabase import Client, create_client

from .config import get_config

logger = logging.getLogger(__name__)


class Database:
    """Supabase database wrapper with helper methods."""

    def __init__(self):
        config = get_config()
        self._client: Client = create_client(
            config.supabase_url,
            config.supabase_key
        )
        self._conn = None
        self._database_url = config.database_url

    @property
    def client(self) -> Client:
        """Get the raw Supabase client."""
        return self._client

    def table(self, name: str):
        """Get a table reference."""
        return self._client.table(name)

    def _get_connection(self):
        """Get or create a psycopg2 connection for raw SQL."""
        if self._conn is None or self._conn.closed:
            self._conn = psycopg2.connect(self._database_url)
            self._conn.autocommit = True
        return self._conn

    def execute(self, query: str, params: tuple = None) -> Optional[List[Dict[str, Any]]]:
        """
        Execute raw SQL query and return results as list of dicts.

        For SELECT queries, returns list of row dicts.
        For INSERT/UPDATE/DELETE, returns None.
        """
        conn = self._get_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(query, params)
                if cur.description:  # SELECT query
                    return [dict(row) for row in cur.fetchall()]
                return None
        except Exception as e:
            logger.exception(f"Database error: {e}")
            # Reconnect on error
            self._conn = None
            raise

    # =========================================================================
    # Checkpoint Settings
    # =========================================================================

    def get_checkpoint_mode(self, checkpoint: str) -> str:
        """Get the mode for a checkpoint (plan or auto)."""
        result = self.table("checkpoint_settings") \
            .select("mode") \
            .eq("checkpoint", checkpoint) \
            .maybe_single() \
            .execute()

        if result.data:
            return result.data["mode"]
        return "plan"  # Default to plan mode

    def set_checkpoint_mode(self, checkpoint: str, mode: str) -> None:
        """Set the mode for a checkpoint."""
        self.table("checkpoint_settings").upsert({
            "checkpoint": checkpoint,
            "mode": mode
        }).execute()

    # =========================================================================
    # Send Limit Tracking
    # =========================================================================

    def _get_send_count_since(self, since: datetime) -> int:
        """Get number of emails sent since a given time."""
        result = self.table("activities") \
            .select("id", count="exact") \
            .eq("activity_type", "email_sent") \
            .gte("activity_at", since.isoformat()) \
            .execute()
        return result.count or 0

    def get_hourly_send_count(self) -> int:
        """Get number of emails sent in the last hour."""
        return self._get_send_count_since(datetime.utcnow() - timedelta(hours=1))

    def get_daily_send_count(self) -> int:
        """Get number of emails sent today (UTC)."""
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        return self._get_send_count_since(today_start)

    def can_send_email(self) -> tuple[bool, str]:
        """Check if we're within send limits. Returns (can_send, reason)."""
        config = get_config()

        hourly = self.get_hourly_send_count()
        if hourly >= config.send_limits.hourly:
            return False, f"Hourly limit reached: {hourly}/{config.send_limits.hourly}"

        daily = self.get_daily_send_count()
        if daily >= config.send_limits.daily:
            return False, f"Daily limit reached: {daily}/{config.send_limits.daily}"

        return True, f"OK (hourly: {hourly}, daily: {daily})"

    # =========================================================================
    # Pending Work Queries
    # =========================================================================

    def get_pending_criteria(self) -> list[dict]:
        """Get client criteria pending query generation."""
        result = self.table("client_criteria") \
            .select("*, clients(*)") \
            .eq("status", "pending_queries") \
            .execute()
        return result.data or []

    def get_approved_queries(self) -> list[dict]:
        """Get criteria with approved queries ready for extraction."""
        result = self.table("client_criteria") \
            .select("*, clients(*)") \
            .eq("status", "approved") \
            .execute()
        return result.data or []

    def get_pending_campaigns(self) -> list[dict]:
        """Get extraction lists ready for campaign scheduling."""
        result = self.table("extraction_lists") \
            .select("*, client_criteria(*, clients(*))") \
            .eq("status", "extraction_complete") \
            .execute()
        return result.data or []

    def get_approved_campaigns(self) -> list[dict]:
        """Get campaigns approved and ready to start."""
        result = self.table("extraction_lists") \
            .select("*, client_criteria(*, clients(*))") \
            .eq("status", "campaign_approved") \
            .execute()
        return result.data or []

    def get_due_emails(self) -> list[dict]:
        """Get sequence emails due to be sent now."""
        now = datetime.utcnow().isoformat()

        result = self.table("sequence_subscriptions") \
            .select("""
                *,
                contacts(*),
                sequences(*),
                sequence_steps(*)
            """) \
            .eq("status", "active") \
            .lte("next_step_at", now) \
            .execute()

        return result.data or []

    def get_unclassified_emails(self) -> list[dict]:
        """Get synced emails that haven't been classified yet."""
        result = self.table("synced_emails") \
            .select("*") \
            .eq("direction", "inbound") \
            .is_("classification", "null") \
            .not_.is_("matched_company_id", "null") \
            .execute()
        return result.data or []

    def get_pending_approvals(self, checkpoint: Optional[str] = None) -> list[dict]:
        """Get items pending approval."""
        query = self.table("approval_queue") \
            .select("*") \
            .eq("status", "pending")

        if checkpoint:
            query = query.eq("checkpoint", checkpoint)

        result = query.order("created_at").execute()
        return result.data or []

    # =========================================================================
    # Status Updates
    # =========================================================================

    def _update_status(self, table: str, record_id: str, status: str, extra: Optional[dict] = None) -> None:
        """Update status on any table with standard timestamp."""
        data = {"status": status, "updated_at": datetime.utcnow().isoformat()}
        if extra:
            data.update(extra)
        self.table(table).update(data).eq("id", record_id).execute()

    def update_criteria_status(self, criteria_id: str, status: str) -> None:
        """Update client_criteria status."""
        self._update_status("client_criteria", criteria_id, status)

    def update_extraction_status(self, extraction_id: str, status: str) -> None:
        """Update extraction_list status."""
        self._update_status("extraction_lists", extraction_id, status)

    def update_subscription_status(
        self,
        subscription_id: str,
        status: str,
        next_step_at: Optional[datetime] = None
    ) -> None:
        """Update sequence_subscription status."""
        extra = {"next_step_at": next_step_at.isoformat()} if next_step_at else None
        self._update_status("sequence_subscriptions", subscription_id, status, extra)

    # =========================================================================
    # Agent Execution Logging
    # =========================================================================

    def log_agent_execution(
        self,
        agent_name: str,
        prompt: str,
        response: Optional[str] = None,
        status: str = "running",
        session_id: Optional[str] = None,
        context: Optional[dict] = None,
        error: Optional[str] = None
    ) -> str:
        """Log an agent execution. Returns the execution ID."""
        result = self.table("agent_executions").insert({
            "agent_name": agent_name,
            "prompt": prompt,
            "response": response,
            "status": status,
            "session_id": session_id,
            "context": context,
            "error": error,
            "started_at": datetime.utcnow().isoformat()
        }).execute()

        return result.data[0]["id"]

    def update_agent_execution(
        self,
        execution_id: str,
        response: Optional[str] = None,
        status: Optional[str] = None,
        error: Optional[str] = None,
        tokens_used: Optional[int] = None
    ) -> None:
        """Update an agent execution record."""
        data = {"updated_at": datetime.utcnow().isoformat()}

        if response is not None:
            data["response"] = response
        if status is not None:
            data["status"] = status
        if error is not None:
            data["error"] = error
        if tokens_used is not None:
            data["tokens_used"] = tokens_used

        if status in ("completed", "failed"):
            data["completed_at"] = datetime.utcnow().isoformat()

        self.table("agent_executions") \
            .update(data) \
            .eq("id", execution_id) \
            .execute()

    # =========================================================================
    # Feedback
    # =========================================================================

    def get_relevant_feedback(
        self,
        agent_name: str,
        criteria_type: Optional[str] = None,
        markets: Optional[list[str]] = None,
        limit: int = 5
    ) -> list[dict]:
        """Get relevant past feedback for an agent."""
        query = self.table("agent_feedback") \
            .select("*") \
            .eq("agent_name", agent_name) \
            .order("created_at", desc=True) \
            .limit(limit)

        if criteria_type:
            query = query.eq("criteria_type", criteria_type)

        # Note: market matching would need to use contains() for array overlap
        # For now, just get general feedback

        result = query.execute()
        return result.data or []

    def save_feedback(
        self,
        execution_id: str,
        agent_name: str,
        feedback_type: str,
        feedback_text: Optional[str] = None,
        expected_outcome: Optional[dict] = None,
        actual_outcome: Optional[dict] = None,
        adjustment_made: Optional[str] = None,
        criteria_type: Optional[str] = None,
        market_tags: Optional[list[str]] = None
    ) -> str:
        """Save feedback for an agent execution."""
        result = self.table("agent_feedback").insert({
            "agent_execution_id": execution_id,
            "agent_name": agent_name,
            "feedback_type": feedback_type,
            "feedback_text": feedback_text,
            "expected_outcome": expected_outcome,
            "actual_outcome": actual_outcome,
            "adjustment_made": adjustment_made,
            "criteria_type": criteria_type,
            "market_tags": market_tags
        }).execute()

        return result.data[0]["id"]

    # =========================================================================
    # Approval Queue
    # =========================================================================

    def queue_for_approval(
        self,
        checkpoint: str,
        data: dict,
        context: Optional[dict] = None
    ) -> str:
        """Add an item to the approval queue."""
        result = self.table("approval_queue").insert({
            "checkpoint": checkpoint,
            "data": data,
            "context": context,
            "status": "pending"
        }).execute()

        return result.data[0]["id"]

    def approve_item(self, approval_id: str) -> dict:
        """Approve an item and return its data."""
        result = self.table("approval_queue") \
            .update({
                "status": "approved",
                "approved_at": datetime.utcnow().isoformat()
            }) \
            .eq("id", approval_id) \
            .single() \
            .execute()

        return result.data

    def reject_item(
        self,
        approval_id: str,
        feedback: Optional[str] = None
    ) -> dict:
        """Reject an item with optional feedback."""
        result = self.table("approval_queue") \
            .update({
                "status": "rejected",
                "feedback": feedback,
                "rejected_at": datetime.utcnow().isoformat()
            }) \
            .eq("id", approval_id) \
            .single() \
            .execute()

        return result.data

    # =========================================================================
    # Orchestrator Status / Heartbeat
    # =========================================================================

    def update_orchestrator_status(
        self,
        is_running: bool,
        hostname: Optional[str] = None,
        pid: Optional[int] = None,
        loops_enabled: Optional[dict] = None,
        config: Optional[dict] = None
    ) -> None:
        """Update orchestrator status (called on start/stop)."""
        import socket
        import os

        data = {
            "is_running": is_running,
            "last_heartbeat": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat(),
            "hostname": hostname or socket.gethostname(),
            "pid": pid or os.getpid(),
        }

        if is_running:
            data["started_at"] = datetime.utcnow().isoformat()

        if loops_enabled is not None:
            data["loops_enabled"] = loops_enabled

        if config is not None:
            data["config"] = config

        self.table("orchestrator_status").upsert({
            "id": "main",
            **data
        }).execute()

    def send_heartbeat(self) -> None:
        """Send a heartbeat update (called periodically while running)."""
        self.table("orchestrator_status").update({
            "last_heartbeat": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", "main").execute()

    def mark_orchestrator_stopped(self) -> None:
        """Mark orchestrator as stopped."""
        self.table("orchestrator_status").update({
            "is_running": False,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", "main").execute()

    def get_orchestrator_status(self) -> Optional[dict]:
        """Get current orchestrator status."""
        result = self.table("orchestrator_status") \
            .select("*") \
            .eq("id", "main") \
            .maybe_single() \
            .execute()
        return result.data


# Global database instance
_db: Optional[Database] = None


def get_db() -> Database:
    """Get the global database instance."""
    global _db
    if _db is None:
        _db = Database()
    return _db
