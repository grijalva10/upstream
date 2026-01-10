"""CoStar Integration - Property Contact Extraction."""

import logging
from typing import Dict, List, Optional, Union

from .auth import CoStarSession
from .client import CoStarClient
from .extract import ContactExtractor
from .db import save_contacts

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
    concurrency: int = 5,  # Max parallel property requests
    min_delay: float = 0.3,  # Min delay between requests (evasion)
    max_delay: float = 1.2,  # Max delay between requests (evasion)
) -> List[Dict]:
    """Extract property owner contacts from CoStar search payloads.

    Optimizations:
    - Parallel processing with semaphore-limited concurrency
    - Skips parcel fetch if no valid contacts found
    - Variable delays between requests for evasion
    """
    payload_list = [payloads] if isinstance(payloads, dict) else payloads

    if not payload_list:
        raise ValueError("At least one payload required")

    logger.info(f"Starting extraction: {len(payload_list)} payload(s), headless={headless}, concurrency={concurrency}")

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
        )
        contacts = await extractor.extract_from_payloads(payload_list, max_properties)

    logger.info(f"Extraction complete: {len(contacts)} contacts")
    return contacts


# Re-export for convenience
__all__ = ["extract_contacts", "save_contacts", "CoStarSession", "CoStarClient", "ContactExtractor"]
