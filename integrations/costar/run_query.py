#!/usr/bin/env python3
"""
CoStar Query Runner - Called by pg-boss worker to execute queries.

This script is the bridge between the Node.js worker and Python CoStar integration.
It receives query parameters via command line, runs the query, and outputs JSON.

Usage:
    python integrations/costar/run_query.py \
        --query-type find_sellers \
        --payload '{"0": {...}}' \
        --max-properties 100
"""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from integrations.costar.queries import find_sellers

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
    stream=sys.stderr,  # Log to stderr so stdout is clean JSON
)
logger = logging.getLogger(__name__)


async def run_find_sellers(payload: dict, options: dict) -> dict:
    """Run find_sellers query and return results."""
    try:
        contacts = await find_sellers(
            payload=payload,
            max_properties=options.get("max_properties"),
            include_parcel=options.get("include_parcel", False),
            headless=options.get("headless", True),
        )
        return {
            "contacts": contacts,
            "propertiesProcessed": len(set(c.get("property_id") for c in contacts)),
        }
    except Exception as e:
        logger.error(f"find_sellers failed: {e}")
        return {"error": str(e), "contacts": []}


async def run_find_buyers(payload: dict, options: dict) -> dict:
    """Run find_buyers query (not yet implemented)."""
    return {"error": "find_buyers is not yet implemented", "buyers": []}


async def run_market_analytics(payload: dict, options: dict) -> dict:
    """Run market_analytics query (not yet implemented)."""
    return {"error": "market_analytics is not yet implemented", "analytics": {}}


async def main():
    parser = argparse.ArgumentParser(description="Run CoStar query")
    parser.add_argument(
        "--query-type",
        required=True,
        choices=["find_sellers", "find_buyers", "market_analytics"],
        help="Type of query to run",
    )
    parser.add_argument(
        "--payload",
        required=True,
        help="JSON payload for the query",
    )
    parser.add_argument(
        "--max-properties",
        type=int,
        default=None,
        help="Maximum properties to process",
    )
    parser.add_argument(
        "--include-parcel",
        action="store_true",
        help="Include parcel/loan data",
    )
    parser.add_argument(
        "--no-headless",
        action="store_true",
        help="Show browser window",
    )

    args = parser.parse_args()

    # Parse payload
    try:
        payload = json.loads(args.payload)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid payload JSON: {e}"}))
        sys.exit(1)

    options = {
        "max_properties": args.max_properties,
        "include_parcel": args.include_parcel,
        "headless": not args.no_headless,
    }

    logger.info(f"Running {args.query_type} query...")

    # Run the appropriate query
    if args.query_type == "find_sellers":
        result = await run_find_sellers(payload, options)
    elif args.query_type == "find_buyers":
        result = await run_find_buyers(payload, options)
    elif args.query_type == "market_analytics":
        result = await run_market_analytics(payload, options)
    else:
        result = {"error": f"Unknown query type: {args.query_type}"}

    # Output JSON result (to stdout, logs go to stderr)
    print(json.dumps(result, default=str))


if __name__ == "__main__":
    asyncio.run(main())
