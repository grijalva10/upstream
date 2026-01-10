"""CoStar Database Integration - Save extracted contacts to Supabase."""

import logging
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """Get Supabase client from environment variables."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY required")

    return create_client(url, key)


def parse_building_size(size_str: str) -> Optional[int]:
    """Parse building size string like '12,640' to integer."""
    if not size_str:
        return None
    try:
        return int(str(size_str).replace(",", "").replace(" ", ""))
    except (ValueError, AttributeError):
        return None


def parse_land_size(size_str: str) -> Optional[float]:
    """Parse land size string like '0.94' to float (acres)."""
    if not size_str:
        return None
    try:
        return float(str(size_str).replace(",", ""))
    except (ValueError, AttributeError):
        return None


def parse_year_built(year_str: str) -> Optional[int]:
    """Parse year built string, handles '1989 / 2012' format."""
    if not year_str:
        return None
    try:
        match = re.search(r'\d{4}', str(year_str))
        return int(match.group()) if match else None
    except (ValueError, AttributeError):
        return None


# =============================================================================
# CLIENT & CRITERIA MANAGEMENT
# =============================================================================

def get_or_create_client(
    db: Client,
    name: str,
    company_name: Optional[str] = None,
    email: Optional[str] = None,
) -> str:
    """Get existing client by name or create new one. Returns client UUID."""
    # Try to find existing
    result = db.table("clients").select("id").eq("name", name).limit(1).execute()
    if result.data:
        return result.data[0]["id"]

    # Create new
    data = {"name": name}
    if company_name:
        data["company_name"] = company_name
    if email:
        data["email"] = email

    result = db.table("clients").insert(data).execute()
    client_id = result.data[0]["id"]
    logger.info(f"Created client: {name} ({client_id})")
    return client_id


def create_client_criteria(
    db: Client,
    client_id: str,
    name: str,
    criteria_json: Dict,
    queries_json: Optional[List[Dict]] = None,
    strategy_summary: Optional[str] = None,
    source_file: Optional[str] = None,
) -> str:
    """Create a new client criteria record. Returns criteria UUID."""
    data = {
        "client_id": client_id,
        "name": name,
        "criteria_json": criteria_json,
        "status": "active",
    }
    if queries_json:
        data["queries_json"] = queries_json
    if strategy_summary:
        data["strategy_summary"] = strategy_summary
    if source_file:
        data["source_file"] = source_file

    result = db.table("client_criteria").insert(data).execute()
    criteria_id = result.data[0]["id"]
    logger.info(f"Created criteria: {name} for client {client_id}")
    return criteria_id


def get_criteria_by_id(db: Client, criteria_id: str) -> Optional[Dict]:
    """Get client criteria by ID."""
    result = db.table("client_criteria").select("*").eq("id", criteria_id).limit(1).execute()
    return result.data[0] if result.data else None


# =============================================================================
# EXTRACTION LIST MANAGEMENT
# =============================================================================

def create_extraction_list(
    db: Client,
    name: str,
    client_criteria_id: Optional[str] = None,
    query_name: Optional[str] = None,
    query_index: Optional[int] = None,
    payload_json: Optional[Dict] = None,
    sourcing_strategy_id: Optional[str] = None,
) -> str:
    """Create a new extraction list. Returns list UUID."""
    data = {
        "name": name,
        "created_at": datetime.utcnow().isoformat(),
    }
    if client_criteria_id:
        data["client_criteria_id"] = client_criteria_id
    if query_name:
        data["query_name"] = query_name
    if query_index is not None:
        data["query_index"] = query_index
    if payload_json:
        data["payload_json"] = payload_json
    if sourcing_strategy_id:
        data["sourcing_strategy_id"] = sourcing_strategy_id

    result = db.table("extraction_lists").insert(data).execute()
    list_id = result.data[0]["id"]
    logger.info(f"Created extraction list: {name} ({list_id})")
    return list_id


def update_extraction_list_counts(
    db: Client,
    extraction_list_id: str,
    property_count: int,
    contact_count: int,
) -> None:
    """Update extraction list with final counts."""
    db.table("extraction_lists").update({
        "property_count": property_count,
        "contact_count": contact_count,
        "extracted_at": datetime.utcnow().isoformat(),
    }).eq("id", extraction_list_id).execute()


def add_to_list_properties(
    db: Client,
    extraction_list_id: str,
    property_ids: List[str],
) -> int:
    """Add properties to extraction list junction table. Returns count added."""
    if not property_ids:
        return 0

    # Batch insert, ignore duplicates
    records = [
        {"extraction_list_id": extraction_list_id, "property_id": pid}
        for pid in property_ids
    ]

    added = 0
    for record in records:
        try:
            db.table("list_properties").upsert(
                record,
                on_conflict="extraction_list_id,property_id"
            ).execute()
            added += 1
        except Exception:
            pass  # Ignore duplicates

    return added


# =============================================================================
# CONTACT SAVING (Main Pipeline)
# =============================================================================

async def save_contacts(
    contacts: List[Dict],
    extraction_list_id: Optional[str] = None,
    client_criteria_id: Optional[str] = None,
) -> Dict[str, int]:
    """
    Save extracted contacts to Supabase.

    Creates/upserts:
    - properties (by costar_property_id)
    - companies (by costar_company_id)
    - contacts (by email)
    - property_loans (from parcel data)
    - property_companies (junction)
    - list_properties (junction, if extraction_list_id provided)

    Args:
        contacts: List of contact dicts from extract_contacts()
        extraction_list_id: Optional extraction list to link properties to
        client_criteria_id: Optional criteria ID for tracking

    Returns:
        Dict with counts: {properties, companies, contacts, loans, list_links}
    """
    if not contacts:
        return {"properties": 0, "companies": 0, "contacts": 0, "loans": 0, "list_links": 0}

    db = get_supabase_client()

    counts = {"properties": 0, "companies": 0, "contacts": 0, "loans": 0, "list_links": 0}

    # Track IDs for relationships
    property_ids = {}  # costar_id -> uuid
    company_ids = {}   # costar_id -> uuid
    list_property_uuids = []  # For list_properties junction

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
                    "market_id": contact.get("market_id"),
                    "last_seen_at": datetime.utcnow().isoformat(),
                }

                result = db.table("properties").upsert(
                    prop_data,
                    on_conflict="costar_property_id"
                ).execute()

                if result.data:
                    prop_uuid = result.data[0]["id"]
                    property_ids[prop_costar_id] = prop_uuid
                    list_property_uuids.append(prop_uuid)
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

            # 5. Insert loan data (from parcel) - skip if already exists
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

                existing = db.table("property_loans").select("id").eq(
                    "property_id", prop_uuid
                ).limit(1).execute()

                if not existing.data:
                    result = db.table("property_loans").insert(loan_data).execute()
                    if result.data:
                        counts["loans"] += 1

        except Exception as e:
            logger.warning(f"Failed to save contact {contact.get('email')}: {e}")
            continue

    # 6. Link properties to extraction list
    if extraction_list_id and list_property_uuids:
        counts["list_links"] = add_to_list_properties(db, extraction_list_id, list_property_uuids)
        update_extraction_list_counts(db, extraction_list_id, counts["properties"], counts["contacts"])

    # 7. Update client_criteria stats if provided
    if client_criteria_id:
        try:
            # Get current totals
            criteria = get_criteria_by_id(db, client_criteria_id)
            if criteria:
                new_total_props = (criteria.get("total_properties") or 0) + counts["properties"]
                new_total_contacts = (criteria.get("total_contacts") or 0) + counts["contacts"]

                db.table("client_criteria").update({
                    "total_properties": new_total_props,
                    "total_contacts": new_total_contacts,
                    "last_extracted_at": datetime.utcnow().isoformat(),
                }).eq("id", client_criteria_id).execute()
        except Exception as e:
            logger.warning(f"Failed to update client_criteria stats: {e}")

    logger.info(f"Saved to DB: {counts}")
    return counts


# =============================================================================
# FULL PIPELINE: From payloads file to DB
# =============================================================================

def setup_extraction_from_payloads_file(
    payloads_file: str,
) -> Tuple[str, str, List[Tuple[str, int, Dict]]]:
    """
    Set up extraction pipeline from a sourcing-agent generated payloads file.

    Creates:
    - Client (if not exists)
    - ClientCriteria
    - ExtractionList records (one per query)

    Args:
        payloads_file: Path to {buyer}_payloads.json file

    Returns:
        Tuple of (client_id, criteria_id, [(extraction_list_id, query_index, payload), ...])
    """
    import json

    with open(payloads_file) as f:
        data = json.load(f)

    db = get_supabase_client()

    # 1. Get or create client
    buyer_name = data.get("buyer", "Unknown")
    client_id = get_or_create_client(db, buyer_name)

    # 2. Create client criteria
    criteria_summary = data.get("criteria_summary", {})
    queries = data.get("queries", [])

    criteria_name = f"{buyer_name} - {datetime.now().strftime('%Y-%m-%d')}"
    criteria_id = create_client_criteria(
        db=db,
        client_id=client_id,
        name=criteria_name,
        criteria_json=criteria_summary,
        queries_json=queries,
        source_file=payloads_file,
    )

    # 3. Create extraction list for each query
    extraction_lists = []
    for i, query in enumerate(queries):
        query_name = query.get("name", f"Query {i+1}")
        payload = query.get("payload", {})

        list_id = create_extraction_list(
            db=db,
            name=query_name,
            client_criteria_id=criteria_id,
            query_name=query_name,
            query_index=i,
            payload_json=payload,
        )

        extraction_lists.append((list_id, i, payload))

    logger.info(f"Setup complete: client={client_id}, criteria={criteria_id}, {len(extraction_lists)} queries")
    return client_id, criteria_id, extraction_lists


# =============================================================================
# HELPERS
# =============================================================================

def _map_property_type(type_id: Optional[int]) -> Optional[str]:
    """Map CoStar property type ID to name."""
    if not type_id:
        return None

    type_map = {
        1: "Hospitality",
        2: "Industrial",
        3: "Land",
        5: "Office",
        6: "Retail",
        7: "Flex",
        11: "Multifamily",
    }
    return type_map.get(type_id, f"Type_{type_id}")


def _parse_date(date_str: Optional[str]) -> Optional[str]:
    """Parse date string to ISO format."""
    if not date_str:
        return None
    try:
        if "T" in date_str:
            return date_str.split("T")[0]
        return date_str
    except Exception:
        return None
