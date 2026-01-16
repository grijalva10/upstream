"""CoStar Contact Extraction - GraphQL Queries and Data Mapping."""

import asyncio
import logging
import random
from typing import Any, Dict, List, Optional

from .client import CoStarClient

logger = logging.getLogger(__name__)

CONTACTS_QUERY = """
query ContactsDetail($propertyId: Int!) {
  propertyDetail {
    propertyDetailHeader(propertyId: $propertyId) {
      propertyId
      addressHeader
      propertyType
      buildingSize
      landSize
      yearBuilt
    }
    propertyContactDetails_info(propertyId: $propertyId) {
      trueOwner {
        companyId
        name
        address
        phoneNumbers
        contacts {
          personId
          name
          title
          email
          phoneNumbers
        }
      }
    }
  }
}
"""

PARCEL_PINS_QUERY = """
query parcelPinsFromProperty($propertyId: Int!) {
  parcelPinsFromProperty(propertyId: $propertyId) {
    parcelPins { id }
  }
}
"""

PARCEL_DETAILS_QUERY = """
query Parcel_Info($parcelId: String!) {
  publicRecordDetailNew {
    parcelDetail(parcelId: $parcelId) {
      apn
      lotSizeSf
      zoning
    }
    parcelSales(parcelId: $parcelId) {
      sales {
        saleDate
        salePriceTotal
        seller
        ltv
        loans {
          lender
          mortgageAmount
          intRate
          mortgageTerm
          originationDate
        }
      }
    }
  }
}
"""


class ContactExtractor:
    """Extracts property owner contacts from CoStar with optional parcel data."""

    def __init__(
        self,
        client: CoStarClient,
        require_email: bool = True,
        require_phone: bool = False,
        include_parcel: bool = False,
        include_market: bool = False,
        concurrency: int = 8,  # Max parallel requests (aggressively safe)
        min_delay: float = 0.15,  # Min delay between requests
        max_delay: float = 0.4,  # Max delay between requests
        burst_size: int = 150,  # Properties before taking a break
        burst_delay: float = 3.0,  # Seconds to pause between bursts
    ):
        self.client = client
        self.require_email = require_email
        self.require_phone = require_phone
        self.include_parcel = include_parcel
        self.include_market = include_market
        self.concurrency = concurrency
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.burst_size = burst_size
        self.burst_delay = burst_delay
        self._seen_emails: set = set()
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._properties_since_burst: int = 0

    async def extract_from_payloads(
        self,
        payloads: List[Dict],
        max_properties: Optional[int] = None
    ) -> List[Dict]:
        """Extract contacts from multiple search payloads, deduplicated by email.

        Safe for large extractions (10k+) with:
        - Conservative concurrency (3 parallel requests)
        - Burst pauses every 50 properties
        - Variable delays between requests
        - Progress logging every 100 properties
        """
        all_contacts = []
        properties_processed = 0
        self._semaphore = asyncio.Semaphore(self.concurrency)
        self._properties_since_burst = 0

        total_pins = 0
        for i, payload in enumerate(payloads):
            logger.info(f"Processing payload {i+1}/{len(payloads)}")

            # Extract market_id from payload geography filter
            market_ids = self._extract_market_ids(payload)

            pins = await self.client.search_properties(payload)
            total_pins += len(pins)

            # DEBUG: Log first pin structure to verify field names
            if pins and i == 0:
                first_pin = pins[0]
                logger.info(f"DEBUG: First pin keys: {list(first_pin.keys())}")
                logger.info(f"DEBUG: First pin City={first_pin.get('City')}, StateCode={first_pin.get('StateCode')}")
                logger.info(f"DEBUG: First pin TrueOwner={first_pin.get('TrueOwner')}")
                logger.info(f"DEBUG: include_parcel={self.include_parcel}")

            # Apply max_properties limit across all payloads
            if max_properties:
                remaining = max_properties - properties_processed
                if remaining <= 0:
                    break
                pins = pins[:remaining]

            # Process properties in small batches for parallel execution
            batch_size = self.concurrency * 2  # Process 2x concurrency at a time
            for batch_start in range(0, len(pins), batch_size):
                batch = pins[batch_start:batch_start + batch_size]

                # Create tasks for parallel execution
                tasks = []
                for prop in batch:
                    # Handle both formats: PropertyId from properties array, or i from Pins
                    property_id = prop.get("PropertyId") or prop.get("i")
                    if property_id:
                        # Pass full property data for rich extraction
                        tasks.append(self._extract_property_contacts_with_evasion(property_id, market_ids, prop))

                # Execute batch in parallel with semaphore limiting
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, Exception):
                        logger.warning(f"Batch extraction error: {result}")
                        continue
                    if result:
                        all_contacts.extend(result)

                properties_processed += len(batch)
                self._properties_since_burst += len(batch)

                # Progress logging every 100 properties
                if properties_processed % 100 == 0 and properties_processed > 0:
                    logger.info(f"Progress: {properties_processed}/{total_pins} properties, {len(all_contacts)} contacts")

                # Burst pause for safety - take a break every N properties
                if self._properties_since_burst >= self.burst_size:
                    pause = self.burst_delay + random.uniform(0, 2)  # Add randomness
                    logger.info(f"Burst pause: {pause:.1f}s after {self._properties_since_burst} properties")
                    await asyncio.sleep(pause)
                    self._properties_since_burst = 0

        logger.info(f"Extraction complete: {properties_processed} properties, {len(all_contacts)} unique contacts")
        return all_contacts

    async def _extract_property_contacts_with_evasion(
        self,
        property_id: int,
        market_ids: Optional[List[int]] = None,
        search_result: Optional[Dict] = None
    ) -> List[Dict]:
        """Wrapper that adds rate limiting and variable delays for evasion."""
        async with self._semaphore:
            # Variable delay before request (evasion)
            delay = random.uniform(self.min_delay, self.max_delay)
            await asyncio.sleep(delay)

            return await self._extract_property_contacts(property_id, market_ids, search_result)

    async def _extract_property_contacts(
        self,
        property_id: int,
        market_ids: Optional[List[int]] = None,
        search_result: Optional[Dict] = None
    ) -> List[Dict]:
        try:
            # DEBUG: Log what search_result we received
            logger.debug(f"Property {property_id}: search_result has {len(search_result) if search_result else 0} keys")

            data = await self.client.graphql(CONTACTS_QUERY, {"propertyId": property_id})

            prop_detail = data.get("propertyDetail", {})
            header = prop_detail.get("propertyDetailHeader", {})
            contact_info = prop_detail.get("propertyContactDetails_info", {})
            true_owner = contact_info.get("trueOwner")

            # trueOwner can be a list or dict
            if isinstance(true_owner, list):
                true_owner = true_owner[0] if true_owner else {}
            elif not true_owner:
                true_owner = {}

            if not true_owner:
                return []

            # Extract rich data from search result (list-properties response)
            sr = search_result or {}

            # TrueOwner is an array in the properties response
            true_owner_list = sr.get("TrueOwner") or []
            sr_true_owner = true_owner_list[0] if isinstance(true_owner_list, list) and true_owner_list else (true_owner_list if isinstance(true_owner_list, dict) else {})

            # DEBUG: Log extracted values
            if sr:
                logger.debug(f"Property {property_id}: SR City={sr.get('City')}, State={sr.get('StateCode')}, TrueOwner={sr_true_owner}")

            # Build base property data with all available fields
            base = {
                # Core identifiers - use function arg as fallback since GraphQL may not return it
                "property_id": header.get("propertyId") or property_id,
                "property_address": header.get("addressHeader"),

                # From search result - comprehensive property data
                "property_type": sr.get("PropertyType") or header.get("propertyType"),
                "property_type_id": sr.get("PropertyTypeId"),
                "secondary_type": sr.get("SecondaryType"),
                "building_size": sr.get("BuildingAreaTotal") or sr.get("BuildingSF") or header.get("buildingSize"),
                "land_size": sr.get("LandArea") or header.get("landSize"),
                "year_built": sr.get("YearBuilt") or header.get("yearBuilt"),

                # Location fields
                "city": sr.get("City"),
                "state_code": sr.get("StateCode"),
                "postal_code": sr.get("PostalCode"),
                "county": sr.get("County"),
                "submarket": sr.get("Submarket"),
                "submarket_cluster": sr.get("SubmarketCluster"),

                # Building characteristics
                "building_class": sr.get("BuildingClass"),
                "building_status": sr.get("BuildingStatus"),
                "star_rating": sr.get("StarRating"),
                "tenancy": sr.get("Tenancy"),
                "number_of_stories": sr.get("NumberOfStories"),
                "ceiling_height": sr.get("CeilingHeight"),
                "zoning": sr.get("Zoning"),

                # Parking
                "parking_ratio": sr.get("ParkingRatio"),
                "parking_spaces": sr.get("ParkingSpaces"),

                # Industrial-specific
                "docks": sr.get("Docks"),
                "drive_ins": sr.get("DriveIns"),
                "power": sr.get("Power"),
                "rail": sr.get("Rail"),
                "crane": sr.get("Crane"),

                # Multifamily-specific
                "num_of_beds": sr.get("NumOfBeds"),

                # Sale info
                "last_sale_date": sr.get("LastSaleDate"),
                "last_sale_price": sr.get("LastSalePrice"),

                # Management
                "property_manager": sr.get("PropertyManager"),

                # Leasing info
                "percent_leased": sr.get("PercentLeased"),
                "available_sf": sr.get("AvailableSF"),

                # Market
                "market_id": market_ids[0] if market_ids else None,

                # Company/Owner data from search result TrueOwner (fields are lowercase)
                "company_id": sr_true_owner.get("id") or true_owner.get("companyId"),
                "company_name": sr_true_owner.get("name") or true_owner.get("name"),
                "company_costar_key": sr_true_owner.get("key"),
                "company_type": sr_true_owner.get("type"),
                "company_address": true_owner.get("address"),
                "company_phone": self._format_phones(true_owner.get("phoneNumbers")),
            }

            # First check if we have any valid contacts with email BEFORE fetching parcel
            raw_contacts = true_owner.get("contacts", [])
            valid_contacts = []

            for person in raw_contacts:
                contact = self._build_contact(base, person)
                if contact:
                    valid_contacts.append((person, contact))

            # Skip parcel fetch if no valid contacts (optimization)
            if not valid_contacts:
                return []

            # Only fetch parcel data if we have valid contacts and parcel is requested
            if self.include_parcel:
                logger.info(f"Property {property_id}: Fetching parcel data...")
                parcel_data = await self._get_parcel_data(property_id)
                logger.info(f"Property {property_id}: Parcel data = {parcel_data}")
                # Merge parcel data into each contact
                for _, contact in valid_contacts:
                    contact.update(parcel_data)
            else:
                logger.debug(f"Property {property_id}: include_parcel={self.include_parcel}, skipping parcel fetch")

            return [contact for _, contact in valid_contacts]

        except Exception as e:
            logger.warning(f"Failed to extract property {property_id}: {e}")
            return []

    def _build_contact(self, base: Dict, person: Dict) -> Optional[Dict]:
        email = person.get("email", "")
        phone = self._format_phones(person.get("phoneNumbers"))
        name = person.get("name", "")
        company = base.get("company_name", "")

        if not company or not name:
            return None
        if self.require_email and not self._valid_email(email):
            return None
        if self.require_phone and not phone:
            return None

        email_lower = email.lower()
        if email_lower:
            if email_lower in self._seen_emails:
                return None
            self._seen_emails.add(email_lower)

        return {
            **base,
            "contact_id": person.get("personId"),
            "contact_name": name,
            "contact_title": person.get("title"),
            "email": email,
            "phone": phone,
        }

    async def _get_parcel_data(self, property_id: int) -> Dict:
        try:
            # Minimal delay between parcel requests
            await asyncio.sleep(random.uniform(0.05, 0.15))

            pins_data = await self.client.graphql(PARCEL_PINS_QUERY, {"propertyId": property_id})
            parcel_pins = pins_data.get("parcelPinsFromProperty", {}).get("parcelPins", [])

            if not parcel_pins or not parcel_pins[0].get("id"):
                return {}

            parcel_id = str(parcel_pins[0]["id"])

            # Minimal delay before details request
            await asyncio.sleep(random.uniform(0.05, 0.15))

            parcel_data = await self.client.graphql(PARCEL_DETAILS_QUERY, {"parcelId": parcel_id})

            pr_detail = parcel_data.get("publicRecordDetailNew", {})
            parcel = pr_detail.get("parcelDetail", {})
            sales = pr_detail.get("parcelSales", {}).get("sales", [])

            result = {
                "apn": parcel.get("apn"),
                "lot_size_sf": parcel.get("lotSizeSf"),
            }

            if sales:
                sale = sales[0]
                result.update({
                    "sale_date": sale.get("saleDate"),
                    "sale_price": sale.get("salePriceTotal"),
                    "seller": sale.get("seller"),
                    "ltv": sale.get("ltv"),
                })

                if sale.get("loans"):
                    loan = sale["loans"][0]
                    result.update({
                        "lender": loan.get("lender"),
                        "loan_amount": loan.get("mortgageAmount"),
                        "loan_rate": loan.get("intRate"),
                        "loan_term_months": loan.get("mortgageTerm"),
                        "loan_origination": loan.get("originationDate"),
                    })

            return result

        except Exception as e:
            logger.warning(f"Failed to get parcel data for {property_id}: {e}")
            return {}

    @staticmethod
    def _format_phones(phones: Any) -> str:
        if not phones:
            return ""
        if isinstance(phones, list):
            return phones[0] if phones else ""
        return str(phones)

    @staticmethod
    def _valid_email(email: str) -> bool:
        return bool(email and "@" in email and "." in email)

    @staticmethod
    def _extract_market_ids(payload: Dict) -> List[int]:
        """Extract market IDs from payload geography filter."""
        try:
            filter_data = payload.get("0", {})
            geography = filter_data.get("Geography", {})
            geo_filter = geography.get("Filter", {})
            ids = geo_filter.get("Ids", [])
            return ids if isinstance(ids, list) else [ids]
        except (KeyError, TypeError):
            return []
