#!/usr/bin/env python3
"""
Upstream Extraction Pipeline Orchestrator

Full pipeline: payloads file → CoStar extraction → DB with proper linking

Usage:
    python scripts/run_extraction.py output/queries/TestCo_Capital_payloads.json

    # With options
    python scripts/run_extraction.py output/queries/TestCo_Capital_payloads.json \
        --max-properties 100 \
        --include-parcel \
        --query-index 0  # Run only first query
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from integrations.costar import extract_contacts, save_contacts
from integrations.costar.db import (
    setup_extraction_from_payloads_file,
    get_supabase_client,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


async def run_extraction(
    payloads_file: str,
    max_properties: Optional[int] = None,
    include_parcel: bool = False,
    query_index: Optional[int] = None,
    headless: bool = True,
    dry_run: bool = False,
) -> dict:
    """
    Run the full extraction pipeline.

    Args:
        payloads_file: Path to sourcing-agent generated payloads file
        max_properties: Max properties per query (None = unlimited)
        include_parcel: Fetch parcel/loan data (slower, more API calls)
        query_index: Run only this query index (None = all)
        headless: Run browser in background
        dry_run: Set up DB records but don't run extraction

    Returns:
        Summary dict with counts
    """
    logger.info(f"Starting extraction pipeline: {payloads_file}")

    # 1. Verify payloads file exists
    if not Path(payloads_file).exists():
        raise FileNotFoundError(f"Payloads file not found: {payloads_file}")

    # 2. Set up DB records
    logger.info("Setting up DB records (client, criteria, extraction lists)...")
    client_id, criteria_id, extraction_lists = setup_extraction_from_payloads_file(payloads_file)

    logger.info(f"  Client ID: {client_id}")
    logger.info(f"  Criteria ID: {criteria_id}")
    logger.info(f"  Queries: {len(extraction_lists)}")

    if dry_run:
        logger.info("DRY RUN - skipping extraction")
        return {
            "client_id": client_id,
            "criteria_id": criteria_id,
            "queries": len(extraction_lists),
            "dry_run": True,
        }

    # 3. Filter queries if specific index requested
    if query_index is not None:
        if query_index >= len(extraction_lists):
            raise ValueError(f"Query index {query_index} out of range (0-{len(extraction_lists)-1})")
        extraction_lists = [extraction_lists[query_index]]
        logger.info(f"Running only query index {query_index}")

    # 4. Run extraction for each query
    total_counts = {
        "properties": 0,
        "companies": 0,
        "contacts": 0,
        "loans": 0,
        "list_links": 0,
    }

    for list_id, idx, payload in extraction_lists:
        logger.info(f"\n{'='*60}")
        logger.info(f"Query {idx + 1}/{len(extraction_lists)}: {payload.get('0', {}).get('Property', {}).get('PropertyTypes', 'Unknown')}")
        logger.info(f"Extraction List ID: {list_id}")

        # Run CoStar extraction
        contacts = await extract_contacts(
            payloads=payload,
            max_properties=max_properties,
            require_email=True,
            include_parcel=include_parcel,
            headless=headless,
        )

        logger.info(f"Extracted {len(contacts)} contacts")

        # Save to DB with proper linking
        counts = await save_contacts(
            contacts=contacts,
            extraction_list_id=list_id,
            client_criteria_id=criteria_id,
        )

        # Accumulate totals
        for key in total_counts:
            total_counts[key] += counts.get(key, 0)

        logger.info(f"Query complete: {counts}")

    # 5. Summary
    logger.info(f"\n{'='*60}")
    logger.info("EXTRACTION COMPLETE")
    logger.info(f"  Client: {client_id}")
    logger.info(f"  Criteria: {criteria_id}")
    logger.info(f"  Total Properties: {total_counts['properties']}")
    logger.info(f"  Total Companies: {total_counts['companies']}")
    logger.info(f"  Total Contacts: {total_counts['contacts']}")
    logger.info(f"  Total Loans: {total_counts['loans']}")
    logger.info(f"  List Links: {total_counts['list_links']}")

    return {
        "client_id": client_id,
        "criteria_id": criteria_id,
        **total_counts,
    }


async def run_from_criteria_id(
    criteria_id: str,
    max_properties: Optional[int] = None,
    include_parcel: bool = False,
    query_index: Optional[int] = None,
    headless: bool = True,
) -> dict:
    """
    Run extraction for an existing client_criteria record.

    Useful for re-running or running additional queries.

    Args:
        criteria_id: UUID of existing client_criteria record
        max_properties: Max properties per query
        include_parcel: Fetch parcel/loan data
        query_index: Run only this query index
        headless: Run browser in background

    Returns:
        Summary dict with counts
    """
    from integrations.costar.db import (
        get_criteria_by_id,
        create_extraction_list,
    )

    db = get_supabase_client()

    # 1. Get criteria
    criteria = get_criteria_by_id(db, criteria_id)
    if not criteria:
        raise ValueError(f"Criteria not found: {criteria_id}")

    queries = criteria.get("queries_json", [])
    if not queries:
        raise ValueError("No queries in criteria")

    logger.info(f"Running extraction for criteria: {criteria['name']}")
    logger.info(f"  Client ID: {criteria['client_id']}")
    logger.info(f"  Queries: {len(queries)}")

    # 2. Filter queries if specific index requested
    if query_index is not None:
        if query_index >= len(queries):
            raise ValueError(f"Query index {query_index} out of range")
        queries = [(query_index, queries[query_index])]
    else:
        queries = list(enumerate(queries))

    # 3. Run each query
    total_counts = {
        "properties": 0,
        "companies": 0,
        "contacts": 0,
        "loans": 0,
        "list_links": 0,
    }

    for idx, query in queries:
        query_name = query.get("name", f"Query {idx+1}")
        payload = query.get("payload", {})

        # Create new extraction list for this run
        list_id = create_extraction_list(
            db=db,
            name=f"{query_name} (re-run)",
            client_criteria_id=criteria_id,
            query_name=query_name,
            query_index=idx,
            payload_json=payload,
        )

        logger.info(f"\nQuery {idx + 1}: {query_name}")
        logger.info(f"Extraction List ID: {list_id}")

        # Run extraction
        contacts = await extract_contacts(
            payloads=payload,
            max_properties=max_properties,
            require_email=True,
            include_parcel=include_parcel,
            headless=headless,
        )

        # Save with linking
        counts = await save_contacts(
            contacts=contacts,
            extraction_list_id=list_id,
            client_criteria_id=criteria_id,
        )

        for key in total_counts:
            total_counts[key] += counts.get(key, 0)

    logger.info(f"\nExtraction complete: {total_counts}")
    return {
        "criteria_id": criteria_id,
        **total_counts,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Run CoStar extraction pipeline from payloads file"
    )
    parser.add_argument(
        "payloads_file",
        help="Path to sourcing-agent generated payloads JSON file",
    )
    parser.add_argument(
        "--max-properties",
        type=int,
        default=None,
        help="Max properties to extract per query (default: unlimited)",
    )
    parser.add_argument(
        "--include-parcel",
        action="store_true",
        help="Fetch parcel/loan data (slower)",
    )
    parser.add_argument(
        "--query-index",
        type=int,
        default=None,
        help="Run only this query index (0-based)",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="Show browser window (for debugging)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Set up DB records but don't run extraction",
    )

    args = parser.parse_args()

    result = asyncio.run(
        run_extraction(
            payloads_file=args.payloads_file,
            max_properties=args.max_properties,
            include_parcel=args.include_parcel,
            query_index=args.query_index,
            headless=not args.no_headless,
            dry_run=args.dry_run,
        )
    )

    # Output result as JSON for programmatic use
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
