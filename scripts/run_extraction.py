#!/usr/bin/env python3
"""
Upstream Extraction Pipeline Orchestrator

Full pipeline: payloads file → CoStar extraction → DB with proper linking

Usage:
    python scripts/run_extraction.py output/queries/TestCo_Capital_payloads.json

    # Sample extraction (for validation)
    python scripts/run_extraction.py output/queries/TestCo_Capital_payloads.json --sample

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
import time
from pathlib import Path
from typing import Optional

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from integrations.costar import extract_contacts, save_contacts
from integrations.costar.db import (
    setup_extraction_from_payloads_file,
    get_supabase_client,
    log_agent_execution,
    update_agent_execution,
    save_strategy_summary,
    update_criteria_with_results,
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
    is_sample: bool = False,
    strategy_file: Optional[str] = None,
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
        is_sample: Mark extraction lists as 'sample' (for validation runs)
        strategy_file: Path to strategy MD file to save to DB

    Returns:
        Summary dict with counts and metrics
    """
    start_time = time.time()
    logger.info(f"Starting extraction pipeline: {payloads_file}")

    # 1. Verify payloads file exists
    if not Path(payloads_file).exists():
        raise FileNotFoundError(f"Payloads file not found: {payloads_file}")

    # 2. Set up DB records (reuses existing criteria if same file)
    logger.info("Setting up DB records (client, criteria, extraction lists)...")
    client_id, criteria_id, extraction_lists, is_new_criteria = setup_extraction_from_payloads_file(
        payloads_file, is_sample=is_sample
    )

    logger.info(f"  Client ID: {client_id}")
    logger.info(f"  Criteria ID: {criteria_id} ({'new' if is_new_criteria else 'existing'})")
    logger.info(f"  Queries: {len(extraction_lists)}")
    logger.info(f"  Mode: {'sample' if is_sample else 'full'}")

    # 3. Save strategy summary to DB if provided
    if strategy_file and Path(strategy_file).exists():
        db = get_supabase_client()
        with open(strategy_file, "r") as f:
            strategy_content = f.read()
        save_strategy_summary(db, criteria_id, strategy_content)
        logger.info(f"  Saved strategy summary from {strategy_file}")

    if dry_run:
        logger.info("DRY RUN - skipping extraction")
        return {
            "client_id": client_id,
            "criteria_id": criteria_id,
            "queries": len(extraction_lists),
            "is_new_criteria": is_new_criteria,
            "dry_run": True,
        }

    # 4. Filter queries if specific index requested
    original_query_count = len(extraction_lists)
    if query_index is not None:
        if query_index >= len(extraction_lists):
            raise ValueError(f"Query index {query_index} out of range (0-{len(extraction_lists)-1})")
        extraction_lists = [extraction_lists[query_index]]
        logger.info(f"Running only query index {query_index}")

    # 5. Run extraction for each query
    total_counts = {
        "properties": 0,
        "companies": 0,
        "contacts": 0,
        "loans": 0,
        "list_links": 0,
    }
    query_results = []

    for list_id, idx, payload in extraction_lists:
        query_start = time.time()
        logger.info(f"\n{'='*60}")
        logger.info(f"Query {idx + 1}/{original_query_count}: {payload.get('0', {}).get('Property', {}).get('PropertyTypes', 'Unknown')}")
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

        # Track per-query results
        query_duration = int((time.time() - query_start) * 1000)
        query_results.append({
            "query_index": idx,
            "extraction_list_id": list_id,
            "properties": counts.get("properties", 0),
            "contacts": counts.get("contacts", 0),
            "contact_rate": round(counts.get("contacts", 0) / max(counts.get("properties", 1), 1) * 100, 1),
            "duration_ms": query_duration,
        })

        # Accumulate totals
        for key in total_counts:
            total_counts[key] += counts.get(key, 0)

        logger.info(f"Query complete: {counts}")

    # 6. Calculate metrics
    duration_ms = int((time.time() - start_time) * 1000)
    contact_yield_rate = round(
        total_counts["contacts"] / max(total_counts["properties"], 1) * 100, 1
    )

    metrics = {
        "queries_run": len(extraction_lists),
        "properties_found": total_counts["properties"],
        "contacts_found": total_counts["contacts"],
        "contact_yield_rate": contact_yield_rate,
        "is_sample": is_sample,
        "query_results": query_results,
    }

    # 7. Log agent execution
    db = get_supabase_client()
    execution_id = log_agent_execution(
        db=db,
        agent_name="extraction-pipeline",
        status="completed",
        metrics=metrics,
        duration_ms=duration_ms,
        trigger_entity_type="client_criteria",
        trigger_entity_id=criteria_id,
        metadata={
            "payloads_file": payloads_file,
            "max_properties": max_properties,
            "is_sample": is_sample,
        }
    )

    # 8. Summary
    logger.info(f"\n{'='*60}")
    logger.info("EXTRACTION COMPLETE")
    logger.info(f"  Execution ID: {execution_id}")
    logger.info(f"  Client: {client_id}")
    logger.info(f"  Criteria: {criteria_id}")
    logger.info(f"  Mode: {'SAMPLE' if is_sample else 'FULL'}")
    logger.info(f"  Duration: {duration_ms}ms")
    logger.info(f"  Total Properties: {total_counts['properties']}")
    logger.info(f"  Total Contacts: {total_counts['contacts']}")
    logger.info(f"  Contact Yield: {contact_yield_rate}%")

    return {
        "client_id": client_id,
        "criteria_id": criteria_id,
        "execution_id": execution_id,
        "is_new_criteria": is_new_criteria,
        "is_sample": is_sample,
        "duration_ms": duration_ms,
        "contact_yield_rate": contact_yield_rate,
        **total_counts,
        "query_results": query_results,
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
    parser.add_argument(
        "--sample",
        action="store_true",
        help="Mark as sample extraction (for validation). Implies --max-properties 10 if not set.",
    )
    parser.add_argument(
        "--strategy-file",
        type=str,
        default=None,
        help="Path to strategy MD file to save to DB",
    )

    args = parser.parse_args()

    # Sample mode defaults to 10 properties if not specified
    max_properties = args.max_properties
    if args.sample and max_properties is None:
        max_properties = 10

    result = asyncio.run(
        run_extraction(
            payloads_file=args.payloads_file,
            max_properties=max_properties,
            include_parcel=args.include_parcel,
            query_index=args.query_index,
            headless=not args.no_headless,
            dry_run=args.dry_run,
            is_sample=args.sample,
            strategy_file=args.strategy_file,
        )
    )

    # Output result as JSON for programmatic use
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
