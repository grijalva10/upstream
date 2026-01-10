"""Data models for Outlook objects."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Any

from .constants import (
    Importance, Sensitivity, MailRecipientType, MeetingRecipientType,
    ResponseStatus, BusyStatus, MeetingStatus, BodyFormat
)


@dataclass
class Recipient:
    """Represents an email or meeting recipient."""
    name: str
    email: str
    type: MailRecipientType | MeetingRecipientType = MailRecipientType.TO
    response_status: Optional[ResponseStatus] = None

    def __str__(self) -> str:
        if self.name and self.name != self.email:
            return f"{self.name} <{self.email}>"
        return self.email


@dataclass
class Attachment:
    """Represents a file attachment."""
    filename: str
    size: int
    index: int
    path: Optional[str] = None
    _com_object: Any = field(default=None, repr=False)

    def save(self, path: str) -> str:
        """Save attachment to specified path."""
        if self._com_object:
            full_path = f"{path}\\{self.filename}" if not path.endswith(self.filename) else path
            self._com_object.SaveAsFile(full_path)
            return full_path
        raise ValueError("Cannot save - no COM object reference")


@dataclass
class Folder:
    """Represents an Outlook folder."""
    name: str
    full_path: str
    item_count: int
    unread_count: int
    folder_type: Optional[int] = None
    _com_object: Any = field(default=None, repr=False)


@dataclass
class Email:
    """Represents an email message."""
    subject: str
    sender_name: str
    sender_email: str
    body: str
    html_body: str
    received_time: Optional[datetime]
    sent_time: Optional[datetime]
    to: List[Recipient]
    cc: List[Recipient]
    bcc: List[Recipient]
    attachments: List[Attachment]
    importance: Importance = Importance.NORMAL
    sensitivity: Sensitivity = Sensitivity.NORMAL
    is_read: bool = False
    has_attachments: bool = False
    conversation_id: Optional[str] = None
    entry_id: Optional[str] = None
    _com_object: Any = field(default=None, repr=False)

    @property
    def sender(self) -> str:
        """Return formatted sender string."""
        if self.sender_name and self.sender_name != self.sender_email:
            return f"{self.sender_name} <{self.sender_email}>"
        return self.sender_email

    def mark_read(self) -> None:
        """Mark email as read."""
        if self._com_object:
            self._com_object.UnRead = False
            self.is_read = True

    def mark_unread(self) -> None:
        """Mark email as unread."""
        if self._com_object:
            self._com_object.UnRead = True
            self.is_read = False

    def delete(self) -> None:
        """Delete the email."""
        if self._com_object:
            self._com_object.Delete()

    def move_to(self, folder: Folder) -> None:
        """Move email to another folder."""
        if self._com_object and folder._com_object:
            self._com_object.Move(folder._com_object)


@dataclass
class Attendee:
    """Represents a meeting attendee."""
    name: str
    email: str
    type: MeetingRecipientType = MeetingRecipientType.REQUIRED
    response_status: ResponseStatus = ResponseStatus.NONE

    def __str__(self) -> str:
        if self.name and self.name != self.email:
            return f"{self.name} <{self.email}>"
        return self.email


@dataclass
class Appointment:
    """Represents a calendar appointment or meeting."""
    subject: str
    start: datetime
    end: datetime
    location: Optional[str] = None
    body: str = ""
    html_body: str = ""
    is_all_day: bool = False
    is_meeting: bool = False
    is_recurring: bool = False
    busy_status: BusyStatus = BusyStatus.BUSY
    meeting_status: MeetingStatus = MeetingStatus.NON_MEETING
    sensitivity: Sensitivity = Sensitivity.NORMAL
    organizer: Optional[str] = None
    attendees: List[Attendee] = field(default_factory=list)
    required_attendees: str = ""
    optional_attendees: str = ""
    reminder_minutes: int = 15
    reminder_set: bool = True
    entry_id: Optional[str] = None
    _com_object: Any = field(default=None, repr=False)

    @property
    def duration_minutes(self) -> int:
        """Get duration in minutes."""
        return int((self.end - self.start).total_seconds() / 60)

    def cancel(self) -> None:
        """Cancel the meeting."""
        if self._com_object and self.is_meeting:
            meeting_item = self._com_object.Respond(4, True)  # olMeetingDeclined
            if meeting_item:
                meeting_item.Send()

    def delete(self) -> None:
        """Delete the appointment."""
        if self._com_object:
            self._com_object.Delete()


@dataclass
class SearchResult:
    """Container for search results."""
    items: List[Email | Appointment]
    total_count: int
    query: str
