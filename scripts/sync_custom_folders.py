#!/usr/bin/env python3
"""
Sync emails from custom Outlook folders (Archive, Bounced Emails, etc.)

Usage:
    python scripts/sync_custom_folders.py                          # Sync all custom folders
    python scripts/sync_custom_folders.py --folder "Archive"       # Sync specific folder
    python scripts/sync_custom_folders.py --folder "Bounced Emails" --limit 500
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client
import win32com.client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Custom folders to sync (in addition to inbox/sent)
CUSTOM_FOLDERS = [
    {"name": "Archive", "direction": "inbound"},
    {"name": "Bounced Emails", "direction": "inbound"},
    {"name": "Deals", "direction": "inbound"},
    {"name": "Requirements", "direction": "inbound"},
    {"name": "Ben Strom", "direction": "inbound"},
    {"name": "Inbox/_Archive/CoStar Alerts", "direction": "inbound"},
    {"name": "Inbox/_Archive/Newsletters", "direction": "inbound"},
    {"name": "Drafts", "direction": "outbound"},
    {"name": "Junk Email", "direction": "inbound"},
]


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required."
        )

    return create_client(url, key)


def email_exists(db: Client, entry_id: str) -> bool:
    """Check if email already exists in database."""
    result = (
        db.table("synced_emails")
        .select("id")
        .eq("outlook_entry_id", entry_id)
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


def get_smtp_address(recip) -> str:
    """Get SMTP address from a recipient."""
    try:
        addr = recip.Address
        if addr and "/" in addr:
            # Exchange address - try to get SMTP
            try:
                exchange_user = recip.AddressEntry.GetExchangeUser()
                if exchange_user:
                    return exchange_user.PrimarySmtpAddress
            except:
                pass
        return addr or ""
    except:
        return ""


def save_email(db: Client, item, direction: str, folder_name: str) -> Optional[str]:
    """Save email to database. Returns the new record ID or None if skipped."""
    try:
        entry_id = item.EntryID
        if not entry_id:
            return None

        # Check if already synced
        if email_exists(db, entry_id):
            return None

        # Extract sender
        sender_email = ""
        sender_name = ""
        try:
            sender_name = str(item.SenderName or "")
            sender_email = str(item.SenderEmailAddress or "")
            if sender_email and "/" in sender_email:
                try:
                    sender = item.Sender
                    if sender:
                        exchange_user = sender.GetExchangeUser()
                        if exchange_user:
                            sender_email = exchange_user.PrimarySmtpAddress
                except:
                    pass
        except:
            pass

        # Extract recipients
        to_emails = []
        cc_emails = []
        try:
            for recip in item.Recipients:
                r_type = recip.Type
                email_addr = get_smtp_address(recip)
                if email_addr:
                    if r_type == 1:  # To
                        to_emails.append(email_addr)
                    elif r_type == 2:  # CC
                        cc_emails.append(email_addr)
        except:
            pass

        # Get timestamps
        received_at = None
        sent_at = None
        try:
            if item.ReceivedTime:
                received_at = datetime.fromtimestamp(
                    item.ReceivedTime.timestamp(), tz=timezone.utc
                ).isoformat()
        except:
            pass
        try:
            if item.SentOn:
                sent_at = datetime.fromtimestamp(
                    item.SentOn.timestamp(), tz=timezone.utc
                ).isoformat()
        except:
            pass

        # Build record
        body_text = str(item.Body or "")[:50000]
        body_html = str(item.HTMLBody or "")[:100000] if hasattr(item, "HTMLBody") else None

        data = {
            "outlook_entry_id": entry_id,
            "outlook_conversation_id": str(item.ConversationID or "") if hasattr(item, "ConversationID") else None,
            "direction": direction,
            "from_email": sender_email,
            "from_name": sender_name,
            "to_emails": to_emails,
            "cc_emails": cc_emails,
            "subject": str(item.Subject or ""),
            "body_text": body_text,
            "body_html": body_html,
            "received_at": received_at,
            "sent_at": sent_at,
            "is_read": not item.UnRead if hasattr(item, "UnRead") else True,
            "has_attachments": item.Attachments.Count > 0 if hasattr(item, "Attachments") else False,
            "synced_at": datetime.now(timezone.utc).isoformat(),
            "source_folder": folder_name,
        }

        result = db.table("synced_emails").insert(data).execute()

        if result.data:
            return result.data[0]["id"]
        return None

    except Exception as e:
        logger.error(f"Failed to save email: {e}")
        return None


def find_folder(namespace, folder_path: str):
    """Find a folder by name or path (e.g., 'Archive' or 'Inbox/Deals') in the Outlook namespace."""
    # Get the default inbox's parent (the mailbox root)
    inbox = namespace.GetDefaultFolder(6)  # 6 = olFolderInbox
    mailbox_root = inbox.Parent

    # Split path into parts
    parts = folder_path.split("/")

    def search_in_folder(parent, remaining_parts):
        if not remaining_parts:
            return parent
        target = remaining_parts[0]
        try:
            subfolder = parent.Folders[target]
            return search_in_folder(subfolder, remaining_parts[1:])
        except:
            return None

    # Try from mailbox root
    result = search_in_folder(mailbox_root, parts)
    if result:
        return result

    # Search all stores
    for store in namespace.Folders:
        result = search_in_folder(store, parts)
        if result:
            return result

    return None


def sync_folder(namespace, db: Client, folder_name: str, direction: str, limit: int = 2000) -> tuple:
    """Sync a single folder. Returns (new_count, skipped_count)."""
    folder = find_folder(namespace, folder_name)
    if not folder:
        logger.warning(f"Folder not found: {folder_name}")
        return 0, 0

    items = folder.Items
    items.Sort("[ReceivedTime]", True)  # Most recent first

    logger.info(f"Found {folder.Items.Count} items in {folder_name}")

    new_count = 0
    skipped_count = 0
    count = 0

    for item in items:
        if count >= limit:
            break

        try:
            # Only process mail items (Class 43 = olMail)
            if item.Class != 43:
                continue

            count += 1
            record_id = save_email(db, item, direction, folder_name)
            if record_id:
                new_count += 1
            else:
                skipped_count += 1

        except Exception as e:
            logger.debug(f"Skipping item: {e}")
            skipped_count += 1
            continue

    return new_count, skipped_count


def main():
    parser = argparse.ArgumentParser(description="Sync custom Outlook folders")
    parser.add_argument(
        "--folder",
        type=str,
        help="Specific folder to sync (default: all custom folders)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=2000,
        help="Maximum emails to fetch per folder (default: 2000)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List available folders and exit",
    )

    args = parser.parse_args()

    # Connect to Outlook
    logger.info("Connecting to Outlook...")
    outlook = win32com.client.Dispatch("Outlook.Application")
    namespace = outlook.GetNamespace("MAPI")
    logger.info("Connected to Outlook")

    if args.list:
        # List all folders recursively
        def list_folders(folder, indent=0):
            prefix = "  " * indent
            try:
                count = folder.Items.Count
                print(f"{prefix}- {folder.Name} ({count} items)")
            except:
                print(f"{prefix}- {folder.Name}")
            try:
                for subfolder in folder.Folders:
                    list_folders(subfolder, indent + 1)
            except:
                pass

        inbox = namespace.GetDefaultFolder(6)
        mailbox_root = inbox.Parent
        print(f"\nFolders in {mailbox_root.Name}:")
        for folder in mailbox_root.Folders:
            list_folders(folder, indent=1)
        return

    # Connect to database
    logger.info("Connecting to Supabase...")
    db = get_supabase_client()
    logger.info("Database connected")

    # Determine which folders to sync
    if args.folder:
        folders_to_sync = [{"name": args.folder, "direction": "inbound"}]
    else:
        folders_to_sync = CUSTOM_FOLDERS

    total_new = 0
    total_skipped = 0

    for folder_config in folders_to_sync:
        folder_name = folder_config["name"]
        direction = folder_config["direction"]

        logger.info(f"\n{'='*50}")
        logger.info(f"Syncing {folder_name}")
        logger.info(f"{'='*50}")

        try:
            new_count, skipped_count = sync_folder(
                namespace, db, folder_name, direction, limit=args.limit
            )
            total_new += new_count
            total_skipped += skipped_count
            logger.info(f"✓ {folder_name}: {new_count} new, {skipped_count} skipped")
        except Exception as e:
            logger.error(f"✗ Failed to sync {folder_name}: {e}")

    logger.info(f"\n{'='*50}")
    logger.info(f"SYNC COMPLETE")
    logger.info(f"{'='*50}")
    logger.info(f"Total new emails: {total_new}")
    logger.info(f"Total skipped (duplicates): {total_skipped}")


if __name__ == "__main__":
    main()
