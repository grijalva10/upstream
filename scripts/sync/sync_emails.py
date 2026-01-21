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
import re
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

# Add project root to path (scripts/sync/ -> scripts/ -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client

from integrations.outlook import OutlookClient, Email

load_dotenv()

# Patterns to identify bounce emails
BOUNCE_SUBJECT_PATTERNS = [
    r'undeliverable',
    r'delivery.*failed',
    r'mail delivery',
    r'returned mail',
    r'delivery status notification.*failure',
    r'undelivered mail',
]

BOUNCE_FROM_PATTERNS = [
    r'mailer-daemon',
    r'postmaster@',
    r'mailerdaemon',
]


def is_bounce_email(from_email: str, subject: str) -> bool:
    """Check if an email is a bounce notification."""
    from_lower = (from_email or "").lower()
    subject_lower = (subject or "").lower()

    for pattern in BOUNCE_FROM_PATTERNS:
        if re.search(pattern, from_lower, re.IGNORECASE):
            return True

    for pattern in BOUNCE_SUBJECT_PATTERNS:
        if re.search(pattern, subject_lower, re.IGNORECASE):
            return True

    return False


def extract_bounce_attachment_content(email: Email) -> Optional[str]:
    """
    Extract content from bounce email attachments.
    Bounce emails often contain the actual error in attached .eml or message parts.
    """
    if not email.attachments:
        return None

    attachment_content = []

    for att in email.attachments:
        try:
            if not att._com_object:
                continue

            # Save attachment to temp file and read it
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
                temp_path = f.name

            try:
                att._com_object.SaveAsFile(temp_path)
                with open(temp_path, 'rb') as f:
                    raw = f.read()
                    # Decode and clean - remove null bytes and control chars
                    content = raw.decode('utf-8', errors='ignore')
                    content = ''.join(c for c in content if c.isprintable() or c in '\n\r\t')
                    if content and len(content) > 50:  # Skip empty/tiny attachments
                        attachment_content.append(content[:10000])  # Limit per attachment
            finally:
                try:
                    os.unlink(temp_path)
                except:
                    pass

        except Exception as e:
            # Attachment extraction failed - not critical
            continue

    if attachment_content:
        return "\n---ATTACHMENT---\n".join(attachment_content)
    return None


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


def save_email(db: Client, email: Email, direction: str, source_folder: str) -> Optional[str]:
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

    # Get body text - for bounce emails, also extract from attachments
    body_text = email.body or ""
    if is_bounce_email(email.sender_email, email.subject):
        attachment_content = extract_bounce_attachment_content(email)
        if attachment_content:
            body_text = f"{body_text}\n\n{attachment_content}"
            logger.debug(f"Extracted {len(attachment_content)} chars from bounce attachments")

    data = {
        "outlook_entry_id": email.entry_id,
        "outlook_conversation_id": email.conversation_id,
        "direction": direction,
        "from_email": email.sender_email,
        "from_name": email.sender_name,
        "to_emails": to_emails,
        "cc_emails": cc_emails,
        "subject": email.subject,
        "body_text": body_text[:50000] if body_text else None,  # Limit body size
        "body_html": email.html_body[:100000] if email.html_body else None,
        "received_at": received_at,
        "sent_at": sent_at,
        "is_read": email.is_read,
        "has_attachments": email.has_attachments,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "source_folder": source_folder,
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

    # Map folder names to display names
    folder_display = "Inbox" if folder_name == "inbox" else "Sent Items"

    for email in emails:
        try:
            record_id = save_email(db, email, direction, folder_display)
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


def resync_bounce_emails(
    client: OutlookClient,
    db: Client,
    days: int = 90,
) -> int:
    """
    Re-sync bounce emails to extract full content from attachments.
    Updates existing records with the extracted content.
    """
    from datetime import timedelta

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    updated = 0

    # Get existing bounce emails from DB that have short body
    result = db.table("synced_emails").select(
        "id, outlook_entry_id, subject, from_email, body_text"
    ).or_(
        "subject.ilike.%undeliverable%,"
        "subject.ilike.%delivery%failed%,"
        "subject.ilike.%mail delivery%,"
        "from_email.ilike.%mailer-daemon%,"
        "from_email.ilike.%postmaster%"
    ).gte("received_at", cutoff.isoformat()).execute()

    # Filter to those with short body (likely missing attachment content)
    short_body_emails = [
        e for e in result.data
        if len(e.get('body_text') or '') < 500
    ]

    if not short_body_emails:
        logger.info("No bounce emails with short body found")
        return 0

    logger.info(f"Found {len(short_body_emails)} bounce emails to re-sync")

    # Get namespace for Outlook lookups
    namespace = client.namespace

    for email_record in short_body_emails:
        entry_id = email_record.get('outlook_entry_id')
        if not entry_id:
            continue

        try:
            # Get the email from Outlook by entry ID
            item = namespace.GetItemFromID(entry_id)
            if not item:
                continue

            # Parse it to get attachments
            parsed = client.email._parse_mail_item(item)

            # Extract attachment content
            attachment_content = extract_bounce_attachment_content(parsed)

            if attachment_content:
                new_body = f"{email_record.get('body_text', '')}\n\n{attachment_content}"

                # Update the database record
                db.table("synced_emails").update({
                    "body_text": new_body[:50000]
                }).eq("id", email_record['id']).execute()

                updated += 1
                logger.info(f"Updated: {email_record.get('subject', '')[:50]}...")

        except Exception as e:
            logger.debug(f"Failed to re-sync {entry_id}: {e}")
            continue

    return updated


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
    parser.add_argument(
        "--resync-bounces",
        action="store_true",
        help="Re-sync bounce emails to extract attachment content",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Days to look back for --resync-bounces (default: 90)",
    )

    args = parser.parse_args()

    # Connect to services
    logger.info("Connecting to Outlook...")
    outlook = OutlookClient(lazy_connect=False)
    logger.info(f"Connected as: {outlook.get_current_user_name()}")

    logger.info("Connecting to Supabase...")
    db = get_supabase_client()
    logger.info("Database connected")

    # Handle --resync-bounces mode
    if args.resync_bounces:
        logger.info(f"\n{'='*50}")
        logger.info("RE-SYNCING BOUNCE EMAILS")
        logger.info(f"{'='*50}")
        updated = resync_bounce_emails(outlook, db, days=args.days)
        logger.info(f"\n✓ Updated {updated} bounce emails with attachment content")
        return

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
