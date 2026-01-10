"""CoStar Contact Extraction - GraphQL Queries and Data Mapping."""

import logging
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
        include_market: bool = False
    ):
        self.client = client
        self.require_email = require_email
        self.require_phone = require_phone
        self.include_parcel = include_parcel
        self.include_market = include_market
        self._seen_emails: set = set()

    async def extract_from_payloads(
        self,
        payloads: List[Dict],
        max_properties: Optional[int] = None
    ) -> List[Dict]:
        """Extract contacts from multiple search payloads, deduplicated by email."""
        all_contacts = []
        properties_processed = 0

        for i, payload in enumerate(payloads):
            logger.info(f"Processing payload {i+1}/{len(payloads)}")
            pins = await self.client.search_properties(payload)

            for pin in pins:
                if max_properties and properties_processed >= max_properties:
                    logger.info(f"Reached max properties limit ({max_properties})")
                    return all_contacts

                property_id = pin.get("PropertyId")
                if not property_id:
                    continue

                contacts = await self._extract_property_contacts(property_id)
                all_contacts.extend(contacts)
                properties_processed += 1

                if properties_processed % 50 == 0:
                    logger.info(f"Processed {properties_processed} properties, {len(all_contacts)} contacts")

        logger.info(f"Extraction complete: {properties_processed} properties, {len(all_contacts)} unique contacts")
        return all_contacts

    async def _extract_property_contacts(self, property_id: int) -> List[Dict]:
        try:
            data = await self.client.graphql(CONTACTS_QUERY, {"propertyId": property_id})

            prop_detail = data.get("propertyDetail", {})
            header = prop_detail.get("propertyDetailHeader", {})
            true_owner = prop_detail.get("propertyContactDetails_info", {}).get("trueOwner", {})

            if not true_owner:
                return []

            parcel_data = await self._get_parcel_data(property_id) if self.include_parcel else {}

            base = {
                "property_id": header.get("propertyId"),
                "property_address": header.get("addressHeader"),
                "property_type": header.get("propertyType"),
                "building_size": header.get("buildingSize"),
                "land_size": header.get("landSize"),
                "year_built": header.get("yearBuilt"),
                "company_id": true_owner.get("companyId"),
                "company_name": true_owner.get("name"),
                "company_address": true_owner.get("address"),
                "company_phone": self._format_phones(true_owner.get("phoneNumbers")),
                **parcel_data
            }

            return [
                contact for person in true_owner.get("contacts", [])
                if (contact := self._build_contact(base, person))
            ]

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
            pins_data = await self.client.graphql(PARCEL_PINS_QUERY, {"propertyId": property_id})
            parcel_pins = pins_data.get("parcelPinsFromProperty", {}).get("parcelPins", [])

            if not parcel_pins or not parcel_pins[0].get("id"):
                return {}

            parcel_id = str(parcel_pins[0]["id"])
            parcel_data = await self.client.graphql(PARCEL_DETAILS_QUERY, {"parcelId": parcel_id})

            pr_detail = parcel_data.get("publicRecordDetailNew", {})
            parcel = pr_detail.get("parcelDetail", {})
            sales = pr_detail.get("parcelSales", {}).get("sales", [])

            result = {"apn": parcel.get("apn")}

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
