"""
Response Loop - Email sync, classification, and routing.

Flow:
1. Sync emails from Outlook -> synced_emails table
2. Match inbound emails to campaigns (by sender email -> contacts)
3. Classify using Claude Code headless
4. Route by classification:
   - bounce -> exclusions + stop sequence
   - hard_pass -> DNC + stop sequence
   - soft_pass -> nurture + pause sequence
   - interested/pricing_given/question -> flag for human review

Runs every 5 minutes.
"""
import asyncio
import json
import logging
import re
import subprocess
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any

from ..config import Config, get_config
from ..db import Database, get_db

logger = logging.getLogger(__name__)

# Domains to skip classification (system/newsletter emails)
SKIP_DOMAINS = {
    "alerts.costar.com",
    "email.costar.com",
    "txn.dropbox.com",
    "sharepointonline.com",
    "crowdstreet.com",
    "n8n.io",
    "noreply",
    "no-reply",
    "mailer-daemon",
    "postmaster",
}


# Classification categories
CATEGORIES = [
    "interested",
    "pricing_given",
    "question",
    "referral",
    "broker_redirect",
    "soft_pass",
    "hard_pass",
    "bounce"
]

# Auto-action categories (no human review needed)
AUTO_ACTION_CATEGORIES = {"bounce", "hard_pass", "soft_pass", "broker_redirect"}

# Categories that need human review
REVIEW_CATEGORIES = {"interested", "pricing_given", "question", "referral"}


def should_skip_email(from_email: str, subject: str = "") -> bool:
    """Check if email should be auto-skipped (system/newsletter)."""
    if not from_email:
        return True
    email_lower = from_email.lower()
    for skip in SKIP_DOMAINS:
        if skip in email_lower:
            return True
    # Skip if subject contains common newsletter patterns
    subject_lower = (subject or "").lower()
    skip_subjects = ["daily alert", "newsletter", "digest", "security:", "quarantine"]
    for pattern in skip_subjects:
        if pattern in subject_lower:
            return True
    return False


class EmailSync:
    """
    Syncs emails from Outlook to the database.

    Handles:
    - Incremental sync using last_sync_at cursor
    - Deduplication via outlook_entry_id
    - Matching inbound emails to campaign contacts
    """

    def __init__(self, db: Optional[Database] = None):
        self.db = db or get_db()

    async def sync_inbox(self, limit: int = 50) -> int:
        """
        Sync new emails from Outlook inbox.

        Returns count of new emails synced.
        """
        logger.info("Syncing Outlook inbox...")

        try:
            from integrations.outlook import OutlookClient
        except ImportError as e:
            logger.error(f"Outlook integration not available: {e}")
            return 0

        # Get last sync time
        last_sync = self._get_last_sync("inbox")

        try:
            client = OutlookClient()
            emails = client.email.inbox.get_messages(limit=limit, since=last_sync)

            new_count = 0
            newest_time = None

            for email in emails:
                # Check if already synced
                if self._email_exists(email.entry_id):
                    continue

                # Insert email
                self._insert_email(email, "inbound")
                new_count += 1

                # Track newest for sync state
                if email.received_time:
                    if newest_time is None or email.received_time > newest_time:
                        newest_time = email.received_time

            # Update sync state
            if newest_time:
                self._update_sync_state("inbox", newest_time)

            logger.info(f"Synced {new_count} new emails from inbox")
            return new_count

        except Exception as e:
            logger.exception(f"Outlook sync error: {e}")
            return 0

    def _get_last_sync(self, folder: str) -> Optional[datetime]:
        """Get last sync time for a folder."""
        result = self.db.execute("""
            SELECT last_sync_at FROM email_sync_state
            WHERE folder = %s
            ORDER BY last_sync_at DESC LIMIT 1
        """, (folder,))

        if result and result[0].get("last_sync_at"):
            return result[0]["last_sync_at"]

        # Default: sync last 7 days
        return datetime.now(timezone.utc) - timedelta(days=7)

    def _email_exists(self, entry_id: str) -> bool:
        """Check if email already exists in database."""
        result = self.db.execute("""
            SELECT id FROM synced_emails WHERE outlook_entry_id = %s LIMIT 1
        """, (entry_id,))
        return bool(result)

    def _insert_email(self, email, direction: str):
        """Insert email into database and match to campaign contact."""
        # Extract recipient emails
        to_emails = [r.email for r in email.to if r.email] if email.to else []
        cc_emails = [r.email for r in email.cc if r.email] if email.cc else []

        # Match sender to campaign contact (for inbound)
        matched_company_id = None
        matched_contact_id = None

        if direction == "inbound" and email.sender_email:
            match = self.db.execute("""
                SELECT c.id as contact_id, c.company_id
                FROM contacts c
                WHERE LOWER(c.email) = LOWER(%s)
                LIMIT 1
            """, (email.sender_email,))

            if match:
                matched_contact_id = match[0]["contact_id"]
                matched_company_id = match[0]["company_id"]

        self.db.execute("""
            INSERT INTO synced_emails (
                outlook_entry_id, outlook_conversation_id, direction,
                from_email, from_name, to_emails, cc_emails,
                subject, body_text, body_html,
                received_at, sent_at, is_read, has_attachments,
                matched_contact_id, matched_company_id, synced_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()
            )
        """, (
            email.entry_id,
            email.conversation_id,
            direction,
            email.sender_email,
            email.sender_name,
            to_emails,
            cc_emails,
            email.subject,
            email.body[:50000] if email.body else None,
            email.html_body[:100000] if email.html_body else None,
            email.received_time,
            email.sent_time,
            email.is_read,
            email.has_attachments,
            matched_contact_id,
            matched_company_id
        ))

    def _update_sync_state(self, folder: str, sync_time: datetime):
        """Update sync state for a folder."""
        self.db.execute("""
            INSERT INTO email_sync_state (folder, last_sync_at, updated_at)
            VALUES (%s, %s, NOW())
            ON CONFLICT (folder) DO UPDATE SET
                last_sync_at = EXCLUDED.last_sync_at,
                updated_at = NOW()
        """, (folder, sync_time))


class ResponseLoop:
    """
    Handles email response classification and routing.

    Auto-actions:
    - bounce: Add to exclusions, stop sequence
    - hard_pass: Add to DNC, stop sequence
    - soft_pass: Add to nurture, pause sequence
    - broker_redirect: Log broker, stop sequence

    Human review:
    - interested: Flag for qualify-agent (later)
    - pricing_given: Extract data, flag for review
    - question: Flag for human answer
    - referral: Flag for new contact creation
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        db: Optional[Database] = None
    ):
        self.config = config or get_config()
        self.db = db or get_db()

    async def process_unclassified_emails(self) -> int:
        """
        Process all unclassified inbound emails.

        Returns number of emails processed.
        """
        emails = self._get_unclassified_emails()
        processed = 0

        for email in emails:
            try:
                # Skip system emails automatically
                if should_skip_email(email.get("from_email", ""), email.get("subject", "")):
                    self._mark_as_system(email["id"])
                    processed += 1
                    continue

                await self.classify_and_route(email)
                processed += 1
            except Exception as e:
                logger.exception(f"Error processing email {email['id']}: {e}")

        return processed

    def _get_unclassified_emails(self) -> List[Dict[str, Any]]:
        """Get unclassified inbound emails matched to campaigns."""
        return self.db.execute("""
            SELECT id, from_email, from_name, subject, body_text,
                   matched_company_id, matched_contact_id
            FROM synced_emails
            WHERE classification IS NULL
              AND direction = 'inbound'
              AND matched_company_id IS NOT NULL
            ORDER BY received_at DESC
            LIMIT 10
        """) or []

    def _mark_as_system(self, email_id: str):
        """Mark email as system/newsletter (auto-skip)."""
        self.db.execute("""
            UPDATE synced_emails
            SET classification = 'system',
                classification_confidence = 1.0,
                classified_at = NOW()
            WHERE id = %s
        """, (email_id,))

    async def classify_and_route(self, email: dict):
        """
        Classify an email using Claude Code headless and route based on category.
        """
        email_id = email["id"]
        from_email = email.get("from_email", "")
        from_name = email.get("from_name", "")

        logger.info(f"Classifying email {email_id} from {from_name} <{from_email}>")

        # Build classification prompt
        prompt = f"""Classify this CRE email response. Return ONLY JSON, no markdown.

From: {from_name} <{from_email}>
Subject: {email.get('subject', '')}
Body:
{(email.get('body_text') or '')[:2000]}

Classifications:
- interested: Wants to engage, asks questions, requests info
- pricing_given: Mentions specific price, cap rate, or terms
- question: Has questions but unclear on interest
- referral: Refers to another person/contact
- broker_redirect: Says to contact their broker
- soft_pass: Not now, maybe later, timing not right
- hard_pass: Explicit no, never contact again
- bounce: Email failed to deliver, mailbox full, etc.

Return JSON: {{"category": "...", "confidence": 0.0-1.0, "extracted_data": {{}}}}"""

        # Run Claude Code headless
        response = run_claude_headless(prompt, timeout=60)

        if not response:
            logger.error(f"Classification failed for email {email_id}")
            self._mark_for_manual_review(email_id, "Classification failed")
            return

        # Parse classification result
        classification = self._parse_classification(response)

        if not classification:
            logger.warning(f"Could not parse classification for email {email_id}")
            self._mark_for_manual_review(email_id, "Could not parse classification")
            return

        category = classification.get("category", "unknown")
        confidence = classification.get("confidence", 0)

        logger.info(f"Email {email_id} classified as {category} ({confidence:.0%})")

        # Update email with classification
        self.db.execute("""
            UPDATE synced_emails
            SET classification = %s,
                classification_confidence = %s,
                classified_at = NOW()
            WHERE id = %s
        """, (category, confidence, email_id))

        # Route based on category
        await self._route_by_category(email, classification)

    async def _route_by_category(self, email: dict, classification: dict):
        """Route email based on its classification category."""
        category = classification.get("category", "unknown")
        confidence = classification.get("confidence", 0)

        # Low confidence -> manual review
        if confidence < 0.7:
            logger.info(f"Low confidence ({confidence:.0%}), flagging for review")
            await self._flag_for_review(email, classification, "Low confidence classification")
            return

        # Map categories to handlers
        handlers = {
            "bounce": self._handle_bounce,
            "hard_pass": self._handle_hard_pass,
            "soft_pass": self._handle_soft_pass,
            "broker_redirect": self._handle_broker_redirect,
        }

        handler = handlers.get(category)
        if handler:
            await handler(email, classification)
        elif category in REVIEW_CATEGORIES:
            await self._flag_for_review(email, classification)
        else:
            logger.warning(f"Unknown category: {category}")
            await self._flag_for_review(email, classification, f"Unknown category: {category}")

    async def _handle_bounce(self, email: dict, classification: dict):
        """
        Handle bounced email.

        Actions:
        - Add email to exclusions (permanent)
        - Stop any active sequence for this contact
        """
        from_email = email.get("from_email", "")
        logger.info(f"Handling bounce for {from_email}")

        # Add to exclusions
        self.db.execute("""
            INSERT INTO email_exclusions (email, reason, source_email_id, created_at)
            VALUES (%s, 'bounce', %s, NOW())
            ON CONFLICT (email) DO NOTHING
        """, (from_email.lower(), email["id"]))

        # Stop sequence
        await self._stop_sequence_for_email(from_email)

        logger.info(f"Bounce handled: {from_email} added to exclusions")

    async def _handle_hard_pass(self, email: dict, classification: dict):
        """
        Handle hard pass (explicit rejection).

        Actions:
        - Add to DNC list
        - Update company status to 'dnc'
        - Stop any active sequence
        """
        from_email = email.get("from_email", "")
        company_id = email.get("matched_company_id")

        logger.info(f"Handling hard pass for {from_email}")

        if company_id:
            # Add to DNC
            self.db.execute("""
                INSERT INTO dnc_entries (company_id, reason, source, source_email_id, added_at)
                VALUES (%s, 'hard_pass', 'email_response', %s, NOW())
                ON CONFLICT (company_id) DO NOTHING
            """, (company_id, email["id"]))

            # Update company status
            self.db.execute("""
                UPDATE companies SET status = 'dnc', updated_at = NOW()
                WHERE id = %s
            """, (company_id,))

        # Stop sequence
        await self._stop_sequence_for_email(from_email)

        logger.info(f"Hard pass handled: {from_email} added to DNC")

    async def _handle_soft_pass(self, email: dict, classification: dict):
        """
        Handle soft pass (not now, maybe later).

        Actions:
        - Update company status to 'nurture'
        - Pause (not stop) the sequence
        - Create follow-up task for later
        """
        from_email = email.get("from_email", "")
        company_id = email.get("matched_company_id")

        logger.info(f"Handling soft pass for {from_email}")

        if company_id:
            # Update company status to nurture
            self.db.execute("""
                UPDATE companies SET status = 'nurture', updated_at = NOW()
                WHERE id = %s
            """, (company_id,))

        # Pause sequence (can be resumed later)
        await self._pause_sequence_for_email(from_email)

        # Create follow-up task
        self.db.execute("""
            INSERT INTO tasks (task_type, title, description, company_id, status, due_at, created_at)
            VALUES ('nurture_followup', %s, %s, %s, 'pending', %s, NOW())
        """, (
            f"Follow up with {email.get('from_name', from_email)}",
            f"Soft pass received. Follow up in 3-6 months.",
            company_id,
            (datetime.now(timezone.utc) + timedelta(days=90))
        ))

        logger.info(f"Soft pass handled: {from_email} moved to nurture")

    async def _handle_broker_redirect(self, email: dict, classification: dict):
        """
        Handle broker redirect.

        Actions:
        - Log broker info (useful data)
        - Stop sequence (don't pursue owner via broker)
        """
        from_email = email.get("from_email", "")
        company_id = email.get("matched_company_id")

        logger.info(f"Handling broker redirect for {from_email}")

        # Extract broker info if available
        broker_info = classification.get("extracted_data", {})

        if company_id:
            # Update company with broker info
            self.db.execute("""
                UPDATE companies
                SET status = 'broker_listed',
                    notes = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (f"Broker redirect: {broker_info.get('broker_name', 'Unknown')}", company_id))

        # Stop sequence
        await self._stop_sequence_for_email(from_email)

        logger.info(f"Broker redirect handled for {from_email}")

    async def _flag_for_review(
        self,
        email: dict,
        classification: dict,
        reason: Optional[str] = None
    ):
        """
        Flag email for human review.

        Creates a task in the review queue.
        """
        from_email = email.get("from_email", "")
        category = classification.get("category", "unknown")

        logger.info(f"Flagging email {email['id']} for review ({category})")

        # Create review task
        priority = "high" if category in ("interested", "pricing_given") else "normal"
        self.db.execute("""
            INSERT INTO tasks (task_type, title, description, company_id, status, priority, created_at)
            VALUES ('email_review', %s, %s, %s, 'pending', %s, NOW())
        """, (
            f"Review: {category} from {email.get('from_name', from_email)}",
            reason or f"Response classified as {category}",
            email.get("matched_company_id"),
            priority
        ))

    async def _update_sequence_status(self, email_address: str, status: str):
        """Update sequence status for all contacts with this email."""
        if not email_address:
            return

        # Update all active subscriptions for this email
        self.db.execute("""
            UPDATE sequence_subscriptions
            SET status = %s,
                completed_at = NOW(),
                updated_at = NOW()
            WHERE contact_id IN (
                SELECT id FROM contacts WHERE LOWER(email) = LOWER(%s)
            )
            AND status = 'active'
        """, (status, email_address))

        logger.debug(f"Updated sequence status to {status} for {email_address}")

    async def _stop_sequence_for_email(self, email_address: str):
        """Stop any active sequence for this email address."""
        await self._update_sequence_status(email_address, "replied")

    async def _pause_sequence_for_email(self, email_address: str):
        """Pause any active sequence for this email address."""
        await self._update_sequence_status(email_address, "paused")

    def _mark_for_manual_review(self, email_id: str, reason: str):
        """Mark email as needing manual review."""
        self.db.execute("""
            UPDATE synced_emails
            SET needs_manual_review = true,
                updated_at = NOW()
            WHERE id = %s
        """, (email_id,))

    def _parse_classification(self, output: str) -> Optional[dict]:
        """
        Parse classification result from agent output.

        Expected format:
        {
            "category": "interested",
            "confidence": 0.92,
            "extracted_data": {
                "asking_price": 21900000,
                "cap_rate": 0.06
            }
        }
        """
        # Try to extract JSON from output
        try:
            # Look for JSON block
            json_match = re.search(r'\{[^{}]*"category"[^{}]*\}', output, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())

            # Try full output as JSON
            return json.loads(output)
        except json.JSONDecodeError:
            pass

        # Fallback: extract category from text
        output_lower = output.lower()
        for cat in CATEGORIES:
            if cat in output_lower:
                # Try to extract confidence
                confidence = 0.5
                conf_match = re.search(r'(\d+(?:\.\d+)?)\s*%', output)
                if conf_match:
                    confidence = float(conf_match.group(1)) / 100

                return {"category": cat, "confidence": confidence}

        return None


# For Supabase Realtime integration


class RealtimeResponseHandler:
    """
    Handler for Supabase Realtime events on synced_emails table.

    Usage:
        handler = RealtimeResponseHandler()
        supabase.channel('email_sync')
            .on('postgres_changes', {
                'event': 'INSERT',
                'schema': 'public',
                'table': 'synced_emails'
            }, handler.on_new_email)
            .subscribe()
    """

    def __init__(self):
        self.response_loop = ResponseLoop()

    async def on_new_email(self, payload: dict):
        """
        Handle new email inserted into synced_emails.

        Called by Supabase Realtime on INSERT.
        """
        email = payload.get("new", {})

        if not email:
            return

        # Only process inbound emails matched to a campaign
        if email.get("direction") != "inbound":
            return

        if not email.get("matched_company_id"):
            # Not a campaign reply
            return

        logger.info(f"Realtime: New campaign reply from {email.get('from_email')}")

        try:
            await self.response_loop.classify_and_route(email)
        except Exception as e:
            logger.exception(f"Error processing realtime email: {e}")


# Claude Code headless integration
import os

CLAUDE_CLI = os.path.expanduser("~/.claude/local/node_modules/.bin/claude.cmd")


def run_claude_headless(prompt: str, timeout: int = 180) -> Optional[str]:
    """
    Run Claude Code in headless mode.

    Returns the response text or None on error.

    IMPORTANT: Must use shell=False and pass prompt via stdin (-p -)
    to avoid issues with multiline prompts on Windows.
    """
    try:
        # Use Popen for better control over stdin
        proc = subprocess.Popen(
            [CLAUDE_CLI, "-p", "-", "--output-format", "text"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            stdin=subprocess.PIPE,
            text=True,
            shell=False,  # CRITICAL: must be False on Windows
            cwd=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )

        try:
            stdout, stderr = proc.communicate(input=prompt, timeout=timeout)

            if proc.returncode == 0:
                return stdout.strip()
            else:
                logger.error(f"Claude error (code {proc.returncode}): {stderr}")
                return None

        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()  # Clean up
            logger.error(f"Claude timeout after {timeout}s")
            return None

    except FileNotFoundError:
        logger.error("Claude CLI not found")
        return None
    except Exception as e:
        logger.error(f"Claude error: {e}")
        return None


async def run_response_loop(config: Optional[Config] = None):
    """
    Run the response loop continuously.

    Syncs inbox and classifies emails every 5 minutes.
    """
    sync = EmailSync()
    loop = ResponseLoop(config=config)

    logger.info("Response loop started (5 min interval)")

    while True:
        try:
            # 1. Sync inbox
            new_emails = await sync.sync_inbox(limit=50)

            # 2. Classify unclassified emails
            if new_emails > 0:
                processed = await loop.process_unclassified_emails()
                logger.info(f"Response cycle: {new_emails} synced, {processed} classified")

        except Exception as e:
            logger.exception(f"Response loop error: {e}")

        await asyncio.sleep(300)  # 5 minutes
