#!/usr/bin/env python3
"""
Create contacts from unmatched outbound emails.
Uses email address to derive name if no other info available.
"""

import psycopg2
import re

DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'

def email_to_name(email):
    """Convert email to a reasonable name guess."""
    local = email.split('@')[0].lower()
    # Remove common prefixes/suffixes
    local = re.sub(r'^(info|admin|contact|sales|support|hello|ask|student)\d*$', '', local)
    if not local:
        return None
    # Split on common separators
    parts = re.split(r'[._\-]', local)
    # Filter out numbers and single chars
    parts = [p for p in parts if len(p) > 1 and not p.isdigit()]
    if not parts:
        return None
    # Capitalize each part
    return ' '.join(p.capitalize() for p in parts)

def main():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Get unmatched outbound emails
    cur.execute("""
        SELECT DISTINCT LOWER(to_emails[1]) as email
        FROM synced_emails
        WHERE direction = 'outbound'
        AND matched_contact_id IS NULL
        AND to_emails[1] IS NOT NULL
        AND to_emails[1] NOT LIKE '%grijalva%'
    """)
    unmatched = [row[0] for row in cur.fetchall()]
    print(f"Found {len(unmatched)} unique unmatched email addresses")

    # Check which don't have contacts
    cur.execute("SELECT LOWER(email) FROM contacts WHERE email IS NOT NULL")
    existing = {row[0] for row in cur.fetchall()}

    to_create = [e for e in unmatched if e.lower() not in existing]
    print(f"Need to create {len(to_create)} new contacts")

    created = 0
    for email in to_create:
        name = email_to_name(email)
        if not name:
            name = email.split('@')[0]  # Just use the local part

        cur.execute("""
            INSERT INTO contacts (email, name, source, status, contact_type)
            VALUES (%s, %s, 'manual', 'active', 'seller')
            ON CONFLICT (email) DO NOTHING
            RETURNING id
        """, (email, name))
        if cur.fetchone():
            created += 1

    print(f"Created {created} contacts")
    conn.commit()

    # Now match the synced emails
    print("\nMatching synced_emails to new contacts...")
    cur.execute("""
        UPDATE synced_emails se
        SET matched_contact_id = c.id, matched_lead_id = c.lead_id
        FROM contacts c
        WHERE se.direction = 'outbound'
        AND se.matched_contact_id IS NULL
        AND LOWER(se.to_emails[1]) = LOWER(c.email)
    """)
    print(f"Matched {cur.rowcount} synced_emails")
    conn.commit()

    # Final count
    cur.execute("""
        SELECT count(*) FROM synced_emails
        WHERE direction='outbound' AND matched_contact_id IS NULL
        AND to_emails[1] NOT LIKE '%grijalva%'
    """)
    remaining = cur.fetchone()[0]
    print(f"\nRemaining unmatched outbound emails: {remaining}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
