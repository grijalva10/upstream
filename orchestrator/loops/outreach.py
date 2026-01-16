"""
Outreach Loop - From searches to campaign execution.

Flow:
1. Search -> Sourcing Agent -> Payloads + Strategy
2. [CHECKPOINT 1: Extraction] - Requires 2FA
3. Campaign Scheduling (rules-based V1)
4. [CHECKPOINT 2: Campaign Approval]
5. Email Execution (pre-scheduled sends)

NOTE: This module uses the NEW searches-based schema:
- searches (replaces client_criteria)
- search_properties (replaces list_properties)
"""
import logging
import random
from datetime import datetime, timedelta
from typing import Optional

from ..agents.runner import AgentRunner, get_runner
from ..config import Config, get_config
from ..db import Database, get_db

logger = logging.getLogger(__name__)


class OutreachLoop:
    """
    Handles the outreach pipeline from search input to email sends.
    """

    def __init__(
        self,
        config: Optional[Config] = None,
        db: Optional[Database] = None,
        runner: Optional[AgentRunner] = None
    ):
        self.config = config or get_config()
        self.db = db or get_db()
        self.runner = runner or get_runner()

    async def process_pending_searches(self) -> int:
        """
        Process searches awaiting query generation.

        Returns number of searches processed.
        """
        searches = self.db.get_pending_searches()
        processed = 0

        for search in searches:
            try:
                await self._process_single_search(search)
                processed += 1
            except Exception as e:
                logger.exception(f"Error processing search {search['id']}: {e}")

        return processed

    async def _process_single_search(self, search: dict):
        """Process a single search through sourcing agent."""
        search_id = search["id"]

        logger.info(f"Processing search {search_id}: {search.get('name')}")

        # Run sourcing agent
        result = self.runner.run_sourcing(
            criteria=search.get("criteria_json", {}),
            context={
                "search_id": search_id,
                "search_name": search.get("name"),
            }
        )

        if not result.success:
            logger.error(f"Sourcing failed for search {search_id}: {result.error}")
            return

        # Mark as ready for extraction (which requires 2FA)
        self.db.update_search_status(search_id, "awaiting_extraction")

        # Store the generated payloads
        self.db.table("searches").update({
            "payloads_json": result.output,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", search_id).execute()

        logger.info(f"Search {search_id} ready for extraction")

    async def process_extraction_results(self, search_id: str) -> Optional[dict]:
        """
        Process extraction results and create campaign schedule.

        Called after 2FA extraction completes.
        Returns campaign schedule if successful.
        """
        # Get search with related data
        result = self.db.table("searches") \
            .select("*") \
            .eq("id", search_id) \
            .single() \
            .execute()

        if not result.data:
            logger.error(f"Search {search_id} not found")
            return None

        search = result.data
        schedule = await self._create_campaign_schedule(search)

        if not schedule:
            logger.warning(f"No campaign schedule created for search {search_id}")
            return None

        # Check checkpoint mode
        mode = self.db.get_checkpoint_mode("campaign")

        if mode == "auto":
            # Auto-accept: activate campaign immediately
            await self._activate_campaign(search_id, schedule)
            logger.info(f"Campaign auto-activated for search {search_id}")
        else:
            # Queue for approval
            self.db.queue_for_approval(
                checkpoint="campaign",
                data={
                    "search_id": search_id,
                    "schedule": schedule
                },
                context={
                    "search_name": search.get("name"),
                    "contact_count": schedule.get("contact_count", 0),
                    "excluded_count": schedule.get("excluded_count", 0)
                }
            )
            self.db.update_search_status(search_id, "campaign_pending_approval")
            logger.info(f"Campaign queued for approval: {search_id}")

        return schedule

    async def _create_campaign_schedule(self, search: dict) -> Optional[dict]:
        """
        Create a campaign schedule for a search.

        Rules-based V1:
        - 3-email sequence
        - 2-3 day spacing
        - Exclude contacts in active campaigns
        - Stagger sends across business hours
        """
        search_id = search["id"]

        # Get contacts from search via search_properties -> properties -> companies -> contacts
        contacts = await self._get_search_contacts(search_id)

        if not contacts:
            logger.warning(f"No contacts with emails in search {search_id}")
            return None

        # Get contacts already in active campaigns
        active_contact_ids = await self._get_active_campaign_contacts()

        # Filter out overlapping contacts
        new_contacts = [c for c in contacts if c["id"] not in active_contact_ids]
        excluded_count = len(contacts) - len(new_contacts)

        if not new_contacts:
            logger.warning(f"All {len(contacts)} contacts already in active campaigns")
            return None

        logger.info(f"Campaign: {len(new_contacts)} contacts ({excluded_count} excluded for overlap)")

        # Create scheduled send times
        scheduled_contacts = self._schedule_sends(new_contacts)

        return {
            "search_id": search_id,
            "contact_count": len(new_contacts),
            "excluded_count": excluded_count,
            "total_emails": len(new_contacts) * 3,  # 3-email sequence
            "contacts": scheduled_contacts[:100],  # Preview first 100
            "sequence": {
                "length": 3,
                "intervals": [0, 3, 3],  # Day 0, +3 days, +3 days
                "templates": ["initial_outreach", "follow_up_1", "follow_up_2"]
            },
            "send_window": {
                "start_hour": self.config.send_window.start_hour,
                "end_hour": self.config.send_window.end_hour,
                "timezone": self.config.send_window.timezone,
                "weekdays_only": self.config.send_window.weekdays_only
            },
            "created_at": datetime.utcnow().isoformat()
        }

    async def _get_search_contacts(self, search_id: str) -> list[dict]:
        """Get all contacts with emails from a search via search_properties."""
        result = self.db.table("search_properties") \
            .select("""
                properties(
                    id,
                    address,
                    property_companies(
                        companies(
                            id,
                            name,
                            contacts(id, name, email, title)
                        )
                    )
                )
            """) \
            .eq("search_id", search_id) \
            .execute()

        contacts = []
        seen_emails: set[str] = set()

        for sp in result.data or []:
            prop = sp.get("properties", {})
            for pc in prop.get("property_companies", []):
                company = pc.get("companies", {})
                for contact in company.get("contacts", []):
                    email = contact.get("email")
                    if not email or email.lower() in seen_emails:
                        continue
                    seen_emails.add(email.lower())
                    contacts.append({
                        "id": contact["id"],
                        "name": contact.get("name"),
                        "email": email,
                        "title": contact.get("title"),
                        "company_id": company.get("id"),
                        "company_name": company.get("name"),
                        "property_id": prop.get("id"),
                        "property_address": prop.get("address")
                    })

        return contacts

    async def _get_active_campaign_contacts(self) -> set:
        """Get contact IDs already in active campaigns."""
        result = self.db.table("sequence_subscriptions") \
            .select("contact_id") \
            .eq("status", "active") \
            .execute()

        return {sub["contact_id"] for sub in result.data or []}

    def _schedule_sends(self, contacts: list[dict]) -> list[dict]:
        """
        Schedule send times for contacts.

        Staggers sends across business hours to avoid spam flags.
        """
        send_window = self.config.send_window
        now = datetime.utcnow()

        # Find next business day
        start_date = self._next_business_day(now)

        # Calculate how many we can send per day (respecting limits)
        daily_limit = min(
            self.config.send_limits.daily,
            len(contacts) // 3 + 1  # Spread across ~3 days minimum
        )

        scheduled = []
        current_date = start_date
        daily_count = 0

        for contact in contacts:
            if daily_count >= daily_limit:
                # Move to next business day
                current_date = self._next_business_day(current_date + timedelta(days=1))
                daily_count = 0

            # Random time within send window
            hour = random.randint(send_window.start_hour, send_window.end_hour - 1)
            minute = random.randint(0, 59)

            first_send = current_date.replace(hour=hour, minute=minute, second=0, microsecond=0)

            scheduled.append({
                **contact,
                "scheduled_sends": [
                    first_send.isoformat(),
                    self._next_business_day(first_send + timedelta(days=3)).isoformat(),
                    self._next_business_day(first_send + timedelta(days=6)).isoformat()
                ]
            })

            daily_count += 1

        return scheduled

    def _next_business_day(self, dt: datetime) -> datetime:
        """Get next business day (Mon-Fri). Returns dt unchanged if weekdays_only is False."""
        if not self.config.send_window.weekdays_only:
            return dt
        # Skip weekends (Saturday=5, Sunday=6)
        while dt.weekday() >= 5:
            dt += timedelta(days=1)
        return dt

    async def _activate_campaign(self, search_id: str, schedule: dict):
        """
        Activate a campaign by creating sequence subscriptions.

        Each contact gets enrolled in the sequence with scheduled send times.
        """
        # Get or create the sequence
        sequence = await self._get_or_create_sequence(search_id, schedule)

        if not sequence:
            logger.error(f"Could not create sequence for search {search_id}")
            return

        # Create subscriptions for each contact
        for contact in schedule.get("contacts", []):
            sends = contact.get("scheduled_sends", [])
            if not sends:
                continue

            # Create subscription
            self.db.table("sequence_subscriptions").insert({
                "sequence_id": sequence["id"],
                "contact_id": contact["id"],
                "status": "active",
                "current_step": 1,
                "next_step_at": sends[0],  # First email time
                "scheduled_sends": sends,
                "context": {
                    "company_name": contact.get("company_name"),
                    "property_address": contact.get("property_address"),
                    "search_id": search_id
                }
            }).execute()

        # Update search status
        self.db.update_search_status(search_id, "campaign_active")

        logger.info(f"Campaign activated: {len(schedule.get('contacts', []))} contacts enrolled")

    async def _get_or_create_sequence(self, search_id: str, schedule: dict) -> Optional[dict]:
        """Get or create a sequence for this campaign."""
        # Check if sequence already exists for this search
        result = self.db.table("sequences") \
            .select("*") \
            .eq("search_id", search_id) \
            .maybe_single() \
            .execute()

        if result.data:
            return result.data

        # Create new sequence
        seq_data = schedule.get("sequence", {})

        result = self.db.table("sequences").insert({
            "name": f"Campaign for search {search_id[:8]}",
            "search_id": search_id,
            "step_count": seq_data.get("length", 3),
            "status": "active",
            "timezone": schedule.get("send_window", {}).get("timezone", "America/Los_Angeles"),
            "stop_on_reply": True,
            "settings": schedule.get("send_window", {})
        }).execute()

        sequence = result.data[0] if result.data else None

        if sequence:
            # Create sequence steps
            for i, (interval, template) in enumerate(zip(
                seq_data.get("intervals", [0, 3, 3]),
                seq_data.get("templates", ["initial_outreach", "follow_up_1", "follow_up_2"])
            ), 1):
                self.db.table("sequence_steps").insert({
                    "sequence_id": sequence["id"],
                    "step_number": i,
                    "step_type": "email",
                    "delay_days": interval,
                    "template_name": template
                }).execute()

        return sequence

    async def send_due_emails(self) -> int:
        """
        Send emails that are due.

        Returns number of emails sent.
        """
        # Check send limits
        can_send, reason = self.db.can_send_email()
        if not can_send:
            logger.warning(f"Cannot send emails: {reason}")
            return 0

        # Get due emails
        due_emails = self.db.get_due_emails()
        sent_count = 0

        for subscription in due_emails:
            # Check limit before each send
            can_send, reason = self.db.can_send_email()
            if not can_send:
                logger.warning(f"Send limit reached during batch: {reason}")
                break

            try:
                await self._send_single_email(subscription)
                sent_count += 1
            except Exception as e:
                logger.exception(f"Error sending email for subscription {subscription['id']}: {e}")

        return sent_count

    async def _send_single_email(self, subscription: dict):
        """Send a single email for a subscription."""
        contact = subscription.get("contacts", {})
        sequence = subscription.get("sequences", {})

        if self.config.dry_run:
            logger.info(f"[DRY RUN] Would send email to {contact.get('email')}")
            self._advance_subscription(subscription)
            return

        # TODO: Actually send via Outlook COM
        # For now, just log and advance
        logger.info(f"[TODO] Sending email to {contact.get('email')} (step {subscription.get('current_step')})")

        # Log the activity
        self.db.table("activities").insert({
            "contact_id": contact.get("id"),
            "company_id": subscription.get("context", {}).get("company_id"),
            "activity_type": "email_sent",
            "activity_at": datetime.utcnow().isoformat(),
            "data": {
                "subscription_id": subscription["id"],
                "sequence_id": sequence.get("id"),
                "step": subscription.get("current_step")
            }
        }).execute()

        # Advance to next step
        self._advance_subscription(subscription)

    def _advance_subscription(self, subscription: dict):
        """Advance subscription to next step or complete."""
        current_step = subscription.get("current_step", 1)
        scheduled_sends = subscription.get("scheduled_sends", [])
        sequence = subscription.get("sequences", {})
        total_steps = sequence.get("step_count", 3)

        if current_step >= total_steps:
            # Complete the subscription
            self.db.update_subscription_status(subscription["id"], "completed")
            logger.info(f"Subscription {subscription['id']} completed")
        else:
            # Move to next step
            next_step = current_step + 1
            next_send = scheduled_sends[next_step - 1] if len(scheduled_sends) >= next_step else None

            self.db.table("sequence_subscriptions").update({
                "current_step": next_step,
                "next_step_at": next_send,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", subscription["id"]).execute()

            logger.info(f"Subscription {subscription['id']} advanced to step {next_step}")
