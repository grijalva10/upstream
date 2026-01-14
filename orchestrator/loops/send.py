"""
Send Loop - Executes email sends with proper spacing.

Runs every 30 seconds to check for due emails and send with 30-90s gaps.
Respects send windows (9am-5pm Mon-Fri) and batch limits.
"""
import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from ..config import Config, get_config
from ..db import Database, get_db

logger = logging.getLogger(__name__)


class SendLoop:
    """
    Handles email sending with proper spacing and rate limiting.

    Features:
    - 30-90 second random delays between emails
    - Batch pauses (5 min after every 50 emails)
    - Send window enforcement (9am-5pm Mon-Fri)
    - Outlook COM integration for actual sends
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        db: Optional[Database] = None
    ):
        self.config = config or get_config()
        self.db = db or get_db()
        self._emails_sent_this_batch = 0
        self._last_send_time: Optional[datetime] = None
        self._batch_pause_until: Optional[datetime] = None

    def is_within_send_window(self) -> bool:
        """Check if current time is within send window."""
        now = datetime.now()

        # Check weekday (0=Mon, 6=Sun)
        if now.weekday() >= 5:  # Saturday or Sunday
            return False

        # Check hour (9am-5pm)
        if now.hour < 9 or now.hour >= 17:
            return False

        return True

    def get_next_send_window(self) -> datetime:
        """Get the next available send window start time."""
        now = datetime.now()

        # Start with 9am today
        next_window = now.replace(hour=9, minute=0, second=0, microsecond=0)

        # If we're past today's window, move to tomorrow
        if now.hour >= 17:
            next_window += timedelta(days=1)

        # Skip weekends
        while next_window.weekday() >= 5:
            next_window += timedelta(days=1)

        return next_window

    def should_pause_for_batch(self) -> bool:
        """Check if we should pause due to batch limit."""
        if self._batch_pause_until:
            if datetime.now() < self._batch_pause_until:
                return True
            else:
                # Pause is over, reset
                self._batch_pause_until = None
                self._emails_sent_this_batch = 0

        return False

    def get_required_delay(self, sequence_schedule: Dict) -> float:
        """Calculate required delay before next send based on schedule spacing."""
        if not self._last_send_time:
            return 0

        spacing = sequence_schedule.get("spacing", {})
        min_delay = spacing.get("min_delay_seconds", 30)
        max_delay = spacing.get("max_delay_seconds", 90)

        # Random delay within range
        required_delay = random.uniform(min_delay, max_delay)

        # Calculate actual time since last send
        elapsed = (datetime.now() - self._last_send_time).total_seconds()

        # Return remaining delay needed
        return max(0, required_delay - elapsed)

    async def process_due_emails(self) -> int:
        """
        Process all emails due to be sent.

        Returns number of emails sent.
        """
        # Check send window
        if not self.is_within_send_window():
            next_window = self.get_next_send_window()
            logger.debug(f"Outside send window. Next window: {next_window}")
            return 0

        # Check batch pause
        if self.should_pause_for_batch():
            remaining = (self._batch_pause_until - datetime.now()).total_seconds()
            logger.debug(f"Batch pause active. {remaining:.0f}s remaining")
            return 0

        # Get due subscriptions
        subscriptions = self._get_due_subscriptions()

        if not subscriptions:
            return 0

        logger.info(f"Found {len(subscriptions)} emails due to send")

        sent_count = 0

        for sub in subscriptions:
            # Check batch limit
            batch_size = sub.get("sequence", {}).get("schedule", {}).get("spacing", {}).get("batch_size", 50)
            if self._emails_sent_this_batch >= batch_size:
                pause_minutes = sub.get("sequence", {}).get("schedule", {}).get("spacing", {}).get("batch_pause_minutes", 5)
                self._batch_pause_until = datetime.now() + timedelta(minutes=pause_minutes)
                logger.info(f"Batch limit reached ({batch_size}). Pausing for {pause_minutes} minutes")
                break

            # Check spacing delay
            schedule = sub.get("sequence", {}).get("schedule", {})
            delay = self.get_required_delay(schedule)

            if delay > 0:
                logger.debug(f"Waiting {delay:.1f}s before next send")
                await asyncio.sleep(delay)

            # Send the email
            try:
                success = await self._send_email(sub)
                if success:
                    sent_count += 1
                    self._emails_sent_this_batch += 1
                    self._last_send_time = datetime.now()
            except Exception as e:
                logger.exception(f"Error sending email for subscription {sub['id']}: {e}")

        return sent_count

    def _get_due_subscriptions(self) -> List[Dict[str, Any]]:
        """Get subscriptions with emails due to send."""
        result = self.db.execute("""
            SELECT
                ss.id,
                ss.contact_id,
                ss.property_id,
                ss.sequence_id,
                ss.current_step_id,
                ss.emails_sent,
                ss.last_email_at,
                c.email as contact_email,
                c.name as contact_name,
                co.id as company_id,
                co.name as company_name,
                p.address as property_address,
                p.building_size_sqft,
                p.lot_size_acres,
                p.property_type,
                m.name as market_name,
                s.name as sequence_name,
                s.schedule as sequence_schedule,
                st.id as step_id,
                st.step_order,
                st.delay_seconds,
                et.subject as template_subject,
                et.body_text as template_body
            FROM sequence_subscriptions ss
            JOIN contacts c ON ss.contact_id = c.id
            JOIN companies co ON c.company_id = co.id
            LEFT JOIN properties p ON ss.property_id = p.id
            LEFT JOIN markets m ON p.market_id = m.id
            JOIN sequences s ON ss.sequence_id = s.id
            JOIN sequence_steps st ON ss.current_step_id = st.id
            JOIN email_templates et ON st.email_template_id = et.id
            WHERE ss.status = 'active'
              AND (ss.awaiting_approval = false OR ss.awaiting_approval IS NULL)
              AND (
                  -- First email: send immediately if no emails sent yet
                  (ss.emails_sent = 0 OR ss.emails_sent IS NULL)
                  OR
                  -- Follow-up: check if delay has passed
                  (ss.last_email_at + (st.delay_seconds || ' seconds')::interval) <= NOW()
              )
            ORDER BY ss.started_at
            LIMIT 10
        """)

        return result or []

    async def _send_email(self, subscription: Dict[str, Any]) -> bool:
        """
        Send a single email via Outlook COM.

        Returns True if sent successfully.
        """
        contact_email = subscription.get("contact_email")
        contact_name = subscription.get("contact_name", "")

        if not contact_email:
            logger.warning(f"No email for subscription {subscription['id']}")
            return False

        # Render template with merge tags
        subject = self._render_template(subscription.get("template_subject", ""), subscription)
        body = self._render_template(subscription.get("template_body", ""), subscription)

        logger.info(f"Sending to {contact_email}: {subject[:50]}...")

        # Check for dry run mode
        if self.config.dry_run:
            logger.info(f"[DRY RUN] Would send to {contact_email}")
            self._update_subscription_after_send(subscription)
            return True

        # Actually send via Outlook
        try:
            from integrations.outlook import OutlookClient

            client = OutlookClient()
            client.email.send(
                to=contact_email,
                subject=subject,
                body=body,
                html=False  # Plain text for now
            )

            # Update subscription
            self._update_subscription_after_send(subscription)

            # Log activity
            self._log_activity(subscription, subject, body)

            logger.info(f"Sent successfully to {contact_email}")
            return True

        except ImportError:
            logger.error("Outlook integration not available")
            return False
        except Exception as e:
            logger.exception(f"Failed to send to {contact_email}: {e}")
            return False

    def _render_template(self, template: str, data: Dict[str, Any]) -> str:
        """Render template with merge tags."""
        if not template:
            return ""

        # Extract first name from contact name
        contact_name = data.get("contact_name", "")
        first_name = contact_name.split()[0] if contact_name else ""

        # Get land acres (already in acres in DB)
        land_acres = data.get("lot_size_acres") or 0
        land_acres_str = f"{land_acres:.1f}" if land_acres else ""

        # Format building SF
        building_sf = data.get("building_size_sqft") or 0
        building_sf_formatted = f"{building_sf:,}" if building_sf else ""

        # Replace merge tags
        replacements = {
            "{{first_name}}": first_name,
            "{{property_address}}": data.get("property_address", ""),
            "{{building_sf}}": building_sf_formatted,
            "{{land_acres}}": land_acres_str,
            "{{market}}": data.get("market_name", ""),
            "{{property_type}}": data.get("property_type", ""),
            "{{company_name}}": data.get("company_name", ""),
        }

        result = template
        for tag, value in replacements.items():
            result = result.replace(tag, str(value))

        return result

    def _update_subscription_after_send(self, subscription: Dict[str, Any]):
        """Update subscription after successful send."""
        sub_id = subscription["id"]
        current_step_order = subscription.get("step_order", 1)
        emails_sent = (subscription.get("emails_sent") or 0) + 1

        # Get next step
        next_step = self.db.execute("""
            SELECT id FROM sequence_steps
            WHERE sequence_id = %s AND step_order = %s
        """, (subscription["sequence_id"], current_step_order + 1))

        if next_step:
            # Move to next step
            self.db.execute("""
                UPDATE sequence_subscriptions
                SET current_step_id = %s,
                    emails_sent = %s,
                    last_email_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
            """, (next_step[0]["id"], emails_sent, sub_id))
        else:
            # Sequence complete
            self.db.execute("""
                UPDATE sequence_subscriptions
                SET status = 'completed',
                    emails_sent = %s,
                    last_email_at = NOW(),
                    completed_at = NOW(),
                    updated_at = NOW()
                WHERE id = %s
            """, (emails_sent, sub_id))
            logger.info(f"Subscription {sub_id} completed (all steps sent)")

    def _log_activity(self, subscription: Dict[str, Any], subject: str, body: str):
        """Log email send activity."""
        self.db.execute("""
            INSERT INTO activities (
                activity_type, contact_id, company_id, property_id,
                subject, body_text, direction, sequence_subscription_id, activity_at
            ) VALUES (
                'email_sent', %s, %s, %s, %s, %s, 'outbound', %s, NOW()
            )
        """, (
            subscription.get("contact_id"),
            subscription.get("company_id"),
            subscription.get("property_id"),
            subject,
            body[:500],
            subscription.get("id")
        ))


async def run_send_loop(config: Optional[Config] = None):
    """
    Run the send loop continuously.

    Checks every 30 seconds for emails to send.
    """
    loop = SendLoop(config=config)

    logger.info("Send loop started (30s interval)")

    while True:
        try:
            sent = await loop.process_due_emails()
            if sent > 0:
                logger.info(f"Send cycle complete: {sent} emails sent")
        except Exception as e:
            logger.exception(f"Send loop error: {e}")

        await asyncio.sleep(30)
