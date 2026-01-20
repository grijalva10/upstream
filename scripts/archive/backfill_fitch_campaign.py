#!/usr/bin/env python3
"""
Backfill contacts, leads, and properties from Fitch campaign JSON file.
Also matches synced_emails and marks bounced contacts.
"""

import json
import psycopg2
from psycopg2.extras import execute_values
import re
from datetime import datetime

# Configuration
JSON_FILE = r'C:\Users\grija\Documents\costar-extract\output\fitch_20251201_100139.csv\property_contacts_20251201_102342.json'
DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'

def main():
    # Load JSON data
    print("Loading JSON file...")
    with open(JSON_FILE, 'r') as f:
        data = json.load(f)
    print(f"Loaded {len(data)} records")

    # Connect to database
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()

    # Build lookup of existing data
    print("\nLoading existing data from database...")

    cur.execute("SELECT costar_property_id, id FROM properties WHERE costar_property_id IS NOT NULL")
    existing_properties = {row[0]: row[1] for row in cur.fetchall()}
    print(f"  Existing properties: {len(existing_properties)}")

    cur.execute("SELECT costar_company_id, id FROM leads WHERE costar_company_id IS NOT NULL")
    existing_leads = {row[0]: row[1] for row in cur.fetchall()}
    print(f"  Existing leads: {len(existing_leads)}")

    cur.execute("SELECT email, id FROM contacts WHERE email IS NOT NULL")
    existing_contacts = {row[0].lower(): row[1] for row in cur.fetchall()}
    print(f"  Existing contacts: {len(existing_contacts)}")

    cur.execute("SELECT property_id, lead_id FROM property_leads")
    existing_property_leads = {(row[0], row[1]) for row in cur.fetchall()}
    print(f"  Existing property_leads: {len(existing_property_leads)}")

    # Track what we create
    created_properties = 0
    created_leads = 0
    created_contacts = 0
    created_property_leads = 0
    updated_contacts = 0

    # Build email -> record mapping for later
    email_to_record = {}

    print("\nProcessing records...")
    for key, record in data.items():
        property_id_costar = str(record['property_id'])
        company = record.get('company', {})
        contact = record.get('contact', {})

        company_id_costar = str(company.get('company_id', '')) if company.get('company_id') else None
        email = contact.get('email', '').lower().strip() if contact.get('email') else None

        if not email:
            continue

        # Store for email matching later
        email_to_record[email] = record

        # 1. Create property if needed
        if property_id_costar not in existing_properties:
            # We don't have full property data, just create a minimal record
            cur.execute("""
                INSERT INTO properties (costar_property_id, address, property_type)
                VALUES (%s, %s, %s)
                ON CONFLICT (costar_property_id) DO NOTHING
                RETURNING id
            """, (property_id_costar, f"Property {property_id_costar}", 'Unknown'))
            result = cur.fetchone()
            if result:
                existing_properties[property_id_costar] = result[0]
                created_properties += 1

        property_uuid = existing_properties.get(property_id_costar)

        # 2. Create lead (company) if needed
        if company_id_costar and company_id_costar not in existing_leads:
            company_name = company.get('name', f"Company {company_id_costar}")
            company_key = company.get('company_key')

            cur.execute("""
                INSERT INTO leads (costar_company_id, costar_key, name, source, status)
                VALUES (%s, %s, %s, 'costar', 'contacted')
                ON CONFLICT (costar_company_id) DO NOTHING
                RETURNING id
            """, (company_id_costar, company_key, company_name))
            result = cur.fetchone()
            if result:
                existing_leads[company_id_costar] = result[0]
                created_leads += 1

        lead_uuid = existing_leads.get(company_id_costar) if company_id_costar else None

        # 3. Create contact if needed, or update if exists without lead_id
        if email not in existing_contacts:
            person_id = str(contact.get('personId', '')) if contact.get('personId') else None
            name = contact.get('name', email)
            title = contact.get('title')
            phones = contact.get('phoneNumbers', [])
            phone = phones[0] if phones else None

            cur.execute("""
                INSERT INTO contacts (costar_person_id, lead_id, name, title, email, phone, source, status)
                VALUES (%s, %s, %s, %s, %s, %s, 'costar', 'active')
                ON CONFLICT (email) DO NOTHING
                RETURNING id
            """, (person_id, lead_uuid, name, title, email, phone))
            result = cur.fetchone()
            if result:
                existing_contacts[email] = result[0]
                created_contacts += 1
        else:
            # Contact exists - update lead_id if missing
            contact_uuid = existing_contacts[email]
            if lead_uuid:
                cur.execute("""
                    UPDATE contacts SET lead_id = %s, updated_at = NOW()
                    WHERE id = %s AND lead_id IS NULL
                """, (lead_uuid, contact_uuid))
                if cur.rowcount > 0:
                    updated_contacts += 1

        contact_uuid = existing_contacts.get(email)

        # 4. Create property_leads link if needed
        if property_uuid and lead_uuid and (property_uuid, lead_uuid) not in existing_property_leads:
            relationship = 'owner' if record.get('contact_type') == 'true_owner' else 'manager'
            cur.execute("""
                INSERT INTO property_leads (property_id, lead_id, relationship)
                VALUES (%s, %s, %s)
                ON CONFLICT DO NOTHING
            """, (property_uuid, lead_uuid, relationship))
            if cur.rowcount > 0:
                existing_property_leads.add((property_uuid, lead_uuid))
                created_property_leads += 1

    print(f"\nCreated: {created_properties} properties, {created_leads} leads, {created_contacts} contacts, {created_property_leads} property_leads")
    print(f"Updated: {updated_contacts} contacts with lead_id")

    # 5. Match synced_emails to contacts/leads/properties
    print("\nMatching synced_emails...")
    cur.execute("""
        SELECT id, to_emails[1] as to_email
        FROM synced_emails
        WHERE direction = 'outbound'
        AND matched_contact_id IS NULL
        AND to_emails IS NOT NULL
    """)
    unmatched_emails = cur.fetchall()
    print(f"  Unmatched outbound emails: {len(unmatched_emails)}")

    matched_count = 0
    for email_id, to_email in unmatched_emails:
        if not to_email:
            continue
        to_email_lower = to_email.lower().strip()

        if to_email_lower in email_to_record:
            record = email_to_record[to_email_lower]
            property_id_costar = str(record['property_id'])
            company = record.get('company', {})
            company_id_costar = str(company.get('company_id', '')) if company.get('company_id') else None

            contact_uuid = existing_contacts.get(to_email_lower)
            property_uuid = existing_properties.get(property_id_costar)
            lead_uuid = existing_leads.get(company_id_costar) if company_id_costar else None

            if contact_uuid:
                cur.execute("""
                    UPDATE synced_emails
                    SET matched_contact_id = %s,
                        matched_lead_id = %s,
                        matched_property_id = %s
                    WHERE id = %s
                """, (contact_uuid, lead_uuid, property_uuid, email_id))
                matched_count += 1

    print(f"  Matched {matched_count} synced_emails to contacts")

    # 6. Process bounces
    print("\nProcessing bounces...")
    cur.execute("""
        SELECT id, subject, body_text
        FROM synced_emails
        WHERE direction = 'inbound'
        AND (subject ILIKE '%undeliverable%'
             OR subject ILIKE '%delivery%failed%'
             OR subject ILIKE '%returned%'
             OR subject ILIKE '%bounce%'
             OR subject ILIKE '%could not be delivered%')
    """)
    bounce_emails = cur.fetchall()
    print(f"  Found {len(bounce_emails)} bounce emails")

    # Extract bounced email addresses from bounce messages
    bounced_addresses = set()
    email_pattern = re.compile(r'[\w\.-]+@[\w\.-]+\.\w+')

    for email_id, subject, body in bounce_emails:
        # Look for email addresses in subject and body
        text = f"{subject or ''} {body or ''}"
        found_emails = email_pattern.findall(text.lower())
        # Filter out system addresses
        for addr in found_emails:
            if not any(x in addr for x in ['postmaster', 'mailer-daemon', 'microsoft', 'outlook', 'grijalva']):
                bounced_addresses.add(addr)

    print(f"  Extracted {len(bounced_addresses)} unique bounced addresses")

    # Mark contacts as bounced
    bounced_count = 0
    for addr in bounced_addresses:
        cur.execute("""
            UPDATE contacts SET status = 'bounced', status_changed_at = NOW()
            WHERE LOWER(email) = %s AND status != 'bounced'
        """, (addr,))
        if cur.rowcount > 0:
            bounced_count += 1

    print(f"  Marked {bounced_count} contacts as bounced")

    # Note: email_exclusions table doesn't exist, skipping

    # Commit all changes
    conn.commit()
    print("\nAll changes committed successfully!")

    # Summary
    print("\n" + "="*50)
    print("SUMMARY")
    print("="*50)
    print(f"Properties created: {created_properties}")
    print(f"Leads created: {created_leads}")
    print(f"Contacts created: {created_contacts}")
    print(f"Contacts updated with lead_id: {updated_contacts}")
    print(f"Property-Lead links created: {created_property_leads}")
    print(f"Synced emails matched: {matched_count}")
    print(f"Contacts marked bounced: {bounced_count}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
