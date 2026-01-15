"""CoStar Integration - Property Data Extraction.

Architecture:
- session.py: Browser session management (Pydoll for stealth)
- client.py: CoStar API calls
- queries/: Query modules that return JSON (no DB interaction)
    - find_sellers.py: Extract property owner contacts
    - find_buyers.py: Extract active buyers (TODO)
    - market_analytics.py: Get market data (TODO)
- db.py: Legacy DB helpers (being migrated to worker layer)

Usage:
    from integrations.costar.queries import find_sellers
    contacts = await find_sellers(payload, max_properties=100)
"""

import logging
from typing import Dict, List, Optional, Union

# Core components
from .session import CoStarSession  # Renamed from auth.py
from .client import CoStarClient
from .extract import ContactExtractor

# Query modules (new pattern - returns JSON, no DB)
from .queries import find_sellers, SellerQuery

# Legacy DB helpers (TODO: migrate to worker layer)
from .db import (
    save_contacts,
    setup_extraction_from_payloads_file,
    get_or_create_client,
    create_client_criteria,
    create_extraction_list,
    upsert_extraction_list,
    get_criteria_by_id,
    get_or_create_criteria,
    log_agent_execution,
    update_agent_execution,
    get_sourcing_strategies,
    get_strategy_by_name,
    save_strategy_summary,
    update_criteria_with_results,
)

logger = logging.getLogger(__name__)


async def extract_contacts(
    payloads: Union[Dict, List[Dict]],
    max_properties: Optional[int] = None,
    require_email: bool = True,
    require_phone: bool = False,
    rate_limit: float = 1.0,
    include_parcel: bool = False,
    include_market: bool = False,
    headless: bool = True,
    concurrency: int = 3,  # Max parallel property requests (conservative)
    min_delay: float = 0.5,  # Min delay between requests (evasion)
    max_delay: float = 2.0,  # Max delay between requests (evasion)
    burst_size: int = 50,  # Properties before taking a break
    burst_delay: float = 5.0,  # Seconds to pause between bursts
) -> List[Dict]:
    """Extract property owner contacts from CoStar search payloads.

    Safe for large extractions (10k+):
    - Conservative concurrency (3 parallel requests by default)
    - Burst pauses every 50 properties (5s+ break)
    - Variable delays (0.5-2.0s) between requests for evasion
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
    # New query pattern (preferred)
    "find_sellers",
    "SellerQuery",
    # Core components
    "CoStarSession",
    "CoStarClient",
    "ContactExtractor",
    # Legacy (still works, but use queries instead)
    "extract_contacts",
    "save_contacts",
    "setup_extraction_from_payloads_file",
    "get_or_create_client",
    "create_client_criteria",
    "create_extraction_list",
    "upsert_extraction_list",
    "get_criteria_by_id",
    "get_or_create_criteria",
    "log_agent_execution",
    "update_agent_execution",
    "get_sourcing_strategies",
    "get_strategy_by_name",
    "save_strategy_summary",
    "update_criteria_with_results",
]
