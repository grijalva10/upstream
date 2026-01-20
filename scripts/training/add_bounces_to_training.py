#!/usr/bin/env python3
"""
Add bounced emails to training data with pre-labeled 'bounce' classification.
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path


def main():
    # Load existing training data
    training_path = Path("output/classifier_training_data.json")
    with open(training_path, encoding="utf-8") as f:
        training_data = json.load(f)

    print(f"Existing training records: {len(training_data)}")

    # Connect to database
    conn = psycopg2.connect(
        host="127.0.0.1",
        port=55322,
        database="postgres",
        user="postgres",
        password="postgres"
    )

    # Query bounce emails
    query = """
    SELECT
        id,
        outlook_conversation_id,
        subject,
        body_text,
        from_email,
        from_name,
        received_at
    FROM synced_emails
    WHERE direction = 'inbound'
      AND (
        body_text ILIKE '%%delivery%%failed%%'
        OR body_text ILIKE '%%undeliverable%%'
        OR body_text ILIKE '%%mailbox not found%%'
        OR body_text ILIKE '%%address rejected%%'
        OR body_text ILIKE '%%550 5.1.1%%'
        OR body_text ILIKE '%%unknown user%%'
        OR body_text ILIKE '%%user unknown%%'
        OR from_email ILIKE '%%mailer-daemon%%'
        OR from_email ILIKE '%%postmaster%%'
      )
    ORDER BY received_at DESC
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query)
        bounces = cur.fetchall()

    conn.close()

    print(f"Found {len(bounces)} bounce emails")

    # Add bounces to training data
    for bounce in bounces:
        record = {
            "campaign_id": bounce["outlook_conversation_id"],
            "outreach_subject": "N/A - Bounce",
            "outreach_body": "N/A - Original outreach not linked",
            "outreach_sent_at": None,
            "reply_id": str(bounce["id"]),
            "reply_from_name": bounce["from_name"],
            "reply_from_email": bounce["from_email"],
            "reply_body": bounce["body_text"][:3000] if bounce["body_text"] else "",
            "reply_received_at": bounce["received_at"].isoformat() if bounce["received_at"] else None,
            "classification": "bounce",  # Pre-labeled!
            "confidence": 1.0,  # High confidence - these are definitely bounces
            "notes": "Auto-labeled from bounce detection patterns"
        }
        training_data.append(record)

    # Save updated training data
    with open(training_path, "w", encoding="utf-8") as f:
        json.dump(training_data, f, indent=2, ensure_ascii=False)

    print(f"Updated training data: {len(training_data)} total records")

    # Count by classification
    by_class = {}
    for r in training_data:
        c = r.get("classification") or "unlabeled"
        by_class[c] = by_class.get(c, 0) + 1

    print("\nBy classification:")
    for c, count in sorted(by_class.items()):
        print(f"  {c}: {count}")


if __name__ == "__main__":
    main()
