"""
Outlook API - A Pythonic wrapper for Microsoft Outlook COM objects.

This library provides a high-level, easy-to-use interface for interacting
with Microsoft Outlook on Windows systems.

Basic Usage:
    from integrations.outlook import OutlookClient

    client = OutlookClient()

    # Send an email
    client.email.send(
        to="someone@example.com",
        subject="Hello",
        body="Hi there!"
    )

    # Read inbox
    for email in client.email.inbox.get_messages(limit=10):
        print(f"{email.sender}: {email.subject}")

    # Create a meeting
    from datetime import datetime, timedelta
    client.calendar.create_meeting(
        subject="Team Sync",
        start=datetime.now() + timedelta(hours=1),
        end=datetime.now() + timedelta(hours=2),
        attendees=["alice@example.com", "bob@example.com"]
    )

Requirements:
    - Windows OS
    - Microsoft Outlook installed
    - pywin32 package (pip install pywin32)
"""

from .client import OutlookClient
from .email import EmailManager, FolderAccessor
from .calendar import CalendarManager
from .models import Email, Appointment, Recipient, Attendee, Attachment, Folder
from .constants import (
    FolderType,
    ItemType,
    Importance,
    Sensitivity,
    MailRecipientType,
    MeetingRecipientType,
    MeetingStatus,
    MeetingResponse,
    ResponseStatus,
    BusyStatus,
    RecurrenceType,
    BodyFormat,
)
from .exceptions import (
    OutlookError,
    OutlookNotRunningError,
    OutlookNotInstalledError,
    ConnectionError,
    FolderNotFoundError,
    ItemNotFoundError,
    AttachmentError,
    RecipientError,
    SendError,
    CalendarError,
    MeetingError,
    SecurityError,
    COMError,
)

__version__ = "1.0.0"
__author__ = "Upstream Sourcing Engine"

__all__ = [
    # Main client
    "OutlookClient",
    # Managers
    "EmailManager",
    "CalendarManager",
    "FolderAccessor",
    # Models
    "Email",
    "Appointment",
    "Recipient",
    "Attendee",
    "Attachment",
    "Folder",
    # Constants
    "FolderType",
    "ItemType",
    "Importance",
    "Sensitivity",
    "MailRecipientType",
    "MeetingRecipientType",
    "MeetingStatus",
    "MeetingResponse",
    "ResponseStatus",
    "BusyStatus",
    "RecurrenceType",
    "BodyFormat",
    # Exceptions
    "OutlookError",
    "OutlookNotRunningError",
    "OutlookNotInstalledError",
    "ConnectionError",
    "FolderNotFoundError",
    "ItemNotFoundError",
    "AttachmentError",
    "RecipientError",
    "SendError",
    "CalendarError",
    "MeetingError",
    "SecurityError",
    "COMError",
]
