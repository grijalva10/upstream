"""CoStar API Client - GraphQL and REST Execution."""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

GRAPHQL_URL = "https://product.costar.com/graphql"
PROPERTY_SEARCH_URL = "https://product.costar.com/bff2/property/search/list-properties"

MAX_RETRIES = 3
RETRY_DELAY = 2.0
REQUEST_TIMEOUT = 30


class CoStarClient:
    """API client for CoStar GraphQL and REST endpoints."""

    def __init__(self, tab, rate_limit: float = 1.0):
        self.tab = tab
        self.rate_limit = rate_limit
        self.last_request: Optional[datetime] = None
        self.request_count = 0

    async def _enforce_rate_limit(self):
        if self.last_request:
            elapsed = (datetime.now() - self.last_request).total_seconds()
            if elapsed < self.rate_limit:
                await asyncio.sleep(self.rate_limit - elapsed)
        self.last_request = datetime.now()

    async def graphql(self, query: str, variables: Dict[str, Any]) -> Dict:
        """Execute GraphQL query with retries."""
        payload = {"query": query, "variables": variables}

        for attempt in range(MAX_RETRIES):
            try:
                await self._enforce_rate_limit()

                response = await self.tab.request.post(
                    GRAPHQL_URL,
                    json=payload,
                    timeout=REQUEST_TIMEOUT
                )

                if not response or not response.ok:
                    raise Exception(f"HTTP {getattr(response, 'status', 'No response')}")

                data = response.json()

                if "errors" in data:
                    errors = [e.get("message", str(e)) for e in data["errors"]]
                    raise Exception(f"GraphQL errors: {errors}")

                self.request_count += 1
                return data.get("data", {})

            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_DELAY * (2 ** attempt)
                    logger.warning(f"Request failed, retry in {wait}s: {e}")
                    await asyncio.sleep(wait)
                else:
                    raise

        raise Exception("Max retries exceeded")

    async def search_properties(
        self,
        payload: Dict,
        max_pages: int = 10,
        page_delay: float = 1.5
    ) -> List[Dict]:
        """Search properties with automatic pagination."""
        all_pins = []

        for page in range(1, max_pages + 1):
            page_payload = payload.copy()
            page_payload["2"] = page

            await self._enforce_rate_limit()

            try:
                response = await self.tab.request.post(
                    PROPERTY_SEARCH_URL,
                    json=page_payload,
                    timeout=REQUEST_TIMEOUT
                )

                if not response or not response.ok:
                    if page == 1:
                        logger.error("Property search failed")
                        return []
                    break

                pins = response.json().get("searchResult", {}).get("Pins", [])
                if not pins:
                    break

                all_pins.extend(pins)
                logger.info(f"Page {page}: {len(pins)} properties")

                if len(pins) < 2000:
                    break

                await asyncio.sleep(page_delay)

            except Exception as e:
                logger.error(f"Page {page} failed: {e}")
                if page == 1:
                    return []
                break

        logger.info(f"Total: {len(all_pins)} properties")
        return all_pins
