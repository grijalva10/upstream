"""Outlook constants and enumerations."""

from enum import IntEnum


class FolderType(IntEnum):
    """Outlook default folder types (OlDefaultFolders)."""
    DELETED_ITEMS = 3
    OUTBOX = 4
    SENT_MAIL = 5
    INBOX = 6
    CALENDAR = 9
    CONTACTS = 10
    JOURNAL = 11
    NOTES = 12
    TASKS = 13
    DRAFTS = 16
    JUNK = 23
    SEARCH_FOLDERS = 30
    MANAGED_EMAIL = 29


class ItemType(IntEnum):
    """Outlook item types (OlItemType)."""
    MAIL = 0
    APPOINTMENT = 1
    CONTACT = 2
    TASK = 3
    JOURNAL = 4
    NOTE = 5
    POST = 6
    DISTRIBUTION_LIST = 7
    MOBILE_SMS = 11


class ObjectClass(IntEnum):
    """Outlook object classes (OlObjectClass)."""
    APPLICATION = 0
    NAMESPACE = 1
    FOLDER = 2
    RECIPIENT = 4
    ATTACHMENT = 5
    MAIL = 43
    CONTACT = 40
    APPOINTMENT = 26
    TASK = 48
    JOURNAL = 42
    NOTE = 44
    POST = 45
    MEETING_REQUEST = 53
    MEETING_CANCELLATION = 54
    MEETING_RESPONSE_NEGATIVE = 55
    MEETING_RESPONSE_POSITIVE = 56
    MEETING_RESPONSE_TENTATIVE = 57


class Importance(IntEnum):
    """Email importance levels (OlImportance)."""
    LOW = 0
    NORMAL = 1
    HIGH = 2


class Sensitivity(IntEnum):
    """Item sensitivity levels (OlSensitivity)."""
    NORMAL = 0
    PERSONAL = 1
    PRIVATE = 2
    CONFIDENTIAL = 3


class MailRecipientType(IntEnum):
    """Recipient types for email (OlMailRecipientType)."""
    TO = 1
    CC = 2
    BCC = 3


class MeetingRecipientType(IntEnum):
    """Recipient types for meetings (OlMeetingRecipientType)."""
    ORGANIZER = 0
    REQUIRED = 1
    OPTIONAL = 2
    RESOURCE = 3


class MeetingStatus(IntEnum):
    """Meeting status (OlMeetingStatus)."""
    NON_MEETING = 0
    MEETING = 1
    RECEIVED = 3
    CANCELED = 5
    RECEIVED_AND_CANCELED = 7


class MeetingResponse(IntEnum):
    """Meeting response types (OlMeetingResponse)."""
    TENTATIVE = 2
    ACCEPTED = 3
    DECLINED = 4


class ResponseStatus(IntEnum):
    """Recipient response status (OlResponseStatus)."""
    NONE = 0
    ORGANIZED = 1
    TENTATIVE = 2
    ACCEPTED = 3
    DECLINED = 4
    NOT_RESPONDED = 5


class BusyStatus(IntEnum):
    """Calendar busy status (OlBusyStatus)."""
    FREE = 0
    TENTATIVE = 1
    BUSY = 2
    OUT_OF_OFFICE = 3
    WORKING_ELSEWHERE = 4


class RecurrenceType(IntEnum):
    """Recurrence patterns (OlRecurrenceType)."""
    DAILY = 0
    WEEKLY = 1
    MONTHLY = 2
    MONTHLY_NTH = 3
    YEARLY = 5
    YEARLY_NTH = 6


class DaysOfWeek(IntEnum):
    """Days of week for recurrence (OlDaysOfWeek)."""
    SUNDAY = 1
    MONDAY = 2
    TUESDAY = 4
    WEDNESDAY = 8
    THURSDAY = 16
    FRIDAY = 32
    SATURDAY = 64


class AttachmentType(IntEnum):
    """Attachment types (OlAttachmentType)."""
    BY_VALUE = 1
    BY_REFERENCE = 4
    EMBEDDED_ITEM = 5
    OLE = 6


class BodyFormat(IntEnum):
    """Body format types (OlBodyFormat)."""
    UNSPECIFIED = 0
    PLAIN = 1
    HTML = 2
    RICH_TEXT = 3


class SaveAsType(IntEnum):
    """Save as file types (OlSaveAsType)."""
    TXT = 0
    RTF = 1
    TEMPLATE = 2
    MSG = 3
    DOC = 4
    HTML = 5
    VCAL = 7
    VCARD = 6
    ICAL = 8
    MSG_UNICODE = 9
    PDF = 10
