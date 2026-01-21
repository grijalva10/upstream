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


class PropertyEnricher:
    """Enriches properties with full details from CoStar APIs.

    Orchestrates multiple API calls per property:
    1. PDS REST API for property details (building, location, land, sale)
    2. GraphQL for true owner contacts
    3. GraphQL for parcel PIN lookup
    4. GraphQL for parcel/loan details
    """

    def __init__(
        self,
        client: CoStarClient,
        include_contacts: bool = True,
        include_parcel: bool = True,
        include_loans: bool = True,
        concurrency: int = 5,
        min_delay: float = 0.2,
        max_delay: float = 0.5,
    ):
        self.client = client
        self.include_contacts = include_contacts
        self.include_parcel = include_parcel
        self.include_loans = include_loans
        self.concurrency = concurrency
        self.min_delay = min_delay
        self.max_delay = max_delay
        self._semaphore: Optional[asyncio.Semaphore] = None

    async def enrich_properties(self, property_ids: List[int]) -> List[Dict]:
        """Enrich multiple properties with full details.

        Returns list of enriched property dicts with all available data.
        """
        self._semaphore = asyncio.Semaphore(self.concurrency)
        results = []

        # Process in batches for progress logging
        batch_size = 50
        for batch_start in range(0, len(property_ids), batch_size):
            batch = property_ids[batch_start:batch_start + batch_size]

            tasks = [self._enrich_with_rate_limit(pid) for pid in batch]
            batch_results = await asyncio.gather(*tasks, return_exceptions=True)

            for pid, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to enrich property {pid}: {result}")
                    results.append({"property_id": pid, "error": str(result)})
                else:
                    results.append(result)

            processed = batch_start + len(batch)
            logger.info(f"Progress: {processed}/{len(property_ids)} properties enriched")

        return results

    async def _enrich_with_rate_limit(self, property_id: int) -> Dict:
        """Enrich single property with rate limiting."""
        async with self._semaphore:
            delay = random.uniform(self.min_delay, self.max_delay)
            await asyncio.sleep(delay)
            return await self._enrich_property(property_id)

    async def _enrich_property(self, property_id: int) -> Dict:
        """Enrich a single property with all available data."""
        result = {"property_id": property_id}

        # 1. Get property details from PDS REST API
        pds_data = await self.client.get_property_details(property_id)
        if pds_data.get("error"):
            result["error"] = pds_data["error"]
            return result

        # Extract and flatten PDS data
        result.update(self._extract_pds_data(pds_data))

        # 2. Get contacts if requested
        if self.include_contacts:
            contacts = await self._get_contacts(property_id)
            result["contacts"] = contacts

        # 3. Get parcel/loan data if requested
        if self.include_parcel or self.include_loans:
            parcel_data = await self._get_parcel_and_loans(property_id)
            result.update(parcel_data)

        return result

    def _extract_pds_data(self, pds: Dict) -> Dict:
        """Extract and flatten relevant fields from PDS response."""
        building = pds.get("Building", {})
        location = pds.get("Location", {})
        delivery = location.get("DeliveryAddress", {})
        land = pds.get("Land", {})
        header = pds.get("DetailHeader", {})
        sale = pds.get("RecentSaleCompSummary", {})
        geo = location.get("Location", {})

        # Extract building area with fallback
        building_area = building.get("BuildingArea", {})
        rba = building.get("RBA", {})

        # Extract land area
        land_area_high = land.get("HighPrecisionGrossArea", {})
        land_area_low = land.get("LowPrecisionGrossArea", {})

        return {
            # Property identifiers
            "costar_property_id": str(pds.get("PropertyId")),
            "property_name": pds.get("Name"),

            # Address
            "address": delivery.get("DeliveryAddress"),
            "city": delivery.get("CityName"),
            "state_code": delivery.get("SubdivisionCode"),
            "postal_code": delivery.get("PostalCode"),
            "county": delivery.get("CountyName"),

            # Location
            "latitude": geo.get("Latitude"),
            "longitude": geo.get("Longitude"),
            "market_id": location.get("MarketId"),
            "market": location.get("Market"),
            "submarket": location.get("Submarket"),
            "submarket_id": location.get("SubmarketId"),
            "submarket_cluster": location.get("SubmarketCluster"),
            "location_type": pds.get("LocationType"),

            # Property type
            "property_type": pds.get("Type"),
            "property_type_id": pds.get("PropertyTypeId"),
            "secondary_type": pds.get("Subtype"),
            "property_subtype_id": pds.get("PropertySubtypeId"),
            "star_rating": pds.get("Rating") or header.get("StarRating"),

            # Building
            "building_size_sqft": building_area.get("Raw") or rba.get("Raw"),
            "building_class": building.get("BuildingClass"),
            "year_built": building.get("YearBuilt"),
            "year_renovated": building.get("YearRenovated"),
            "number_of_stories": building.get("Stories", {}).get("Raw"),
            "tenancy": building.get("Tenancy"),
            "owner_occupied": building.get("OwnerOccupied"),

            # Building details
            "ceiling_height": building.get("CeilingHeight"),
            "parking_ratio": building.get("ParkingRatio"),
            "parking_spaces": building.get("ParkingSpaces"),
            "parking_description": building.get("ParkingDescription"),

            # Industrial specific
            "docks": building.get("Docks"),
            "cross_docks": building.get("CrossDocks"),
            "drive_ins": building.get("DriveIns"),
            "crane": building.get("Cranes"),
            "rail": building.get("RailSpots"),
            "power": building.get("Power"),

            # Multifamily specific
            "units": building.get("Units"),
            "num_of_beds": building.get("NumberOfBeds"),

            # Land
            "lot_size_sqft": land_area_high.get("Raw"),
            "lot_size_acres": land_area_low.get("Raw"),
            "zoning": land.get("Zoning"),
            "parcel_number": land.get("Parcel"),
            "far": building.get("FAR"),

            # Sale info
            "last_sale_date": sale.get("SoldDate", {}).get("Raw"),
            "last_sale_price": sale.get("SoldDescription"),
            "cap_rate": sale.get("CapitalizationRate"),
            "sale_type": sale.get("SaleType"),

            # Amenities
            "amenities": [a.get("Name") for a in pds.get("Amenities", {}).get("Items", [])],

            # Flags
            "is_opportunity_zone": pds.get("isOpportunityZone"),
            "is_leed_certified": building.get("IsLeedCertified"),
            "is_energy_star": building.get("IsEnergyStarCertified"),
        }

    async def _get_contacts(self, property_id: int) -> List[Dict]:
        """Get true owner contacts for property."""
        try:
            data = await self.client.graphql(CONTACTS_QUERY, {"propertyId": property_id})

            prop_detail = data.get("propertyDetail", {})
            contact_info = prop_detail.get("propertyContactDetails_info", {})
            true_owner = contact_info.get("trueOwner")

            if isinstance(true_owner, list):
                true_owner = true_owner[0] if true_owner else {}
            elif not true_owner:
                true_owner = {}

            if not true_owner:
                return []

            contacts = []
            for person in true_owner.get("contacts", []):
                contacts.append({
                    "person_id": person.get("personId"),
                    "name": person.get("name"),
                    "title": person.get("title"),
                    "email": person.get("email"),
                    "phones": person.get("phoneNumbers", []),
                    "company_id": true_owner.get("companyId"),
                    "company_name": true_owner.get("name"),
                    "company_address": true_owner.get("address"),
                    "company_phones": true_owner.get("phoneNumbers", []),
                })

            return contacts

        except Exception as e:
            logger.warning(f"Failed to get contacts for property {property_id}: {e}")
            return []

    async def _get_parcel_and_loans(self, property_id: int) -> Dict:
        """Get parcel and loan data for property."""
        result = {}

        try:
            # Get parcel PIN
            pins_data = await self.client.graphql(PARCEL_PINS_QUERY, {"propertyId": property_id})
            parcel_pins = pins_data.get("parcelPinsFromProperty", {}).get("parcelPins", [])

            if not parcel_pins or not parcel_pins[0].get("id"):
                return result

            parcel_id = str(parcel_pins[0]["id"])

            # Small delay before next request
            await asyncio.sleep(random.uniform(0.05, 0.15))

            # Get parcel details
            parcel_data = await self.client.graphql(PARCEL_DETAILS_QUERY, {"parcelId": parcel_id})
            pr_detail = parcel_data.get("publicRecordDetailNew", {})
            parcel = pr_detail.get("parcelDetail", {})
            sales = pr_detail.get("parcelSales", {}).get("sales", [])

            if self.include_parcel:
                result["apn"] = parcel.get("apn")
                result["parcel_lot_size_sf"] = parcel.get("lotSizeSf")
                result["parcel_zoning"] = parcel.get("zoning")

            if self.include_loans and sales:
                sale = sales[0]
                result["sale_date"] = sale.get("saleDate")
                result["sale_price"] = sale.get("salePriceTotal")
                result["seller"] = sale.get("seller")
                result["ltv"] = sale.get("ltv")

                loans = sale.get("loans", [])
                if loans:
                    # Include all loans, not just first
                    result["loans"] = [
                        {
                            "lender": loan.get("lender"),
                            "amount": loan.get("mortgageAmount"),
                            "rate": loan.get("intRate"),
                            "term_months": loan.get("mortgageTerm"),
                            "origination_date": loan.get("originationDate"),
                        }
                        for loan in loans
                    ]

        except Exception as e:
            logger.warning(f"Failed to get parcel/loan data for property {property_id}: {e}")

        return result
