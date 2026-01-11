#!/usr/bin/env python3
"""
Outlook Email Sync Script

Syncs emails from Outlook to the synced_emails table in Supabase.
Tracks sync state to enable incremental syncing.

Usage:
    python scripts/sync_emails.py                    # Sync both inbox and sent
    python scripts/sync_emails.py --folder inbox     # Sync only inbox
    python scripts/sync_emails.py --folder sent      # Sync only sent
    python scripts/sync_emails.py --limit 100        # Limit emails per folder
    python scripts/sync_emails.py --full             # Full sync (ignore last sync state)
"""

import argparse
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client

from integrations.outlook import OutlookClient, Email

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required.\n"
            "For local dev, use:\n"
            "  SUPABASE_URL=http://127.0.0.1:55321\n"
            "  SUPABASE_SERVICE_KEY=<from npx supabase status>"
        )

    return create_client(url, key)


def get_sync_state(db: Client, folder: str) -> Tuple[Optional[datetime], Optional[str]]:
    """Get last sync state for a folder."""
    result = (
        db.table("email_sync_state")
        .select("last_sync_at, last_entry_id")
        .eq("folder", folder)
        .limit(1)
        .execute()
    )

    if result.data:
        row = result.data[0]
        last_sync_at = None
        if row.get("last_sync_at"):
            last_sync_at = datetime.fromisoformat(row["last_sync_at"].replace("Z", "+00:00"))
        return last_sync_at, row.get("last_entry_id")

    return None, None


def update_sync_state(db: Client, folder: str, last_sync_at: datetime, last_entry_id: str) -> None:
    """Update sync state for a folder."""
    data = {
        "folder": folder,
        "last_sync_at": last_sync_at.isoformat(),
        "last_entry_id": last_entry_id,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Upsert (insert or update)
    db.table("email_sync_state").upsert(data, on_conflict="folder").execute()


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


def save_email(db: Client, email: Email, direction: str) -> Optional[str]:
    """Save email to database. Returns the new record ID or None if already exists."""
    if not email.entry_id:
        logger.warning(f"Email missing entry_id, skipping: {email.subject[:50]}")
        return None

    # Check if already synced
    if email_exists(db, email.entry_id):
        return None

    # Extract recipient emails
    to_emails = [r.email for r in email.to if r.email]
    cc_emails = [r.email for r in email.cc if r.email]

    # Determine timestamps
    received_at = email.received_time.isoformat() if email.received_time else None
    sent_at = email.sent_time.isoformat() if email.sent_time else None

    data = {
        "outlook_entry_id": email.entry_id,
        "outlook_conversation_id": email.conversation_id,
        "direction": direction,
        "from_email": email.sender_email,
        "from_name": email.sender_name,
        "to_emails": to_emails,
        "cc_emails": cc_emails,
        "subject": email.subject,
        "body_text": email.body[:50000] if email.body else None,  # Limit body size
        "body_html": email.html_body[:100000] if email.html_body else None,
        "received_at": received_at,
        "sent_at": sent_at,
        "is_read": email.is_read,
        "has_attachments": email.has_attachments,
        "synced_at": datetime.now(timezone.utc).isoformat(),
    }

    result = db.table("synced_emails").insert(data).execute()

    if result.data:
        return result.data[0]["id"]
    return None


def sync_folder(
    client: OutlookClient,
    db: Client,
    folder_name: str,
    limit: int = 500,
    full_sync: bool = False,
) -> Tuple[int, int]:
    """
    Sync a single folder.

    Returns:
        Tuple of (new_emails_count, skipped_count)
    """
    direction = "inbound" if folder_name == "inbox" else "outbound"

    # Get sync state
    last_sync_at, last_entry_id = get_sync_state(db, folder_name)

    if full_sync:
        logger.info(f"Full sync mode - ignoring previous sync state")
        since = None
    else:
        since = last_sync_at
        if since:
            logger.info(f"Incremental sync - fetching emails since {since}")
        else:
            logger.info(f"No previous sync state - fetching all emails (up to {limit})")

    # Get folder accessor
    if folder_name == "inbox":
        folder = client.email.inbox
    elif folder_name == "sent":
        folder = client.email.sent
    else:
        raise ValueError(f"Unknown folder: {folder_name}")

    # Fetch emails
    logger.info(f"Fetching emails from {folder_name}...")
    emails = folder.get_messages(limit=limit, since=since)
    logger.info(f"Found {len(emails)} emails to process")

    # Save to database
    new_count = 0
    skipped_count = 0
    newest_email: Optional[Email] = None

    for email in emails:
        try:
            record_id = save_email(db, email, direction)
            if record_id:
                new_count += 1
                # Track newest email for sync state
                if newest_email is None:
                    newest_email = email
                elif email.received_time and newest_email.received_time:
                    if email.received_time > newest_email.received_time:
                        newest_email = email
            else:
                skipped_count += 1
        except Exception as e:
            logger.error(f"Failed to save email '{email.subject[:30]}...': {e}")
            skipped_count += 1

    # Update sync state
    if newest_email and newest_email.entry_id:
        sync_time = newest_email.received_time or datetime.now(timezone.utc)
        if sync_time.tzinfo is None:
            sync_time = sync_time.replace(tzinfo=timezone.utc)
        update_sync_state(db, folder_name, sync_time, newest_email.entry_id)
        logger.info(f"Updated sync state: {sync_time}")

    return new_count, skipped_count


def main():
    parser = argparse.ArgumentParser(description="Sync Outlook emails to database")
    parser.add_argument(
        "--folder",
        choices=["inbox", "sent", "both"],
        default="both",
        help="Which folder(s) to sync (default: both)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=500,
        help="Maximum emails to fetch per folder (default: 500)",
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Full sync - ignore previous sync state",
    )

    args = parser.parse_args()

    # Connect to services
    logger.info("Connecting to Outlook...")
    outlook = OutlookClient(lazy_connect=False)
    logger.info(f"Connected as: {outlook.get_current_user_name()}")

    logger.info("Connecting to Supabase...")
    db = get_supabase_client()
    logger.info("Database connected")

    # Determine folders to sync
    folders = ["inbox", "sent"] if args.folder == "both" else [args.folder]

    total_new = 0
    total_skipped = 0

    for folder in folders:
        logger.info(f"\n{'='*50}")
        logger.info(f"Syncing {folder.upper()}")
        logger.info(f"{'='*50}")

        try:
            new_count, skipped_count = sync_folder(
                outlook, db, folder, limit=args.limit, full_sync=args.full
            )
            total_new += new_count
            total_skipped += skipped_count
            logger.info(f"✓ {folder}: {new_count} new, {skipped_count} skipped")
        except Exception as e:
            logger.error(f"✗ Failed to sync {folder}: {e}")
            raise

    logger.info(f"\n{'='*50}")
    logger.info(f"SYNC COMPLETE")
    logger.info(f"{'='*50}")
    logger.info(f"Total new emails: {total_new}")
    logger.info(f"Total skipped (duplicates): {total_skipped}")


if __name__ == "__main__":
    main()
