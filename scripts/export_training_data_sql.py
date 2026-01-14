#!/usr/bin/env python3
"""
Export training data using direct SQL queries.
"""

import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from psycopg2.extras import RealDictCursor


def clean_body(body: str) -> str:
    """Clean email body - remove external sender warnings."""
    if not body:
        return ""

    # Remove external sender warnings
    lines = body.split('\n')
    cleaned = []
    skip = 0

    for line in lines:
        if skip > 0:
            skip -= 1
            continue
        if 'External Sender:' in line:
            skip = 2
            continue
        if 'Warning: The sender of this email could not be validated' in line:
            skip = 1
            continue
        cleaned.append(line)

    text = '\n'.join(cleaned).strip()

    # Normalize whitespace
    while '\n\n\n' in text:
        text = text.replace('\n\n\n', '\n\n')
    while '\r\n\r\n\r\n' in text:
        text = text.replace('\r\n\r\n\r\n', '\r\n\r\n')

    return text


def main():
    # Connect to local Supabase PostgreSQL
    conn = psycopg2.connect(
        host="127.0.0.1",
        port=55322,
        database="postgres",
        user="postgres",
        password="postgres"
    )

    query = """
    WITH outreach AS (
        SELECT
            id,
            outlook_conversation_id,
            subject,
            body_text,
            sent_at
        FROM synced_emails
        WHERE direction = 'outbound'
          AND subject NOT ILIKE 'RE:%%'
          AND subject NOT ILIKE 'FW:%%'
          AND (
            body_text ILIKE '%%acquisition parameters%%'
            OR body_text ILIKE '%%aligns with my client%%'
            OR body_text ILIKE '%%buyer is actively%%'
            OR body_text ILIKE '%%institutional buyer%%'
            OR body_text ILIKE '%%off-market%%'
          )
    ),
    replies AS (
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
          AND from_email NOT LIKE '%%lee-associates.com'
    )
    SELECT
        o.outlook_conversation_id as campaign_id,
        o.subject as outreach_subject,
        o.body_text as outreach_body,
        o.sent_at as outreach_sent_at,
        r.id as reply_id,
        r.from_name as reply_from_name,
        r.from_email as reply_from_email,
        r.body_text as reply_body,
        r.received_at as reply_received_at
    FROM outreach o
    JOIN replies r ON o.outlook_conversation_id = r.outlook_conversation_id
    ORDER BY r.received_at DESC
    """

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query)
        rows = cur.fetchall()

    conn.close()

    # Process and clean data
    training_data = []
    for row in rows:
        record = {
            "campaign_id": row["campaign_id"],
            "outreach_subject": row["outreach_subject"],
            "outreach_body": clean_body(row["outreach_body"] or ""),
            "outreach_sent_at": row["outreach_sent_at"].isoformat() if row["outreach_sent_at"] else None,
            "reply_id": str(row["reply_id"]),
            "reply_from_name": row["reply_from_name"],
            "reply_from_email": row["reply_from_email"],
            "reply_body": clean_body(row["reply_body"] or ""),
            "reply_received_at": row["reply_received_at"].isoformat() if row["reply_received_at"] else None,
            "classification": None,  # To be labeled
            "confidence": None,
            "notes": None
        }
        training_data.append(record)

    # Save to file
    output_path = Path("output/classifier_training_data.json")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(training_data, f, indent=2, ensure_ascii=False)

    print(f"Exported {len(training_data)} training records")
    print(f"Unique campaigns: {len(set(r['campaign_id'] for r in training_data))}")
    print(f"Saved to: {output_path}")

    # Show samples
    print("\n" + "="*70)
    print("SAMPLE TRAINING DATA")
    print("="*70)

    for i, r in enumerate(training_data[:10]):
        print(f"\n--- {i+1}. {r['outreach_subject'][:60]} ---")
        print(f"    From: {r['reply_from_name']} <{r['reply_from_email']}>")
        body = r['reply_body'][:200].replace('\r\n', ' ').replace('\n', ' ')
        print(f"    Reply: {body}...")


if __name__ == "__main__":
    main()
