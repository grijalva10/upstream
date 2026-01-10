"""Utility functions for Outlook API wrapper."""

from datetime import datetime
from typing import Any, List, Optional
import os


def pywintypes_to_datetime(pytime: Any) -> Optional[datetime]:
    """Convert pywintypes.datetime to Python datetime."""
    if pytime is None:
        return None
    try:
        # pywintypes datetime objects can be converted directly
        return datetime(
            year=pytime.year,
            month=pytime.month,
            day=pytime.day,
            hour=pytime.hour,
            minute=pytime.minute,
            second=pytime.second
        )
    except (AttributeError, TypeError):
        return None


def datetime_to_pytime(dt: datetime) -> Any:
    """Convert Python datetime to format suitable for Outlook COM."""
    # Outlook COM accepts Python datetime directly
    return dt


def parse_recipients(recipients_str: str) -> List[str]:
    """Parse a semicolon-separated recipient string into a list of emails."""
    if not recipients_str:
        return []
    return [r.strip() for r in recipients_str.split(";") if r.strip()]


def format_recipients(recipients: List[str]) -> str:
    """Format a list of emails into semicolon-separated string for Outlook."""
    return "; ".join(recipients)


def safe_get_property(com_object: Any, property_name: str, default: Any = None) -> Any:
    """Safely get a property from a COM object."""
    try:
        return getattr(com_object, property_name, default)
    except Exception:
        return default


def get_smtp_address(recipient: Any) -> str:
    """Extract SMTP email address from a Recipient COM object."""
    try:
        # Try direct SMTP address first
        if hasattr(recipient, "Address") and "@" in str(recipient.Address):
            return recipient.Address

        # Try AddressEntry for Exchange addresses
        if hasattr(recipient, "AddressEntry"):
            entry = recipient.AddressEntry
            if hasattr(entry, "GetExchangeUser"):
                exchange_user = entry.GetExchangeUser()
                if exchange_user:
                    return exchange_user.PrimarySmtpAddress
            if hasattr(entry, "GetExchangeDistributionList"):
                dist_list = entry.GetExchangeDistributionList()
                if dist_list:
                    return dist_list.PrimarySmtpAddress
            # Fallback to address property
            if hasattr(entry, "Address"):
                return entry.Address

        return recipient.Address if hasattr(recipient, "Address") else ""
    except Exception:
        return ""


def validate_email(email: str) -> bool:
    """Basic email validation."""
    if not email or not isinstance(email, str):
        return False
    return "@" in email and "." in email.split("@")[-1]


def normalize_path(path: str) -> str:
    """Normalize a file path for the current OS."""
    return os.path.normpath(os.path.expanduser(path))


def ensure_list(value: Any) -> List:
    """Ensure value is a list."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, (list, tuple)):
        return list(value)
    return [value]


def truncate_string(s: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate a string to max_length, adding suffix if truncated."""
    if not s or len(s) <= max_length:
        return s
    return s[:max_length - len(suffix)] + suffix
