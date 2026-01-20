#!/usr/bin/env python3
"""
Enrich properties with full CoStar data.

Finds properties with placeholder/missing data and enriches them via the
CoStar service /enrich endpoint.

Usage:
    python scripts/enrich_properties.py [--limit N] [--batch-size N] [--dry-run]

Prerequisites:
    - CoStar service running: python integrations/costar/service.py
    - Session authenticated (POST /start, complete 2FA)
"""

import argparse
import json
import logging
import re
import sys
import time
from typing import List, Dict, Optional

import psycopg2
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
COSTAR_SERVICE_URL = 'http://localhost:8765'


def check_service_status() -> bool:
    """Check if CoStar service is running and authenticated."""
    try:
        resp = requests.get(f"{COSTAR_SERVICE_URL}/status", timeout=5)
        if resp.status_code != 200:
            return False
        status = resp.json()
        if status.get("status") != "connected":
            logger.error(f"CoStar service not connected: {status.get('status')}")
            return False
        if not status.get("session_valid"):
            logger.error("CoStar session expired - please re-authenticate")
            return False
        logger.info(f"CoStar service connected, expires in {status.get('expires_in_minutes')} minutes")
        return True
    except requests.exceptions.ConnectionError:
        logger.error("CoStar service not running. Start it with: python integrations/costar/service.py")
        return False


def get_properties_to_enrich(conn, limit: Optional[int] = None) -> List[Dict]:
    """Get properties that need enrichment (placeholder or missing data)."""
    cur = conn.cursor()

    # Find properties with placeholder addresses or missing key data
    query = """
        SELECT id, costar_property_id, address, property_type, city, state_code
        FROM properties
        WHERE costar_property_id IS NOT NULL
        AND (
            address LIKE 'Property %%'
            OR address IS NULL
            OR city IS NULL
            OR property_type IS NULL
            OR property_type = 'Unknown'
        )
        ORDER BY created_at DESC
    """
    if limit:
        query += f" LIMIT {limit}"

    cur.execute(query)
    columns = [desc[0] for desc in cur.description]
    rows = [dict(zip(columns, row)) for row in cur.fetchall()]
    cur.close()
    return rows


def enrich_batch(property_ids: List[int], options: Dict) -> Dict:
    """Call CoStar service /enrich endpoint for a batch of properties."""
    try:
        resp = requests.post(
            f"{COSTAR_SERVICE_URL}/enrich",
            json={
                "property_ids": property_ids,
                "options": options,
            },
            timeout=600,  # 10 min timeout
        )
        if resp.status_code != 200:
            return {"error": resp.text}
        return resp.json()
    except Exception as e:
        return {"error": str(e)}


def parse_year(value) -> Optional[int]:
    """Extract year from various formats like '2001', 'Aug 2016', etc."""
    if value is None:
        return None
    if isinstance(value, int):
        return value
    s = str(value)
    # Try to find a 4-digit year
    match = re.search(r'\b(19|20)\d{2}\b', s)
    if match:
        return int(match.group())
    return None


def parse_numeric(value) -> Optional[float]:
    """Extract numeric value from strings like '1.09/1,000 SF'."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value)
    # Try to extract first number
    match = re.search(r'[\d.]+', s.replace(',', ''))
    if match:
        try:
            return float(match.group())
        except ValueError:
            return None
    return None


def update_property(conn, property_uuid: str, data: Dict) -> bool:
    """Update property in database with enriched data."""
    cur = conn.cursor()

    # Build update query dynamically based on available data
    updates = []
    values = []

    # Fields that map directly (strings)
    string_fields = {
        "address": "address",
        "property_name": "property_name",
        "property_type": "property_type",
        "secondary_type": "secondary_type",
        "building_class": "building_class",
        "city": "city",
        "state_code": "state_code",
        "postal_code": "postal_code",
        "county": "county",
        "submarket": "submarket",
        "submarket_cluster": "submarket_cluster",
        "location_type": "location_type",
        "tenancy": "tenancy",
        "ceiling_height": "ceiling_height",
        "docks": "docks",
        "drive_ins": "drive_ins",
        "power": "power",
        "rail": "rail",
        "crane": "crane",
        "zoning": "zoning",
    }

    for api_field, db_field in string_fields.items():
        value = data.get(api_field)
        if value is not None:
            updates.append(f"{db_field} = %s")
            values.append(str(value) if value else None)

    # Numeric fields (skip market_id - FK constraint issues)
    numeric_fields = {
        "building_size_sqft": "building_size_sqft",
        "lot_size_acres": "lot_size_acres",
        "star_rating": "star_rating",
        "number_of_stories": "number_of_stories",
        "parking_spaces": "parking_spaces",
        "num_of_beds": "num_of_beds",
    }

    for api_field, db_field in numeric_fields.items():
        value = data.get(api_field)
        if value is not None:
            parsed = parse_numeric(value)
            if parsed is not None:
                updates.append(f"{db_field} = %s")
                values.append(parsed)

    # Year field (special parsing)
    year_built = parse_year(data.get("year_built"))
    if year_built:
        updates.append("year_built = %s")
        values.append(year_built)

    # Skip parking_ratio for now (stored as text but API returns "1.09/1,000 SF")
    # Skip last_sale_date/price (need proper parsing)

    # Store full response as JSON for reference
    if data:
        updates.append("costar_data = %s")
        # Remove large nested objects for storage
        clean_data = {k: v for k, v in data.items() if k not in ["contacts", "loans", "amenities"]}
        values.append(json.dumps(clean_data))

    if not updates:
        return False

    updates.append("updated_at = NOW()")
    values.append(property_uuid)

    query = f"UPDATE properties SET {', '.join(updates)} WHERE id = %s"

    try:
        cur.execute(query, values)
        conn.commit()
        return cur.rowcount > 0
    except Exception as e:
        logger.error(f"Failed to update property {property_uuid}: {e}")
        conn.rollback()
        return False
    finally:
        cur.close()


def update_contacts(conn, property_uuid: str, lead_id: Optional[str], contacts: List[Dict]) -> int:
    """Update contacts for a property."""
    if not contacts:
        return 0

    cur = conn.cursor()
    created = 0

    for contact in contacts:
        email = contact.get("email")
        if not email:
            continue

        try:
            # Check if contact exists
            cur.execute("SELECT id FROM contacts WHERE LOWER(email) = LOWER(%s)", (email,))
            existing = cur.fetchone()

            if existing:
                # Update existing contact with company link if missing
                if lead_id:
                    cur.execute("""
                        UPDATE contacts SET lead_id = %s, updated_at = NOW()
                        WHERE id = %s AND lead_id IS NULL
                    """, (lead_id, existing[0]))
            else:
                # Create new contact
                cur.execute("""
                    INSERT INTO contacts (
                        costar_person_id, lead_id, name, title, email, phone, source, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, 'costar', 'active')
                    ON CONFLICT (email) DO NOTHING
                """, (
                    str(contact.get("person_id")) if contact.get("person_id") else None,
                    lead_id,
                    contact.get("name"),
                    contact.get("title"),
                    email,
                    contact.get("phones", [None])[0] if contact.get("phones") else None,
                ))
                if cur.rowcount > 0:
                    created += 1

        except Exception as e:
            logger.warning(f"Failed to update contact {email}: {e}")
            conn.rollback()

    conn.commit()
    cur.close()
    return created


def update_loans(conn, property_uuid: str, loans: List[Dict], sale_data: Dict) -> int:
    """Update loan data for a property."""
    if not loans:
        return 0

    cur = conn.cursor()
    created = 0

    for loan in loans:
        try:
            lender = loan.get("lender")
            amount = loan.get("amount")

            # Check if loan already exists (by property - only one loan per property allowed)
            cur.execute("SELECT id FROM property_loans WHERE property_id = %s", (property_uuid,))

            if cur.fetchone():
                # Update existing loan
                cur.execute("""
                    UPDATE property_loans SET
                        lender_name = %s,
                        original_amount = %s,
                        interest_rate = %s,
                        origination_date = %s,
                        ltv_original = %s,
                        updated_at = NOW()
                    WHERE property_id = %s
                """, (
                    lender,
                    amount,
                    loan.get("rate"),
                    loan.get("origination_date"),
                    parse_numeric(sale_data.get("ltv")),
                    property_uuid,
                ))
            else:
                # Insert new loan
                cur.execute("""
                    INSERT INTO property_loans (
                        property_id, lender_name, original_amount, interest_rate,
                        origination_date, ltv_original
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (
                    property_uuid,
                    lender,
                    amount,
                    loan.get("rate"),
                    loan.get("origination_date"),
                    parse_numeric(sale_data.get("ltv")),
                ))
                if cur.rowcount > 0:
                    created += 1

            # Only process first loan (one per property constraint)
            break

        except Exception as e:
            logger.warning(f"Failed to insert loan for {property_uuid}: {e}")
            conn.rollback()

    conn.commit()
    cur.close()
    return created


def main():
    parser = argparse.ArgumentParser(description="Enrich properties with CoStar data")
    parser.add_argument("--limit", type=int, help="Max properties to process")
    parser.add_argument("--batch-size", type=int, default=25, help="Properties per API call")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be done without making changes")
    parser.add_argument("--include-contacts", action="store_true", default=True, help="Include contact data")
    parser.add_argument("--include-loans", action="store_true", default=True, help="Include loan data")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between batches (seconds)")
    args = parser.parse_args()

    # Check service
    if not args.dry_run and not check_service_status():
        sys.exit(1)

    # Connect to database
    conn = psycopg2.connect(DB_URL)

    # Get properties to enrich
    properties = get_properties_to_enrich(conn, args.limit)
    logger.info(f"Found {len(properties)} properties to enrich")

    if args.dry_run:
        for p in properties[:10]:
            logger.info(f"  Would enrich: {p['costar_property_id']} - {p['address']}")
        if len(properties) > 10:
            logger.info(f"  ... and {len(properties) - 10} more")
        conn.close()
        return

    # Process in batches
    total_updated = 0
    total_contacts = 0
    total_loans = 0
    total_errors = 0

    for batch_start in range(0, len(properties), args.batch_size):
        batch = properties[batch_start:batch_start + args.batch_size]
        property_ids = [int(p["costar_property_id"]) for p in batch]

        logger.info(f"Processing batch {batch_start // args.batch_size + 1}: {len(batch)} properties")

        result = enrich_batch(property_ids, {
            "include_contacts": args.include_contacts,
            "include_parcel": True,
            "include_loans": args.include_loans,
            "concurrency": 5,
        })

        if result.get("error"):
            logger.error(f"Batch failed: {result['error']}")
            total_errors += len(batch)
            continue

        # Update database with results
        enriched = result.get("properties", [])
        for prop_data in enriched:
            if prop_data.get("error"):
                total_errors += 1
                continue

            # Find the DB record for this property
            costar_id = str(prop_data.get("property_id") or prop_data.get("costar_property_id"))
            db_prop = next((p for p in batch if p["costar_property_id"] == costar_id), None)
            if not db_prop:
                continue

            # Update property
            if update_property(conn, str(db_prop["id"]), prop_data):
                total_updated += 1

            # Update contacts
            contacts = prop_data.get("contacts", [])
            if contacts:
                # TODO: Get or create lead for company
                created = update_contacts(conn, str(db_prop["id"]), None, contacts)
                total_contacts += created

            # Update loans
            loans = prop_data.get("loans", [])
            if loans:
                created = update_loans(conn, str(db_prop["id"]), loans, prop_data)
                total_loans += created

        logger.info(f"Batch complete: {result.get('success_count', 0)} success, {result.get('error_count', 0)} errors")

        # Delay between batches
        if batch_start + args.batch_size < len(properties):
            time.sleep(args.delay)

    conn.close()

    logger.info(f"\n{'='*50}")
    logger.info("ENRICHMENT COMPLETE")
    logger.info(f"{'='*50}")
    logger.info(f"Properties updated: {total_updated}")
    logger.info(f"Contacts created: {total_contacts}")
    logger.info(f"Loans created: {total_loans}")
    logger.info(f"Errors: {total_errors}")


if __name__ == "__main__":
    main()
