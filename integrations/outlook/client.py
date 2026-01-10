"""Main Outlook client wrapper."""

from typing import Optional, TYPE_CHECKING

from .exceptions import OutlookNotInstalledError, OutlookNotRunningError, COMError

if TYPE_CHECKING:
    from .email import EmailManager
    from .calendar import CalendarManager


class OutlookClient:
    """
    High-level client for interacting with Microsoft Outlook.

    Usage:
        client = OutlookClient()
        client.email.send(to="someone@example.com", subject="Hello", body="Hi!")

        # Or with context manager
        with OutlookClient() as client:
            for email in client.email.inbox.get_messages(limit=10):
                print(email.subject)
    """

    def __init__(self, lazy_connect: bool = True):
        """
        Initialize Outlook client.

        Args:
            lazy_connect: If True, defer connection until first operation.
                         If False, connect immediately.
        """
        self._app = None
        self._namespace = None
        self._email_manager: Optional["EmailManager"] = None
        self._calendar_manager: Optional["CalendarManager"] = None

        if not lazy_connect:
            self._connect()

    def _connect(self) -> None:
        """Establish connection to Outlook."""
        if self._app is not None:
            return

        try:
            import win32com.client
            import pythoncom
        except ImportError:
            raise OutlookNotInstalledError(
                "pywin32 is not installed. Install it with: pip install pywin32"
            )

        try:
            # Try to get existing Outlook instance
            try:
                self._app = win32com.client.GetActiveObject("Outlook.Application")
            except Exception:
                # Start new instance if not running
                self._app = win32com.client.Dispatch("Outlook.Application")

            self._namespace = self._app.GetNamespace("MAPI")

        except pythoncom.com_error as e:
            raise OutlookNotRunningError(
                f"Could not connect to Outlook: {e}"
            )
        except Exception as e:
            raise COMError(f"Failed to initialize Outlook: {e}", original_error=e)

    def _ensure_connected(self) -> None:
        """Ensure client is connected to Outlook."""
        if self._app is None:
            self._connect()

    @property
    def application(self):
        """Get the raw Outlook Application COM object."""
        self._ensure_connected()
        return self._app

    @property
    def namespace(self):
        """Get the MAPI Namespace COM object."""
        self._ensure_connected()
        return self._namespace

    @property
    def email(self) -> "EmailManager":
        """Get the email manager for email operations."""
        if self._email_manager is None:
            from .email import EmailManager
            self._email_manager = EmailManager(self)
        return self._email_manager

    @property
    def calendar(self) -> "CalendarManager":
        """Get the calendar manager for calendar operations."""
        if self._calendar_manager is None:
            from .calendar import CalendarManager
            self._calendar_manager = CalendarManager(self)
        return self._calendar_manager

    def get_current_user(self) -> str:
        """Get the current user's email address."""
        self._ensure_connected()
        try:
            return self._namespace.CurrentUser.Address
        except Exception:
            return ""

    def get_current_user_name(self) -> str:
        """Get the current user's display name."""
        self._ensure_connected()
        try:
            return self._namespace.CurrentUser.Name
        except Exception:
            return ""

    def quit(self) -> None:
        """Close Outlook application."""
        if self._app:
            try:
                self._app.Quit()
            except Exception:
                pass
            finally:
                self._app = None
                self._namespace = None

    def __enter__(self) -> "OutlookClient":
        """Context manager entry."""
        self._ensure_connected()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        # Don't quit Outlook on exit - let user manage that
        pass

    def __repr__(self) -> str:
        connected = "connected" if self._app else "disconnected"
        return f"<OutlookClient({connected})>"
