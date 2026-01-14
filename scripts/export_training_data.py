#!/usr/bin/env python3
"""
Export owner outreach campaigns with replies as training data for response classifier.

Outputs a JSON file with:
- campaign_id: conversation ID
- outreach_subject: subject of initial outreach
- outreach_body: body of initial outreach
- reply_from: responder name/email
- reply_body: body of reply
- reply_date: when reply was received
- classification: (to be labeled manually)

Usage:
    python scripts/export_training_data.py
    python scripts/export_training_data.py --output training_data.json
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()


def get_supabase_client():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")
    return create_client(url, key)


def clean_body(body: str) -> str:
    """Clean email body - remove external sender warnings and excessive whitespace."""
    if not body:
        return ""

    # Remove external sender warning
    lines = body.split('\n')
    cleaned_lines = []
    skip_lines = 0

    for line in lines:
        # Skip external sender warning block
        if 'External Sender:' in line or 'This email originated from outside' in line:
            skip_lines = 3
            continue
        if 'Warning: The sender of this email could not be validated' in line:
            skip_lines = 2
            continue
        if skip_lines > 0:
            skip_lines -= 1
            continue
        cleaned_lines.append(line)

    # Join and clean whitespace
    text = '\n'.join(cleaned_lines)
    text = text.strip()

    # Remove excessive newlines
    while '\n\n\n' in text:
        text = text.replace('\n\n\n', '\n\n')

    return text


def export_training_data(output_file: str):
    db = get_supabase_client()

    # Get outreach campaigns (initial cold emails with acquisition language)
    outreach_query = """
        SELECT DISTINCT
            outlook_conversation_id,
            subject,
            body_text,
            sent_at
        FROM synced_emails
        WHERE direction = 'outbound'
          AND subject NOT ILIKE 'RE:%'
          AND subject NOT ILIKE 'FW:%'
          AND (
            body_text ILIKE '%acquisition parameters%'
            OR body_text ILIKE '%aligns with my client%'
            OR body_text ILIKE '%buyer is actively%'
            OR body_text ILIKE '%institutional buyer%'
            OR body_text ILIKE '%off-market%'
          )
        ORDER BY sent_at DESC
    """

    # Note: Supabase client doesn't support raw SQL, so we use REST API filters
    # Get all outbound emails with acquisition language
    outreach_result = db.table("synced_emails").select(
        "id, outlook_conversation_id, subject, body_text, sent_at"
    ).eq("direction", "outbound").execute()

    # Filter for acquisition language
    outreach_emails = {}
    for email in outreach_result.data:
        subject = email.get("subject", "") or ""
        body = email.get("body_text", "") or ""
        conv_id = email.get("outlook_conversation_id")

        # Skip replies
        if subject.upper().startswith("RE:") or subject.upper().startswith("FW:"):
            continue

        # Check for acquisition language
        body_lower = body.lower()
        if any(phrase in body_lower for phrase in [
            "acquisition parameters",
            "aligns with my client",
            "buyer is actively",
            "institutional buyer",
            "off-market"
        ]):
            if conv_id not in outreach_emails:
                outreach_emails[conv_id] = email

    print(f"Found {len(outreach_emails)} outreach campaigns")

    # Get all inbound replies
    reply_result = db.table("synced_emails").select(
        "id, outlook_conversation_id, subject, body_text, from_email, from_name, received_at"
    ).eq("direction", "inbound").execute()

    # Group replies by conversation
    replies_by_conv = {}
    for reply in reply_result.data:
        conv_id = reply.get("outlook_conversation_id")
        from_email = reply.get("from_email", "") or ""

        # Skip internal replies
        if "lee-associates.com" in from_email.lower():
            continue

        if conv_id not in replies_by_conv:
            replies_by_conv[conv_id] = []
        replies_by_conv[conv_id].append(reply)

    # Build training data
    training_data = []

    for conv_id, outreach in outreach_emails.items():
        if conv_id not in replies_by_conv:
            continue

        replies = replies_by_conv[conv_id]

        for reply in replies:
            record = {
                "campaign_id": conv_id,
                "outreach_subject": outreach.get("subject", ""),
                "outreach_body": clean_body(outreach.get("body_text", "")),
                "outreach_sent_at": outreach.get("sent_at"),
                "reply_id": reply.get("id"),
                "reply_from_name": reply.get("from_name", ""),
                "reply_from_email": reply.get("from_email", ""),
                "reply_body": clean_body(reply.get("body_text", "")),
                "reply_received_at": reply.get("received_at"),
                "classification": None,  # To be labeled manually
                "confidence": None,
                "notes": None
            }
            training_data.append(record)

    print(f"Found {len(training_data)} campaign replies for training data")

    # Sort by reply date (most recent first)
    training_data.sort(key=lambda x: x.get("reply_received_at") or "", reverse=True)

    # Save to file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(training_data, f, indent=2, ensure_ascii=False, default=str)

    print(f"Saved training data to {output_file}")

    # Print sample
    print("\n" + "="*60)
    print("SAMPLE TRAINING DATA (first 5)")
    print("="*60)

    for i, record in enumerate(training_data[:5]):
        print(f"\n--- Campaign {i+1} ---")
        print(f"Subject: {record['outreach_subject'][:70]}")
        print(f"From: {record['reply_from_name']} <{record['reply_from_email']}>")
        print(f"Reply preview: {record['reply_body'][:200]}...")
        print(f"Date: {record['reply_received_at']}")


def main():
    parser = argparse.ArgumentParser(description="Export training data for response classifier")
    parser.add_argument(
        "--output", "-o",
        default="output/training_data.json",
        help="Output file path (default: output/training_data.json)"
    )
    args = parser.parse_args()

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    export_training_data(args.output)


if __name__ == "__main__":
    main()
