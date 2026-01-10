"""CoStar Database Integration - Save extracted contacts to Supabase."""

import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional
from decimal import Decimal

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")  # Use service key for inserts

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")

    return create_client(url, key)


def parse_building_size(size_str: str) -> Optional[int]:
    """Parse building size string like '12,640' to integer."""
    if not size_str:
        return None
    try:
        return int(size_str.replace(",", "").replace(" ", ""))
    except (ValueError, AttributeError):
        return None


def parse_land_size(size_str: str) -> Optional[float]:
    """Parse land size string like '0.94' to float (acres)."""
    if not size_str:
        return None
    try:
        return float(size_str.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def parse_year_built(year_str: str) -> Optional[int]:
    """Parse year built string, handles '1989 / 2012' format."""
    if not year_str:
        return None
    try:
        # Take first year if multiple (original / renovated)
        match = re.search(r'\d{4}', str(year_str))
        return int(match.group()) if match else None
    except (ValueError, AttributeError):
        return None


async def save_contacts(
    contacts: List[Dict],
    client_id: Optional[str] = None,
    client_criteria_id: Optional[str] = None,
    extraction_list_id: Optional[str] = None,
) -> Dict[str, int]:
    """
    Save extracted contacts to Supabase.

    Upserts:
    - properties (by costar_property_id)
    - companies (by costar_company_id)
    - contacts (by email)
    - property_loans (from parcel data)
    - property_companies (junction)

    Args:
        contacts: List of contact dicts from extract_contacts()
        client_id: Optional client UUID to link extraction
        client_criteria_id: Optional criteria UUID
        extraction_list_id: Optional extraction list UUID

    Returns:
        Dict with counts: {properties, companies, contacts, loans}
    """
    if not contacts:
        return {"properties": 0, "companies": 0, "contacts": 0, "loans": 0}

    db = get_supabase_client()

    counts = {"properties": 0, "companies": 0, "contacts": 0, "loans": 0}

    # Track IDs for relationships
    property_ids = {}  # costar_id -> uuid
    company_ids = {}   # costar_id -> uuid

    for contact in contacts:
        try:
            # 1. Upsert property
            prop_costar_id = str(contact.get("property_id"))
            if prop_costar_id and prop_costar_id not in property_ids:
                prop_data = {
                    "costar_property_id": prop_costar_id,
                    "address": contact.get("property_address"),
                    "property_type": _map_property_type(contact.get("property_type")),
                    "building_size_sqft": parse_building_size(contact.get("building_size")),
                    "lot_size_acres": parse_land_size(contact.get("land_size")),
                    "year_built": parse_year_built(contact.get("year_built")),
                    "building_class": contact.get("building_class"),
                    "last_seen_at": datetime.utcnow().isoformat(),
                }

                result = db.table("properties").upsert(
                    prop_data,
                    on_conflict="costar_property_id"
                ).execute()

                if result.data:
                    property_ids[prop_costar_id] = result.data[0]["id"]
                    counts["properties"] += 1

            # 2. Upsert company
            comp_costar_id = str(contact.get("company_id"))
            if comp_costar_id and comp_costar_id not in company_ids:
                comp_address = contact.get("company_address")
                if isinstance(comp_address, list):
                    comp_address = ", ".join(comp_address)

                comp_data = {
                    "costar_company_id": comp_costar_id,
                    "name": contact.get("company_name"),
                }

                result = db.table("companies").upsert(
                    comp_data,
                    on_conflict="costar_company_id"
                ).execute()

                if result.data:
                    company_ids[comp_costar_id] = result.data[0]["id"]
                    counts["companies"] += 1

            # 3. Create property_companies relationship
            prop_uuid = property_ids.get(prop_costar_id)
            comp_uuid = company_ids.get(comp_costar_id)

            if prop_uuid and comp_uuid:
                try:
                    db.table("property_companies").upsert({
                        "property_id": prop_uuid,
                        "company_id": comp_uuid,
                        "relationship": "owner",
                    }, on_conflict="property_id,company_id").execute()
                except Exception:
                    pass  # Ignore duplicate key errors

            # 4. Upsert contact
            email = contact.get("email")
            if email:
                contact_data = {
                    "costar_person_id": str(contact.get("contact_id")),
                    "company_id": comp_uuid,
                    "name": contact.get("contact_name"),
                    "title": contact.get("contact_title"),
                    "email": email,
                    "phone": contact.get("phone"),
                }

                result = db.table("contacts").upsert(
                    contact_data,
                    on_conflict="email"
                ).execute()

                if result.data:
                    counts["contacts"] += 1

            # 5. Upsert loan data (from parcel)
            if prop_uuid and contact.get("lender"):
                loan_data = {
                    "property_id": prop_uuid,
                    "lender_name": contact.get("lender"),
                    "original_amount": contact.get("loan_amount"),
                    "interest_rate": contact.get("loan_rate"),
                    "origination_date": _parse_date(contact.get("loan_origination")),
                    "ltv_current": contact.get("ltv"),
                    "last_seen_at": datetime.utcnow().isoformat(),
                }

                # Use property_id as pseudo-unique key (one loan per property for now)
                result = db.table("property_loans").upsert(
                    loan_data,
                    on_conflict="property_id"
                ).execute()

                if result.data:
                    counts["loans"] += 1

        except Exception as e:
            logger.warning(f"Failed to save contact {contact.get('email')}: {e}")
            continue

    # 6. Update extraction_list counts if provided
    if extraction_list_id:
        try:
            db.table("extraction_lists").update({
                "property_count": counts["properties"],
                "contact_count": counts["contacts"],
                "extracted_at": datetime.utcnow().isoformat(),
                "client_id": client_id,
                "client_criteria_id": client_criteria_id,
            }).eq("id", extraction_list_id).execute()
        except Exception as e:
            logger.warning(f"Failed to update extraction_list: {e}")

    logger.info(f"Saved to DB: {counts}")
    return counts


def _map_property_type(type_id: Optional[int]) -> Optional[str]:
    """Map CoStar property type ID to name."""
    if not type_id:
        return None

    type_map = {
        1: "Multifamily",
        2: "Industrial",
        3: "Flex",
        4: "Retail",
        5: "Office",
        6: "Hospitality",
        7: "Land",
        8: "Health Care",
        9: "Specialty",
    }
    return type_map.get(type_id, f"Type_{type_id}")


def _parse_date(date_str: Optional[str]) -> Optional[str]:
    """Parse date string to ISO format."""
    if not date_str:
        return None
    try:
        # Handle '2019-12-12T00:00:00' format
        if "T" in date_str:
            return date_str.split("T")[0]
        return date_str
    except Exception:
        return None
