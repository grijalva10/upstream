"""CoStar Integration - Property Data Extraction.

Architecture:
- session.py: Browser session management (Pydoll for stealth)
- client.py: CoStar API calls
- queries/: Query modules that return JSON (no DB interaction)
    - find_sellers.py: Extract property owner contacts
    - find_buyers.py: Extract active buyers (TODO)
    - market_analytics.py: Get market data (TODO)
- db.py: DB utilities (parsing helpers, agent logging, strategy queries)

Data Flow:
    Web UI: searches -> CoStar service -> upsertExtractedData() -> search_properties
    CLI: Use queries module directly, persist with your own logic

Usage:
    from integrations.costar.queries import find_sellers
    contacts = await find_sellers(payload, max_properties=100)
"""

import logging
from typing import Dict, List, Optional, Union

# Core components
from .session import CoStarSession
from .client import CoStarClient
from .extract import ContactExtractor

# Query modules (returns JSON, no DB)
from .queries import find_sellers, SellerQuery

# DB utilities (kept functions only)
from .db import (
    get_supabase_client,
    parse_building_size,
    parse_land_size,
    parse_year_built,
    log_agent_execution,
    update_agent_execution,
    get_sourcing_strategies,
    get_strategy_by_name,
)

logger = logging.getLogger(__name__)


async def extract_contacts(
    payloads: Union[Dict, List[Dict]],
    max_properties: Optional[int] = None,
    require_email: bool = True,
    require_phone: bool = False,
    rate_limit: float = 0.2,
    include_parcel: bool = False,
    include_market: bool = False,
    headless: bool = True,
    concurrency: int = 8,
    min_delay: float = 0.15,
    max_delay: float = 0.4,
    burst_size: int = 150,
    burst_delay: float = 3.0,
) -> List[Dict]:
    """Extract property owner contacts from CoStar search payloads.

    Aggressively safe settings for faster extractions:
    - 8 parallel requests
    - Burst pauses every 150 properties (3s break)
    - Variable delays (0.15-0.4s) between requests
    - Skips parcel fetch if no valid contacts found
    - Progress logging every 100 properties

    Args:
        payloads: Single payload dict or list of payloads
        max_properties: Max properties to process (None = unlimited)
        require_email: Only include contacts with valid email
        require_phone: Only include contacts with phone number
        rate_limit: Base rate limit for API calls
        include_parcel: Fetch parcel/loan data (adds 2 API calls per contact)
        include_market: Include market comparison data
        headless: Run browser in background
        concurrency: Max parallel requests (lower = safer, higher = faster)
        min_delay: Minimum delay between requests in seconds
        max_delay: Maximum delay between requests in seconds
        burst_size: Number of properties before taking a burst pause
        burst_delay: Seconds to pause between bursts
    """
    payload_list = [payloads] if isinstance(payloads, dict) else payloads

    if not payload_list:
        raise ValueError("At least one payload required")

    logger.info(f"Starting extraction: {len(payload_list)} payload(s), headless={headless}, concurrency={concurrency}")
    if max_properties and max_properties > 1000:
        logger.info(f"Large extraction mode: {max_properties} max, burst pause every {burst_size} properties")

    async with CoStarSession(headless=headless) as session:
        client = CoStarClient(session.tab, rate_limit=rate_limit)
        extractor = ContactExtractor(
            client=client,
            require_email=require_email,
            require_phone=require_phone,
            include_parcel=include_parcel,
            include_market=include_market,
            concurrency=concurrency,
            min_delay=min_delay,
            max_delay=max_delay,
            burst_size=burst_size,
            burst_delay=burst_delay,
        )
        contacts = await extractor.extract_from_payloads(payload_list, max_properties)

    logger.info(f"Extraction complete: {len(contacts)} contacts")
    return contacts


# Re-export for convenience
__all__ = [
    # Query pattern (preferred)
    "find_sellers",
    "SellerQuery",
    # Core components
    "CoStarSession",
    "CoStarClient",
    "ContactExtractor",
    # Convenience wrapper
    "extract_contacts",
    # DB utilities
    "get_supabase_client",
    "parse_building_size",
    "parse_land_size",
    "parse_year_built",
    "log_agent_execution",
    "update_agent_execution",
    "get_sourcing_strategies",
    "get_strategy_by_name",
]
