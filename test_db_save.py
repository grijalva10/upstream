"""Test CoStar extraction and database save."""

import asyncio
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')

async def main():
    from integrations.costar import extract_contacts, save_contacts

    # Sample payload - Multifamily properties (more likely to have contacts)
    payload = {
        "0": {
            "Geography": {
                "Filter": {
                    "FilterType": 132,
                    "Ids": [130]  # Orange County - CA
                }
            },
            "Property": {
                "PropertyTypes": [11],  # Multifamily
                "Building": {
                    "BuildingArea": {
                        "Minimum": {"Value": 50000, "Code": "[sft_i]"},
                        "Maximum": {"Value": 500000, "Code": "[sft_i]"}
                    },
                    "ConstructionStatuses": [1]
                },
                "Land": {},
                "Parking": {},
                "OwnerTypes": [3, 6, 14]  # Corporate, Equity Fund, Private
            },
            "ListingType": 0
        },
        "1": 20,
        "2": 1,
        "3": {
            "RateBasis": "month",
            "CurrencyCode": "USD",
            "BuildingAreaUnit": "SF",
            "secondaryAreaUnit": "SF",
            "AreaUom": "AC",
            "lengthUnit": "FT"
        },
        "4": False,
        "5": []
    }

    print("Extracting contacts from CoStar...")
    contacts = await extract_contacts(
        payload,
        max_properties=20,
        include_parcel=True,
        headless=False
    )

    print(f"\nExtracted {len(contacts)} contacts")

    if contacts:
        print("\nFirst contact:")
        for k, v in contacts[0].items():
            print(f"  {k}: {v}")

        print("\nSaving to database...")
        counts = await save_contacts(contacts)
        print(f"\nSaved: {counts}")

if __name__ == "__main__":
    asyncio.run(main())
