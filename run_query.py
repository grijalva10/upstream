"""Run CoStar extraction from a query file."""

import asyncio
import json
import logging
import sys

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

async def main():
    from integrations.costar import extract_contacts, save_contacts

    if len(sys.argv) < 2:
        print("Usage: python run_query.py <query_file.json>")
        sys.exit(1)

    query_file = sys.argv[1]

    with open(query_file) as f:
        data = json.load(f)

    buyer = data.get("buyer", "Unknown")
    queries = data.get("queries", [])

    print(f"\n{'='*60}")
    print(f"Running queries for: {buyer}")
    print(f"Criteria: {data.get('criteria_summary', {})}")
    print(f"Number of queries: {len(queries)}")
    print(f"{'='*60}\n")

    # Extract payloads from queries
    payloads = []
    for q in queries:
        print(f"  - {q['name']} ({q['strategy']})")
        print(f"    {q['rationale'][:100]}...")
        payloads.append(q['payload'])

    print(f"\nStarting extraction (batch of {len(payloads)} queries)...")

    contacts = await extract_contacts(
        payloads,
        max_properties=10,  # Limit per query for testing
        include_parcel=True,
        headless=False
    )

    print(f"\n{'='*60}")
    print(f"Extraction complete: {len(contacts)} unique contacts")
    print(f"{'='*60}")

    if contacts:
        print("\nSample contacts:")
        for i, c in enumerate(contacts[:5]):
            print(f"\n{i+1}. {c.get('contact_name')} - {c.get('contact_title')}")
            print(f"   Company: {c.get('company_name')}")
            print(f"   Email: {c.get('email')}")
            print(f"   Property: {c.get('property_address')}")
            print(f"   Market ID: {c.get('market_id')}")

        print("\nSaving to database...")
        counts = await save_contacts(contacts)
        print(f"Saved: {counts}")

if __name__ == "__main__":
    asyncio.run(main())
