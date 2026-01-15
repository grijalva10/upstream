"""
Find Sellers Query - Extract property owner contacts from CoStar.

This module ONLY interacts with CoStar and returns JSON.
DB persistence is handled separately by the worker layer.

Usage:
    from integrations.costar.queries import find_sellers

    results = await find_sellers(
        payload=costar_payload,
        max_properties=100,
        include_parcel=True,
    )
    # results is a list of dicts, ready to be persisted
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..session import CoStarSession
from ..client import CoStarClient
from ..extract import ContactExtractor

logger = logging.getLogger(__name__)


@dataclass
class SellerQuery:
    """Configuration for a seller search query."""

    payload: Dict[str, Any]
    name: str = "Unnamed Query"
    max_properties: Optional[int] = None
    require_email: bool = True
    require_phone: bool = False
    include_parcel: bool = False

    # Stealth settings (human-like behavior)
    concurrency: int = 3
    min_delay: float = 0.5
    max_delay: float = 2.0
    burst_size: int = 50
    burst_delay: float = 5.0


@dataclass
class SellerResult:
    """Result from a seller search query."""

    contacts: List[Dict[str, Any]]
    properties_processed: int
    query_name: str
    errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "contacts": self.contacts,
            "properties_processed": self.properties_processed,
            "query_name": self.query_name,
            "contact_count": len(self.contacts),
            "errors": self.errors,
        }


async def find_sellers(
    payload: Dict[str, Any],
    max_properties: Optional[int] = None,
    require_email: bool = True,
    require_phone: bool = False,
    include_parcel: bool = False,
    headless: bool = True,
    concurrency: int = 3,
    min_delay: float = 0.5,
    max_delay: float = 2.0,
    burst_size: int = 50,
    burst_delay: float = 5.0,
    session: Optional[CoStarSession] = None,
) -> List[Dict[str, Any]]:
    """
    Find property owner contacts (sellers) from a CoStar search payload.

    Args:
        payload: CoStar search payload (from sourcing-agent)
        max_properties: Max properties to process (None = unlimited)
        require_email: Only include contacts with valid email
        require_phone: Only include contacts with phone number
        include_parcel: Fetch parcel/loan data (slower, more API calls)
        headless: Run browser in background
        concurrency: Max parallel requests (lower = safer)
        min_delay: Min delay between requests in seconds
        max_delay: Max delay between requests in seconds
        burst_size: Properties before taking a pause
        burst_delay: Seconds to pause between bursts
        session: Existing CoStar session (optional, creates new if not provided)

    Returns:
        List of contact dicts with property and company info.
        Each dict contains:
        - property_id, property_address, property_type, building_size, etc.
        - company_id, company_name, company_address, company_phone
        - contact_id, contact_name, contact_title, email, phone
        - (if include_parcel) apn, sale_date, sale_price, loan info, etc.
    """
    payload_list = [payload] if not isinstance(payload, list) else payload

    logger.info(f"find_sellers: {len(payload_list)} payload(s), max={max_properties}, headless={headless}")

    async def _run_with_session(sess: CoStarSession) -> List[Dict]:
        client = CoStarClient(sess.tab, rate_limit=1.0)
        extractor = ContactExtractor(
            client=client,
            require_email=require_email,
            require_phone=require_phone,
            include_parcel=include_parcel,
            include_market=False,
            concurrency=concurrency,
            min_delay=min_delay,
            max_delay=max_delay,
            burst_size=burst_size,
            burst_delay=burst_delay,
        )
        return await extractor.extract_from_payloads(payload_list, max_properties)

    # Use provided session or create new one
    if session:
        return await _run_with_session(session)
    else:
        async with CoStarSession(headless=headless) as sess:
            return await _run_with_session(sess)


async def find_sellers_batch(
    queries: List[SellerQuery],
    headless: bool = True,
) -> List[SellerResult]:
    """
    Run multiple seller queries in a single session.

    More efficient than calling find_sellers multiple times
    because it reuses the same browser session.

    Args:
        queries: List of SellerQuery configurations
        headless: Run browser in background

    Returns:
        List of SellerResult objects, one per query
    """
    results = []

    async with CoStarSession(headless=headless) as session:
        for query in queries:
            try:
                contacts = await find_sellers(
                    payload=query.payload,
                    max_properties=query.max_properties,
                    require_email=query.require_email,
                    require_phone=query.require_phone,
                    include_parcel=query.include_parcel,
                    headless=headless,
                    concurrency=query.concurrency,
                    min_delay=query.min_delay,
                    max_delay=query.max_delay,
                    burst_size=query.burst_size,
                    burst_delay=query.burst_delay,
                    session=session,
                )
                results.append(SellerResult(
                    contacts=contacts,
                    properties_processed=len(contacts),  # Approximate
                    query_name=query.name,
                ))
            except Exception as e:
                logger.error(f"Query '{query.name}' failed: {e}")
                results.append(SellerResult(
                    contacts=[],
                    properties_processed=0,
                    query_name=query.name,
                    errors=[str(e)],
                ))

    return results
