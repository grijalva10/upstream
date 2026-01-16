"""CoStar Database Integration - Utilities for Supabase operations."""

import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")

    return create_client(url, key)


# =============================================================================
# PARSING HELPERS
# =============================================================================

def parse_building_size(size_str: str) -> Optional[int]:
    """Parse building size string like '12,640' to integer."""
    if not size_str:
        return None
    try:
        return int(str(size_str).replace(",", "").replace(" ", ""))
    except (ValueError, AttributeError):
        return None


def parse_land_size(size_str: str) -> Optional[float]:
    """Parse land size string like '0.94' to float (acres)."""
    if not size_str:
        return None
    try:
        return float(str(size_str).replace(",", ""))
    except (ValueError, AttributeError):
        return None


def parse_year_built(year_str: str) -> Optional[int]:
    """Parse year built string, handles '1989 / 2012' format."""
    if not year_str:
        return None
    try:
        match = re.search(r'\d{4}', str(year_str))
        return int(match.group()) if match else None
    except (ValueError, AttributeError):
        return None


def _parse_date(date_str: Optional[str]) -> Optional[str]:
    """Parse date string to ISO format."""
    if not date_str:
        return None
    try:
        if "T" in date_str:
            return date_str.split("T")[0]
        # Handle MM/DD/YYYY format
        if "/" in str(date_str):
            parts = str(date_str).split("/")
            if len(parts) == 3:
                month, day, year = parts
                return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        return date_str
    except Exception:
        return None


def _parse_int(value) -> Optional[int]:
    """Parse value to integer, handling string formats."""
    if value is None:
        return None
    try:
        if isinstance(value, int):
            return value
        return int(str(value).replace(",", "").replace(" ", ""))
    except (ValueError, TypeError):
        return None


def _parse_decimal(value) -> Optional[float]:
    """Parse value to decimal/float."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        return float(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return None


def _parse_currency(value) -> Optional[float]:
    """Parse currency string like '$5,002,507' to float."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return float(value)
        # Remove currency symbols and commas
        cleaned = str(value).replace("$", "").replace(",", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return None


# =============================================================================
# AGENT EXECUTION LOGGING
# =============================================================================

def log_agent_execution(
    db: Client,
    agent_name: str,
    status: str,
    metrics: Dict,
    prompt: Optional[str] = None,
    response: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    trigger_entity_type: Optional[str] = None,
    trigger_entity_id: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> str:
    """
    Log an agent execution with metrics.

    Args:
        agent_name: Name of the agent (e.g., 'sourcing-agent')
        status: 'queued', 'running', 'completed', 'failed', 'cancelled'
        metrics: Agent-specific metrics dict (see agent_metric_definitions)
        prompt: Input prompt to agent
        response: Agent response/output
        error_message: Error if failed
        duration_ms: Execution duration in milliseconds
        input_tokens: Input token count
        output_tokens: Output token count
        trigger_entity_type: What triggered this (e.g., 'search')
        trigger_entity_id: UUID of trigger entity
        metadata: Additional metadata

    Returns:
        Execution UUID
    """
    data = {
        "agent_name": agent_name,
        "status": status,
        "metrics": metrics,
        "started_at": datetime.utcnow().isoformat(),
    }

    if status in ("completed", "failed"):
        data["completed_at"] = datetime.utcnow().isoformat()

    if prompt:
        data["prompt"] = prompt[:10000]  # Truncate if too long
    if response:
        data["response"] = response[:50000]
    if error_message:
        data["error_message"] = error_message
    if duration_ms is not None:
        data["duration_ms"] = duration_ms
    if input_tokens is not None:
        data["input_tokens"] = input_tokens
    if output_tokens is not None:
        data["output_tokens"] = output_tokens
    if trigger_entity_type:
        data["trigger_entity_type"] = trigger_entity_type
    if trigger_entity_id:
        data["trigger_entity_id"] = trigger_entity_id
    if metadata:
        data["metadata"] = metadata

    result = db.table("agent_executions").insert(data).execute()
    execution_id = result.data[0]["id"]
    logger.info(f"Logged agent execution: {agent_name} ({execution_id}) [{status}]")
    return execution_id


def update_agent_execution(
    db: Client,
    execution_id: str,
    status: Optional[str] = None,
    metrics: Optional[Dict] = None,
    response: Optional[str] = None,
    error_message: Optional[str] = None,
    duration_ms: Optional[int] = None,
) -> None:
    """Update an existing agent execution record."""
    data = {}

    if status:
        data["status"] = status
        if status in ("completed", "failed"):
            data["completed_at"] = datetime.utcnow().isoformat()
    if metrics:
        data["metrics"] = metrics
    if response:
        data["response"] = response[:50000]
    if error_message:
        data["error_message"] = error_message
    if duration_ms is not None:
        data["duration_ms"] = duration_ms

    if data:
        db.table("agent_executions").update(data).eq("id", execution_id).execute()


# =============================================================================
# SOURCING STRATEGIES
# =============================================================================

def get_sourcing_strategies(
    db: Client,
    category: Optional[str] = None,
    active_only: bool = True,
) -> List[Dict]:
    """
    Get sourcing strategies from database.

    Args:
        category: Filter by category ('hold_period', 'financial_distress', 'property_distress', 'equity')
        active_only: Only return active strategies

    Returns:
        List of strategy dicts with name, category, description, filter_template
    """
    query = db.table("sourcing_strategies").select("*")

    if active_only:
        query = query.eq("is_active", True)
    if category:
        query = query.eq("category", category)

    result = query.order("category").order("name").execute()
    return result.data or []


def get_strategy_by_name(db: Client, name: str) -> Optional[Dict]:
    """Get a specific sourcing strategy by name."""
    result = db.table("sourcing_strategies").select("*").eq("name", name).limit(1).execute()
    return result.data[0] if result.data else None
