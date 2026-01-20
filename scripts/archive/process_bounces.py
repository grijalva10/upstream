#!/usr/bin/env python3
"""
Process Bounce Emails - Extract bounced addresses and update database

This script:
1. Fetches bounce emails from Outlook (with full body)
2. Extracts bounced email addresses using multiple patterns
3. Updates synced_emails classification to 'bounce'
4. Adds bounced emails/domains to exclusions table
5. Marks matching contacts as 'bounced'

Usage:
    python scripts/process_bounces.py                    # Process all bounces
    python scripts/process_bounces.py --dry-run          # Preview without changes
    python scripts/process_bounces.py --resync           # Re-fetch from Outlook first
    python scripts/process_bounces.py --days 30          # Only last 30 days
"""

import argparse
import logging
import os
import re
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, List, Set, Tuple
from dataclasses import dataclass

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

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

# Patterns to extract bounced email addresses from body/subject
EMAIL_EXTRACT_PATTERNS = [
    # Direct email mentions
    r'(?:to|recipient|address)[:\s]+<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?',
    r'(?:could not be delivered to)[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?',
    r'(?:delivery.*failed.*to)[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?',
    r'(?:undeliverable.*to)[:\s]*<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?',
    # Email in parentheses
    r'\(([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\)',
    # RCPT TO format
    r'RCPT TO:\s*<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>',
    # Final-Recipient header
    r'Final-Recipient:.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    # Original-Recipient header
    r'Original-Recipient:.*?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    # X-Failed-Recipients header
    r'X-Failed-Recipients:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})',
    # Generic email in angle brackets
    r'<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>',
]

# Aggressive pattern for garbled content - captures even with garbage attached
GARBLED_EMAIL_PATTERN = r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(?:com|net|org|edu|gov|io|co|us|biz|info))'

# Known garbage prefixes to strip from extracted emails
GARBAGE_PREFIXES = [
    r'^\d{5}',        # Zip codes like 92344
    r'^Close',        # "Close" prefix
    r'^St(?=[A-Z])',  # "St" before capital letter
    r'^ready',        # "ready" prefix
    r'^\d+M\+',       # "60M+" etc
    r'^MULTI_FAMILY', # Property type prefix
]

# Known garbage suffixes to strip from extracted emails
GARBAGE_SUFFIXES = [
    r'Undeliverable$',
    r'LZFu.*$',
    r'LZFU.*$',
]

# Emails/domains to ignore when extracting
IGNORE_PATTERNS = [
    r'@lee-associates\.com$',
    r'^postmaster@',
    r'^mailer-daemon@',
    r'^noreply@',
    r'@microsoft\.com$',
    r'@outlook\.com$',
    r'@googlemail\.com$',
    r'@google\.com$',
    r'^no-reply@',
    r'^bounces@',
    # Mail system identifiers that look like emails but aren't
    r'@.*mx\.google\.com$',
    r'@.*pphosted\.com$',
    r'@.*service\.uci\.edu$',
    r'@.*eigbox\.net$',
    r'@.*appriver\.com$',
    r'@.*netfirms\.com$',
    r'@.*\.prod\.outlook\.com$',
    r'@.*\.onmicrosoft\.com$',
    r'^receipt-\d+@',
    r'^bounce@',
    r'^\d{8,}\..*@',  # Numeric message IDs like 202511042228.xxx@
    r'^[a-z0-9]{20,}@',  # Long hex/alphanumeric IDs
]

# Domains to ignore (mail infrastructure)
IGNORE_DOMAINS = [
    'pphosted.com',
    'eigbox.net',
    'appriver.com',
    'netfirms.com',
    'prod.outlook.com',
    'onmicrosoft.com',
    'service.uci.edu',
    'mx.google.com',
]


@dataclass
class BounceResult:
    """Result of processing a single bounce email."""
    email_id: str
    subject: str
    from_email: str
    extracted_emails: List[str]
    extracted_domains: List[str]


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables required."
        )

    return create_client(url, key)


def is_bounce_email(from_email: str, subject: str) -> bool:
    """Check if an email is a bounce notification."""
    from_lower = from_email.lower()
    subject_lower = subject.lower()

    for pattern in BOUNCE_FROM_PATTERNS:
        if re.search(pattern, from_lower, re.IGNORECASE):
            return True

    for pattern in BOUNCE_SUBJECT_PATTERNS:
        if re.search(pattern, subject_lower, re.IGNORECASE):
            return True

    return False


def should_ignore_email(email: str) -> bool:
    """Check if an email should be ignored."""
    email_lower = email.lower()
    for pattern in IGNORE_PATTERNS:
        if re.search(pattern, email_lower):
            return True
    return False


def should_ignore_domain(domain: str) -> bool:
    """Check if a domain is mail infrastructure and should be ignored."""
    domain_lower = domain.lower()
    for ignore_domain in IGNORE_DOMAINS:
        if domain_lower.endswith(ignore_domain):
            return True
    return False


def clean_garbled_email(email: str) -> Optional[str]:
    """
    Clean an email extracted from garbled text by removing known garbage.
    Returns None if the email is invalid after cleaning.
    """
    if not email or '@' not in email:
        return None

    cleaned = email.strip()

    # Apply suffix cleanups first (case insensitive)
    for suffix_pattern in GARBAGE_SUFFIXES:
        cleaned = re.sub(suffix_pattern, '', cleaned, flags=re.IGNORECASE)

    # Split into local and domain
    if '@' not in cleaned:
        return None

    local, domain = cleaned.rsplit('@', 1)

    # Apply prefix cleanups to local part
    for prefix_pattern in GARBAGE_PREFIXES:
        local = re.sub(prefix_pattern, '', local, flags=re.IGNORECASE)

    # Validate what's left
    if not local or len(local) < 2:
        return None
    if not domain or '.' not in domain:
        return None

    # Check domain ends with valid TLD (not more garbage)
    domain_parts = domain.split('.')
    tld = domain_parts[-1].lower()
    valid_tlds = {'com', 'net', 'org', 'edu', 'gov', 'io', 'co', 'us', 'biz', 'info', 'tech', 'cloud'}
    if tld not in valid_tlds:
        return None

    # Reject if domain contains 'com' or 'net' etc. in the middle (garbage concatenation)
    # e.g. 'lee-associates.comgooglemail.com' is invalid
    for part in domain_parts[:-1]:
        part_lower = part.lower()
        if part_lower in valid_tlds:
            return None
        # Also catch garbage like 'comgooglemail' - starts with TLD
        for tld in valid_tlds:
            if part_lower.startswith(tld) and len(part_lower) > len(tld):
                return None

    # Reject overly long local parts (usually garbage)
    if len(local) > 60:
        return None

    return f"{local}@{domain}".lower()


def extract_bounced_emails(subject: str, body: str, from_email: str) -> Tuple[Set[str], Set[str]]:
    """
    Extract bounced email addresses and domains from bounce notification.
    Returns (set of emails, set of domains).
    """
    emails = set()
    domains = set()

    # Combine subject and body for searching
    text = f"{subject}\n{body}"

    # Try standard patterns first
    for pattern in EMAIL_EXTRACT_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
        for match in matches:
            email = match.strip().lower()
            if email and not should_ignore_email(email):
                emails.add(email)
                # Extract domain
                domain = email.split('@')[1] if '@' in email else None
                if domain and not should_ignore_domain(domain):
                    domains.add(domain)

    # Try garbled pattern for messy bounce content
    garbled_matches = re.findall(GARBLED_EMAIL_PATTERN, text, re.IGNORECASE)
    for match in garbled_matches:
        # Clean the garbled email
        cleaned = clean_garbled_email(match)
        if cleaned and not should_ignore_email(cleaned):
            emails.add(cleaned)
            # Extract domain
            domain = cleaned.split('@')[1] if '@' in cleaned else None
            if domain and not should_ignore_domain(domain):
                domains.add(domain)

    # Also extract domain from postmaster@ sender
    if from_email.lower().startswith('postmaster@'):
        domain = from_email.split('@')[1] if '@' in from_email else None
        if domain and not should_ignore_domain(domain) and domain not in ['outlook.com', 'microsoft.com']:
            domains.add(domain.lower())

    return emails, domains


def fetch_bounce_emails_from_outlook(days: int = 90) -> List[dict]:
    """Fetch bounce emails directly from Outlook with full body."""
    try:
        import win32com.client
    except ImportError:
        logger.warning("win32com not available - skipping Outlook fetch")
        return []

    logger.info("Connecting to Outlook...")
    outlook = win32com.client.Dispatch("Outlook.Application")
    namespace = outlook.GetNamespace("MAPI")

    bounces = []
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    # Check Inbox and Junk
    for folder_id in [6, 23]:  # 6=Inbox, 23=Junk
        try:
            folder = namespace.GetDefaultFolder(folder_id)
            items = folder.Items
            items.Sort("[ReceivedTime]", True)

            for item in items:
                try:
                    if item.Class != 43:  # Only mail items
                        continue

                    received = item.ReceivedTime
                    if received:
                        received_dt = datetime.fromtimestamp(received.timestamp(), tz=timezone.utc)
                        if received_dt < cutoff:
                            break  # Stop when we hit old emails

                    from_email = str(item.SenderEmailAddress or "")
                    subject = str(item.Subject or "")

                    if is_bounce_email(from_email, subject):
                        body = str(item.Body or "")
                        bounces.append({
                            'from_email': from_email,
                            'subject': subject,
                            'body': body,
                            'entry_id': item.EntryID,
                        })
                except Exception as e:
                    continue
        except Exception as e:
            logger.warning(f"Failed to access folder {folder_id}: {e}")

    logger.info(f"Found {len(bounces)} bounce emails in Outlook")
    return bounces


def get_bounce_emails_from_db(db: Client, days: Optional[int] = None) -> List[dict]:
    """Get bounce emails from database."""
    query = db.table("synced_emails").select(
        "id, from_email, subject, body_text, classification, received_at"
    )

    if days:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
        query = query.gte("received_at", cutoff)

    result = query.execute()

    bounces = []
    for email in result.data:
        from_email = email.get('from_email', '')
        subject = email.get('subject', '')

        # Include already classified bounces and detect new ones
        if email.get('classification') == 'bounce' or is_bounce_email(from_email, subject):
            bounces.append({
                'id': email['id'],
                'from_email': from_email,
                'subject': subject,
                'body': email.get('body_text', ''),
                'classification': email.get('classification'),
            })

    return bounces


def process_bounces(db: Client, bounces: List[dict], dry_run: bool = False) -> dict:
    """
    Process bounce emails and update database.
    Returns summary of actions taken.
    """
    all_emails = set()
    all_domains = set()
    results = []
    emails_to_update = []

    for bounce in bounces:
        emails, domains = extract_bounced_emails(
            bounce.get('subject', ''),
            bounce.get('body', ''),
            bounce.get('from_email', '')
        )

        all_emails.update(emails)
        all_domains.update(domains)

        result = BounceResult(
            email_id=bounce.get('id', bounce.get('entry_id', 'unknown')),
            subject=bounce.get('subject', '')[:80],
            from_email=bounce.get('from_email', ''),
            extracted_emails=list(emails),
            extracted_domains=list(domains),
        )
        results.append(result)

        # Track emails that need classification update
        if bounce.get('id') and bounce.get('classification') != 'bounce':
            emails_to_update.append(bounce['id'])

    # Log findings
    logger.info(f"\nProcessed {len(bounces)} bounce emails")
    logger.info(f"Extracted {len(all_emails)} unique email addresses")
    logger.info(f"Extracted {len(all_domains)} unique domains")

    if all_emails:
        logger.info("\nBounced emails found:")
        for email in sorted(all_emails):
            logger.info(f"  - {email}")

    if all_domains:
        logger.info("\nBounced domains found:")
        for domain in sorted(all_domains):
            logger.info(f"  - {domain}")

    if dry_run:
        logger.info("\n[DRY RUN] No changes made to database")
        return {
            'bounces_processed': len(bounces),
            'emails_found': len(all_emails),
            'domains_found': len(all_domains),
            'dry_run': True,
        }

    # Update database
    updated_classifications = 0
    added_exclusions = 0
    updated_contacts = 0

    # 1. Update email classifications
    if emails_to_update:
        for email_id in emails_to_update:
            try:
                db.table("synced_emails").update({
                    "classification": "bounce"
                }).eq("id", email_id).execute()
                updated_classifications += 1
            except Exception as e:
                logger.warning(f"Failed to update classification for {email_id}: {e}")
        logger.info(f"Updated {updated_classifications} email classifications to 'bounce'")

    # 2. Add email exclusions
    for email in all_emails:
        try:
            db.table("exclusions").upsert({
                "exclusion_type": "email",
                "value": email,
                "reason": "Hard bounce - delivery failed",
            }, on_conflict="exclusion_type,value").execute()
            added_exclusions += 1
        except Exception as e:
            logger.debug(f"Failed to add exclusion for {email}: {e}")

    # 3. Add domain exclusions
    for domain in all_domains:
        try:
            db.table("exclusions").upsert({
                "exclusion_type": "domain",
                "value": domain,
                "reason": "Bounce notification received",
            }, on_conflict="exclusion_type,value").execute()
            added_exclusions += 1
        except Exception as e:
            logger.debug(f"Failed to add exclusion for domain {domain}: {e}")

    logger.info(f"Added/updated {added_exclusions} exclusions")

    # 4. Add to DNC list (dnc_entries) for UI visibility
    added_dnc = 0
    for email in all_emails:
        try:
            # Check if already exists
            existing = db.table("dnc_entries").select("id").eq("email", email).execute()
            if not existing.data:
                db.table("dnc_entries").insert({
                    "email": email,
                    "reason": "bounced",
                    "source": "bounce_processor",
                    "notes": "Hard bounce - delivery failed",
                }).execute()
                added_dnc += 1
        except Exception as e:
            logger.debug(f"Failed to add DNC entry for {email}: {e}")

    logger.info(f"Added {added_dnc} DNC entries")

    # 5. Mark contacts as bounced
    for email in all_emails:
        try:
            result = db.table("contacts").update({
                "status": "bounced"
            }).eq("email", email).execute()
            if result.data:
                updated_contacts += len(result.data)
        except Exception as e:
            logger.debug(f"Failed to update contact {email}: {e}")

    # Also update contacts at bounced domains
    for domain in all_domains:
        try:
            result = db.table("contacts").update({
                "status": "bounced"
            }).ilike("email", f"%@{domain}").execute()
            if result.data:
                updated_contacts += len(result.data)
        except Exception as e:
            logger.debug(f"Failed to update contacts at domain {domain}: {e}")

    logger.info(f"Marked {updated_contacts} contacts as bounced")

    return {
        'bounces_processed': len(bounces),
        'emails_found': len(all_emails),
        'domains_found': len(all_domains),
        'classifications_updated': updated_classifications,
        'exclusions_added': added_exclusions,
        'dnc_entries_added': added_dnc,
        'contacts_updated': updated_contacts,
        'dry_run': False,
    }


def main():
    parser = argparse.ArgumentParser(description="Process bounce emails")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without updating database",
    )
    parser.add_argument(
        "--resync",
        action="store_true",
        help="Re-fetch bounce emails from Outlook first",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Only process bounces from last N days (default: 90)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show verbose output",
    )

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    logger.info("=" * 60)
    logger.info("BOUNCE EMAIL PROCESSOR")
    logger.info("=" * 60)

    # Connect to database
    logger.info("Connecting to database...")
    db = get_supabase_client()

    # Get bounce emails
    if args.resync:
        # Fetch fresh from Outlook
        bounces = fetch_bounce_emails_from_outlook(days=args.days)

        # Also get from database for comparison
        db_bounces = get_bounce_emails_from_db(db, days=args.days)
        logger.info(f"Found {len(db_bounces)} bounce emails in database")

        # Merge (prefer Outlook for full body)
        outlook_ids = {b.get('entry_id') for b in bounces if b.get('entry_id')}
        for db_bounce in db_bounces:
            # Add db bounces that we don't have from Outlook
            bounces.append(db_bounce)
    else:
        # Just use database
        bounces = get_bounce_emails_from_db(db, days=args.days)

    if not bounces:
        logger.info("No bounce emails found")
        return

    # Process bounces
    results = process_bounces(db, bounces, dry_run=args.dry_run)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)
    for key, value in results.items():
        logger.info(f"  {key}: {value}")


if __name__ == "__main__":
    main()
