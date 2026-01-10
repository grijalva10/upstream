"""Email management module."""

from datetime import datetime
from pathlib import Path
from typing import List, Optional, Iterator, TYPE_CHECKING, Union

from .constants import (
    FolderType, ItemType, Importance, MailRecipientType, BodyFormat
)
from .exceptions import (
    FolderNotFoundError, SendError, RecipientError, AttachmentError, COMError
)
from .models import Email, Folder, Recipient, Attachment
from .utils import (
    pywintypes_to_datetime, safe_get_property, get_smtp_address,
    ensure_list, normalize_path
)

if TYPE_CHECKING:
    from .client import OutlookClient


class FolderAccessor:
    """Provides access to a specific folder's emails."""

    def __init__(self, email_manager: "EmailManager", folder_type: FolderType):
        self._manager = email_manager
        self._folder_type = folder_type
        self._com_folder = None

    def _get_folder(self):
        """Get the COM folder object."""
        if self._com_folder is None:
            namespace = self._manager._client.namespace
            self._com_folder = namespace.GetDefaultFolder(self._folder_type)
        return self._com_folder

    def get_messages(
        self,
        limit: int = 50,
        unread_only: bool = False,
        since: Optional[datetime] = None
    ) -> List[Email]:
        """
        Get messages from this folder.

        Args:
            limit: Maximum number of messages to return
            unread_only: If True, only return unread messages
            since: Only return messages received after this datetime

        Returns:
            List of Email objects
        """
        folder = self._get_folder()
        items = folder.Items
        items.Sort("[ReceivedTime]", True)  # Sort descending

        emails = []
        count = 0

        for item in items:
            if count >= limit:
                break

            try:
                # Check class to ensure it's a mail item
                if safe_get_property(item, "Class") != 43:  # olMail
                    continue

                if unread_only and not item.UnRead:
                    continue

                received = pywintypes_to_datetime(safe_get_property(item, "ReceivedTime"))
                if since and received and received < since:
                    continue

                emails.append(self._manager._parse_mail_item(item))
                count += 1

            except Exception:
                continue

        return emails

    def __iter__(self) -> Iterator[Email]:
        """Iterate over messages in this folder."""
        folder = self._get_folder()
        items = folder.Items
        items.Sort("[ReceivedTime]", True)

        for item in items:
            try:
                if safe_get_property(item, "Class") == 43:
                    yield self._manager._parse_mail_item(item)
            except Exception:
                continue

    @property
    def count(self) -> int:
        """Get total item count in folder."""
        return self._get_folder().Items.Count

    @property
    def unread_count(self) -> int:
        """Get unread item count in folder."""
        return self._get_folder().UnReadItemCount


class EmailManager:
    """Manages email operations."""

    def __init__(self, client: "OutlookClient"):
        self._client = client
        self._inbox: Optional[FolderAccessor] = None
        self._sent: Optional[FolderAccessor] = None
        self._drafts: Optional[FolderAccessor] = None
        self._outbox: Optional[FolderAccessor] = None

    @property
    def inbox(self) -> FolderAccessor:
        """Access inbox folder."""
        if self._inbox is None:
            self._inbox = FolderAccessor(self, FolderType.INBOX)
        return self._inbox

    @property
    def sent(self) -> FolderAccessor:
        """Access sent items folder."""
        if self._sent is None:
            self._sent = FolderAccessor(self, FolderType.SENT_MAIL)
        return self._sent

    @property
    def drafts(self) -> FolderAccessor:
        """Access drafts folder."""
        if self._drafts is None:
            self._drafts = FolderAccessor(self, FolderType.DRAFTS)
        return self._drafts

    @property
    def outbox(self) -> FolderAccessor:
        """Access outbox folder."""
        if self._outbox is None:
            self._outbox = FolderAccessor(self, FolderType.OUTBOX)
        return self._outbox

    def send(
        self,
        to: Union[str, List[str]],
        subject: str,
        body: str,
        cc: Union[str, List[str], None] = None,
        bcc: Union[str, List[str], None] = None,
        attachments: Union[str, List[str], None] = None,
        html: bool = False,
        importance: Importance = Importance.NORMAL,
        request_read_receipt: bool = False,
        request_delivery_receipt: bool = False
    ) -> None:
        """
        Send an email.

        Args:
            to: Recipient email(s)
            subject: Email subject
            body: Email body (plain text or HTML)
            cc: CC recipient(s)
            bcc: BCC recipient(s)
            attachments: Path(s) to files to attach
            html: If True, body is treated as HTML
            importance: Email importance level
            request_read_receipt: Request read receipt
            request_delivery_receipt: Request delivery receipt

        Raises:
            SendError: If sending fails
            RecipientError: If recipients are invalid
            AttachmentError: If attachments cannot be added
        """
        self._client._ensure_connected()

        try:
            mail = self._client.application.CreateItem(ItemType.MAIL)

            # Set recipients
            mail.To = "; ".join(ensure_list(to))
            if cc:
                mail.CC = "; ".join(ensure_list(cc))
            if bcc:
                mail.BCC = "; ".join(ensure_list(bcc))

            # Set content
            mail.Subject = subject
            if html:
                mail.HTMLBody = body
                mail.BodyFormat = BodyFormat.HTML
            else:
                mail.Body = body
                mail.BodyFormat = BodyFormat.PLAIN

            # Set properties
            mail.Importance = importance

            if request_read_receipt:
                mail.ReadReceiptRequested = True
            if request_delivery_receipt:
                mail.OriginatorDeliveryReportRequested = True

            # Add attachments
            if attachments:
                for attachment_path in ensure_list(attachments):
                    path = normalize_path(attachment_path)
                    if not Path(path).exists():
                        raise AttachmentError(f"Attachment not found: {path}")
                    try:
                        mail.Attachments.Add(path)
                    except Exception as e:
                        raise AttachmentError(f"Failed to attach {path}: {e}")

            # Send
            mail.Send()

        except (SendError, AttachmentError):
            raise
        except Exception as e:
            raise SendError(f"Failed to send email: {e}")

    def create_draft(
        self,
        to: Union[str, List[str]],
        subject: str,
        body: str,
        cc: Union[str, List[str], None] = None,
        bcc: Union[str, List[str], None] = None,
        attachments: Union[str, List[str], None] = None,
        html: bool = False
    ) -> Email:
        """
        Create a draft email without sending.

        Returns:
            Email object representing the draft
        """
        self._client._ensure_connected()

        mail = self._client.application.CreateItem(ItemType.MAIL)

        mail.To = "; ".join(ensure_list(to))
        if cc:
            mail.CC = "; ".join(ensure_list(cc))
        if bcc:
            mail.BCC = "; ".join(ensure_list(bcc))

        mail.Subject = subject
        if html:
            mail.HTMLBody = body
        else:
            mail.Body = body

        if attachments:
            for attachment_path in ensure_list(attachments):
                path = normalize_path(attachment_path)
                mail.Attachments.Add(path)

        mail.Save()
        return self._parse_mail_item(mail)

    def get_folder(self, folder_name: str) -> Folder:
        """
        Get a folder by name.

        Args:
            folder_name: Name of the folder (e.g., "Inbox", "Custom Folder")

        Returns:
            Folder object

        Raises:
            FolderNotFoundError: If folder is not found
        """
        self._client._ensure_connected()

        try:
            # Search in default folders first
            root = self._client.namespace.Folders
            for store in root:
                try:
                    folder = store.Folders[folder_name]
                    return self._parse_folder(folder)
                except Exception:
                    continue

            raise FolderNotFoundError(folder_name)

        except FolderNotFoundError:
            raise
        except Exception as e:
            raise COMError(f"Error accessing folder: {e}")

    def search(
        self,
        query: str,
        folder: Optional[FolderType] = None,
        limit: int = 50
    ) -> List[Email]:
        """
        Search for emails.

        Args:
            query: Search query (supports Outlook search syntax)
            folder: Specific folder to search (None = all folders)
            limit: Maximum results to return

        Returns:
            List of matching Email objects
        """
        self._client._ensure_connected()

        if folder:
            search_folder = self._client.namespace.GetDefaultFolder(folder)
        else:
            search_folder = self._client.namespace.GetDefaultFolder(FolderType.INBOX)

        items = search_folder.Items
        results = []

        # Use Restrict for filtering
        try:
            # Build filter - supports subject, sender, body
            filter_str = f"@SQL=\"urn:schemas:httpmail:subject\" LIKE '%{query}%' OR " \
                        f"\"urn:schemas:httpmail:textdescription\" LIKE '%{query}%'"
            filtered = items.Restrict(filter_str)

            for item in filtered:
                if len(results) >= limit:
                    break
                try:
                    if safe_get_property(item, "Class") == 43:
                        results.append(self._parse_mail_item(item))
                except Exception:
                    continue
        except Exception:
            # Fallback to manual search
            for item in items:
                if len(results) >= limit:
                    break
                try:
                    if safe_get_property(item, "Class") != 43:
                        continue
                    subject = safe_get_property(item, "Subject", "")
                    body = safe_get_property(item, "Body", "")
                    if query.lower() in subject.lower() or query.lower() in body.lower():
                        results.append(self._parse_mail_item(item))
                except Exception:
                    continue

        return results

    def reply(self, email: Email, body: str, reply_all: bool = False) -> None:
        """
        Reply to an email.

        Args:
            email: Email to reply to
            body: Reply body
            reply_all: If True, reply to all recipients
        """
        if not email._com_object:
            raise ValueError("Cannot reply - email has no COM reference")

        if reply_all:
            reply = email._com_object.ReplyAll()
        else:
            reply = email._com_object.Reply()

        reply.Body = body + reply.Body
        reply.Send()

    def forward(
        self,
        email: Email,
        to: Union[str, List[str]],
        body: Optional[str] = None
    ) -> None:
        """
        Forward an email.

        Args:
            email: Email to forward
            to: Recipient(s) to forward to
            body: Optional additional message
        """
        if not email._com_object:
            raise ValueError("Cannot forward - email has no COM reference")

        fwd = email._com_object.Forward()
        fwd.To = "; ".join(ensure_list(to))
        if body:
            fwd.Body = body + fwd.Body
        fwd.Send()

    def _parse_mail_item(self, item) -> Email:
        """Parse a COM MailItem into an Email object."""
        # Get recipients
        to_list = []
        cc_list = []
        bcc_list = []

        try:
            for recip in item.Recipients:
                r_type = safe_get_property(recip, "Type", 1)
                recipient = Recipient(
                    name=safe_get_property(recip, "Name", ""),
                    email=get_smtp_address(recip),
                    type=MailRecipientType(r_type) if r_type in [1, 2, 3] else MailRecipientType.TO
                )
                if r_type == 1:
                    to_list.append(recipient)
                elif r_type == 2:
                    cc_list.append(recipient)
                elif r_type == 3:
                    bcc_list.append(recipient)
        except Exception:
            pass

        # Get attachments
        attachments = []
        try:
            for i, att in enumerate(item.Attachments, 1):
                attachments.append(Attachment(
                    filename=safe_get_property(att, "FileName", ""),
                    size=safe_get_property(att, "Size", 0),
                    index=i,
                    _com_object=att
                ))
        except Exception:
            pass

        # Get sender email
        sender_email = ""
        try:
            if hasattr(item, "SenderEmailAddress"):
                sender_email = item.SenderEmailAddress
                if sender_email and "/" in sender_email and hasattr(item, "Sender"):
                    # Exchange address - get SMTP
                    sender = item.Sender
                    if sender:
                        exchange_user = sender.GetExchangeUser()
                        if exchange_user:
                            sender_email = exchange_user.PrimarySmtpAddress
        except Exception:
            pass

        return Email(
            subject=safe_get_property(item, "Subject", ""),
            sender_name=safe_get_property(item, "SenderName", ""),
            sender_email=sender_email,
            body=safe_get_property(item, "Body", ""),
            html_body=safe_get_property(item, "HTMLBody", ""),
            received_time=pywintypes_to_datetime(safe_get_property(item, "ReceivedTime")),
            sent_time=pywintypes_to_datetime(safe_get_property(item, "SentOn")),
            to=to_list,
            cc=cc_list,
            bcc=bcc_list,
            attachments=attachments,
            importance=Importance(safe_get_property(item, "Importance", 1)),
            is_read=not safe_get_property(item, "UnRead", False),
            has_attachments=safe_get_property(item, "Attachments", None) is not None and item.Attachments.Count > 0,
            conversation_id=safe_get_property(item, "ConversationID", None),
            entry_id=safe_get_property(item, "EntryID", None),
            _com_object=item
        )

    def _parse_folder(self, folder) -> Folder:
        """Parse a COM Folder into a Folder object."""
        return Folder(
            name=safe_get_property(folder, "Name", ""),
            full_path=safe_get_property(folder, "FolderPath", ""),
            item_count=safe_get_property(folder, "Items", None).Count if folder.Items else 0,
            unread_count=safe_get_property(folder, "UnReadItemCount", 0),
            _com_object=folder
        )
