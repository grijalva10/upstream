#!/usr/bin/env python3
"""
Mark contacts as bounced based on bounce emails in synced_emails.

Finds bounce notifications (Undeliverable, Delivery Failure, etc.) and:
1. Matches them to original outbound emails via conversation_id
2. Updates the contact's status to 'bounced'
3. Marks the bounce email as classified='bounce'
"""

import psycopg2
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'


def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Find bounces and match to original outbound emails
    cur.execute("""
        SELECT
            b.id as bounce_id,
            b.subject as bounce_subject,
            o.id as orig_email_id,
            o.to_emails,
            o.matched_contact_id
        FROM synced_emails b
        LEFT JOIN synced_emails o ON b.outlook_conversation_id = o.outlook_conversation_id
            AND o.direction = 'outbound'
        WHERE (
            b.subject ILIKE '%undeliver%'
            OR b.subject ILIKE '%delivery%fail%'
            OR b.subject ILIKE '%delivery status%'
            OR b.from_email ILIKE '%mailer-daemon%'
            OR b.from_email ILIKE '%postmaster%'
        )
        AND b.classification IS DISTINCT FROM 'bounce'
    """)

    bounces = cur.fetchall()
    logger.info(f"Found {len(bounces)} bounce emails to process")

    contacts_marked = 0
    emails_classified = 0

    for bounce_id, bounce_subject, orig_email_id, to_emails, matched_contact_id in bounces:
        logger.info(f"Processing bounce: {bounce_subject[:60]}...")

        # Mark the bounce email as classified
        cur.execute("""
            UPDATE synced_emails
            SET classification = 'bounce',
                classified_at = NOW(),
                classified_by = 'mark_bounces.py'
            WHERE id = %s
        """, (bounce_id,))
        emails_classified += 1

        # Find the contact to mark as bounced
        contact_id = None
        contact_email = None

        # First try matched_contact_id from original email
        if matched_contact_id:
            contact_id = matched_contact_id
        # Otherwise try to match via to_emails
        elif to_emails and len(to_emails) > 0:
            email = to_emails[0]
            cur.execute("SELECT id FROM contacts WHERE LOWER(email) = LOWER(%s)", (email,))
            row = cur.fetchone()
            if row:
                contact_id = row[0]
                contact_email = email

        if contact_id:
            # Update contact status to bounced
            cur.execute("""
                UPDATE contacts
                SET status = 'bounced', updated_at = NOW()
                WHERE id = %s AND status != 'bounced'
            """, (contact_id,))

            if cur.rowcount > 0:
                contacts_marked += 1
                logger.info(f"  Marked contact as bounced: {contact_email or contact_id}")
            else:
                logger.info(f"  Contact already bounced: {contact_email or contact_id}")
        else:
            logger.warning(f"  Could not find contact for bounce")

    conn.commit()
    cur.close()
    conn.close()

    logger.info(f"\n{'='*50}")
    logger.info("BOUNCE PROCESSING COMPLETE")
    logger.info(f"{'='*50}")
    logger.info(f"Bounce emails classified: {emails_classified}")
    logger.info(f"Contacts marked as bounced: {contacts_marked}")


if __name__ == "__main__":
    main()
