#!/usr/bin/env python3
"""
CoStar CSV Import Script

Imports CoStar extraction CSV files into the Upstream database with:
- Deduplication by costar_property_id, costar_company_id, email
- DNC checking before contact insert
- Property ↔ Company ↔ Contact linking
- Extraction list tracking

Usage:
    python import_csv.py <csv_file> [--extraction-id UUID] [--strategy-id UUID]

Environment:
    SUPABASE_URL - Supabase project URL
    SUPABASE_KEY - Supabase service role key
"""

import argparse
import csv
import os
import sys
from datetime import datetime
from typing import Optional
from uuid import uuid4

try:
    from supabase import create_client, Client
except ImportError:
    print("Error: supabase-py not installed. Run: pip install supabase")
    sys.exit(1)


def get_supabase_client() -> Client:
    """Create Supabase client from environment variables."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables required")

    return create_client(url, key)


def check_dnc(supabase: Client, email: str) -> bool:
    """Check if email is on DNC list."""
    if not email:
        return False

    result = supabase.table("dnc_entries").select("id").eq("email", email.lower()).execute()
    return len(result.data) > 0


def upsert_property(supabase: Client, row: dict) -> Optional[str]:
    """Upsert property and return ID."""
    costar_id = row.get("costar_property_id") or row.get("PropertyID")

    if not costar_id:
        return None

    # Check if exists
    existing = supabase.table("properties").select("id").eq("costar_property_id", costar_id).execute()

    property_data = {
        "costar_property_id": costar_id,
        "address": row.get("address") or row.get("Address") or row.get("Property Address"),
        "property_name": row.get("property_name") or row.get("Property Name"),
        "property_type": row.get("property_type") or row.get("Property Type"),
        "building_size_sqft": parse_int(row.get("building_size_sqft") or row.get("Building SF")),
        "lot_size_acres": parse_float(row.get("lot_size_acres") or row.get("Land Area (AC)")),
        "year_built": parse_int(row.get("year_built") or row.get("Year Built")),
        "building_class": row.get("building_class") or row.get("Building Class"),
        "percent_leased": parse_float(row.get("percent_leased") or row.get("% Leased")),
        "last_seen_at": datetime.utcnow().isoformat(),
    }

    # Remove None values
    property_data = {k: v for k, v in property_data.items() if v is not None}

    if existing.data:
        # Update
        property_id = existing.data[0]["id"]
        supabase.table("properties").update(property_data).eq("id", property_id).execute()
        return property_id
    else:
        # Insert
        property_data["id"] = str(uuid4())
        property_data["first_seen_at"] = datetime.utcnow().isoformat()
        supabase.table("properties").insert(property_data).execute()
        return property_data["id"]


def upsert_company(supabase: Client, row: dict) -> Optional[str]:
    """Upsert company and return ID."""
    costar_id = row.get("costar_company_id") or row.get("Owner Company ID")
    name = row.get("company_name") or row.get("Owner Name") or row.get("True Owner")

    if not name:
        return None

    # Check by costar_id first, then by name
    existing = None
    if costar_id:
        existing = supabase.table("companies").select("id").eq("costar_company_id", costar_id).execute()

    if not existing or not existing.data:
        # Try by exact name match
        existing = supabase.table("companies").select("id").eq("name", name).execute()

    company_data = {
        "costar_company_id": costar_id,
        "name": name,
        "source": "costar",
    }

    company_data = {k: v for k, v in company_data.items() if v is not None}

    if existing and existing.data:
        return existing.data[0]["id"]
    else:
        company_data["id"] = str(uuid4())
        company_data["status"] = "new"
        supabase.table("companies").insert(company_data).execute()
        return company_data["id"]


def upsert_contact(supabase: Client, row: dict, company_id: Optional[str]) -> Optional[str]:
    """Upsert contact and return ID. Returns None if DNC."""
    email = (row.get("email") or row.get("Contact Email") or "").strip().lower()

    if not email:
        return None

    # Check DNC
    if check_dnc(supabase, email):
        print(f"  Skipping DNC: {email}")
        return None

    # Check existing
    existing = supabase.table("contacts").select("id").eq("email", email).execute()

    contact_data = {
        "costar_person_id": row.get("costar_person_id") or row.get("Contact ID"),
        "company_id": company_id,
        "name": row.get("contact_name") or row.get("Contact Name") or row.get("Contact Full Name"),
        "title": row.get("title") or row.get("Contact Title"),
        "email": email,
        "phone": row.get("phone") or row.get("Contact Phone"),
    }

    contact_data = {k: v for k, v in contact_data.items() if v is not None}

    if existing.data:
        contact_id = existing.data[0]["id"]
        supabase.table("contacts").update(contact_data).eq("id", contact_id).execute()
        return contact_id
    else:
        contact_data["id"] = str(uuid4())
        contact_data["status"] = "active"
        supabase.table("contacts").insert(contact_data).execute()
        return contact_data["id"]


def link_property_company(supabase: Client, property_id: str, company_id: str):
    """Create property-company junction record if not exists."""
    existing = supabase.table("property_companies")\
        .select("property_id")\
        .eq("property_id", property_id)\
        .eq("company_id", company_id)\
        .execute()

    if not existing.data:
        supabase.table("property_companies").insert({
            "property_id": property_id,
            "company_id": company_id,
            "relationship": "owner",
        }).execute()


def link_property_extraction(supabase: Client, extraction_list_id: str, property_id: str):
    """Create list-property junction record if not exists."""
    existing = supabase.table("list_properties")\
        .select("property_id")\
        .eq("extraction_list_id", extraction_list_id)\
        .eq("property_id", property_id)\
        .execute()

    if not existing.data:
        supabase.table("list_properties").insert({
            "extraction_list_id": extraction_list_id,
            "property_id": property_id,
        }).execute()


def parse_int(value) -> Optional[int]:
    """Safely parse integer."""
    if value is None or value == "":
        return None
    try:
        return int(str(value).replace(",", ""))
    except (ValueError, TypeError):
        return None


def parse_float(value) -> Optional[float]:
    """Safely parse float."""
    if value is None or value == "":
        return None
    try:
        return float(str(value).replace(",", "").replace("%", ""))
    except (ValueError, TypeError):
        return None


def import_csv(
    csv_path: str,
    extraction_list_id: Optional[str] = None,
    strategy_id: Optional[str] = None,
) -> dict:
    """
    Import CSV file into database.

    Returns:
        dict with counts: properties, companies, contacts, skipped_dnc
    """
    supabase = get_supabase_client()

    # Create extraction list if not provided
    if not extraction_list_id:
        extraction_list_id = str(uuid4())
        supabase.table("extraction_lists").insert({
            "id": extraction_list_id,
            "name": os.path.basename(csv_path),
            "source_file": csv_path,
            "sourcing_strategy_id": strategy_id,
            "extracted_at": datetime.utcnow().isoformat(),
        }).execute()

    counts = {
        "properties": 0,
        "companies": 0,
        "contacts": 0,
        "skipped_dnc": 0,
        "rows": 0,
    }

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        for row in reader:
            counts["rows"] += 1

            # Upsert property
            property_id = upsert_property(supabase, row)
            if property_id:
                counts["properties"] += 1
                link_property_extraction(supabase, extraction_list_id, property_id)

            # Upsert company
            company_id = upsert_company(supabase, row)
            if company_id:
                counts["companies"] += 1

            # Link property to company
            if property_id and company_id:
                link_property_company(supabase, property_id, company_id)

            # Upsert contact
            contact_id = upsert_contact(supabase, row, company_id)
            if contact_id:
                counts["contacts"] += 1
            elif row.get("email") or row.get("Contact Email"):
                counts["skipped_dnc"] += 1

            if counts["rows"] % 100 == 0:
                print(f"Processed {counts['rows']} rows...")

    # Update extraction list counts
    supabase.table("extraction_lists").update({
        "property_count": counts["properties"],
        "contact_count": counts["contacts"],
    }).eq("id", extraction_list_id).execute()

    return counts


def main():
    parser = argparse.ArgumentParser(description="Import CoStar CSV into Upstream database")
    parser.add_argument("csv_file", help="Path to CSV file")
    parser.add_argument("--extraction-id", help="Existing extraction list UUID")
    parser.add_argument("--strategy-id", help="Sourcing strategy UUID")

    args = parser.parse_args()

    if not os.path.exists(args.csv_file):
        print(f"Error: File not found: {args.csv_file}")
        sys.exit(1)

    print(f"Importing: {args.csv_file}")

    try:
        counts = import_csv(
            args.csv_file,
            extraction_list_id=args.extraction_id,
            strategy_id=args.strategy_id,
        )

        print("\nImport complete!")
        print(f"  Rows processed: {counts['rows']}")
        print(f"  Properties: {counts['properties']}")
        print(f"  Companies: {counts['companies']}")
        print(f"  Contacts: {counts['contacts']}")
        print(f"  Skipped (DNC): {counts['skipped_dnc']}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
