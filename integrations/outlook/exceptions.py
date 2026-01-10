"""Custom exceptions for Outlook API wrapper."""


class OutlookError(Exception):
    """Base exception for Outlook API errors."""
    pass


class OutlookNotRunningError(OutlookError):
    """Raised when Outlook is not running or cannot be started."""
    def __init__(self, message: str = "Outlook is not running and could not be started"):
        super().__init__(message)


class OutlookNotInstalledError(OutlookError):
    """Raised when Outlook is not installed on the system."""
    def __init__(self, message: str = "Microsoft Outlook is not installed"):
        super().__init__(message)


class ConnectionError(OutlookError):
    """Raised when connection to Outlook fails."""
    def __init__(self, message: str = "Failed to connect to Outlook"):
        super().__init__(message)


class FolderNotFoundError(OutlookError):
    """Raised when a folder cannot be found."""
    def __init__(self, folder_name: str):
        super().__init__(f"Folder not found: {folder_name}")
        self.folder_name = folder_name


class ItemNotFoundError(OutlookError):
    """Raised when an item cannot be found."""
    def __init__(self, item_id: str = None, message: str = None):
        msg = message or f"Item not found: {item_id}" if item_id else "Item not found"
        super().__init__(msg)
        self.item_id = item_id


class AttachmentError(OutlookError):
    """Raised when there's an error with attachments."""
    def __init__(self, message: str = "Attachment error"):
        super().__init__(message)


class RecipientError(OutlookError):
    """Raised when there's an error with recipients."""
    def __init__(self, message: str = "Invalid or unresolvable recipient"):
        super().__init__(message)


class SendError(OutlookError):
    """Raised when sending an email fails."""
    def __init__(self, message: str = "Failed to send email"):
        super().__init__(message)


class CalendarError(OutlookError):
    """Raised for calendar-related errors."""
    def __init__(self, message: str = "Calendar operation failed"):
        super().__init__(message)


class MeetingError(OutlookError):
    """Raised for meeting-related errors."""
    def __init__(self, message: str = "Meeting operation failed"):
        super().__init__(message)


class SecurityError(OutlookError):
    """Raised when Outlook blocks an operation due to security settings."""
    def __init__(self, message: str = "Operation blocked by Outlook security settings"):
        super().__init__(message)


class COMError(OutlookError):
    """Raised when a COM operation fails."""
    def __init__(self, message: str = "COM operation failed", original_error: Exception = None):
        super().__init__(message)
        self.original_error = original_error
