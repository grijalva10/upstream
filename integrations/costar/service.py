#!/usr/bin/env python3
"""
CoStar Session Service - Persistent browser session with HTTP API.

This service keeps a Pydoll browser session open and provides an HTTP API
for status checks, authentication, and query execution.

Usage:
    python integrations/costar/service.py [--port 8765]

API Endpoints:
    GET  /status        - Get session status
    POST /start         - Start browser session
    POST /stop          - Stop browser session
    POST /auth          - Trigger re-authentication
    POST /query         - Execute a query using the session
    POST /count         - Get property counts for payloads (fast preview)
"""

import asyncio
import json
import logging
import os
import signal
import sys
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, Any

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from integrations.costar.session import CoStarSession
from integrations.costar.client import CoStarClient
from integrations.costar.extract import ContactExtractor

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# Session state
@dataclass
class SessionState:
    status: str = "offline"  # offline, starting, authenticating, connected, error
    started_at: Optional[str] = None
    last_activity: Optional[str] = None
    last_auth: Optional[str] = None
    error: Optional[str] = None
    queries_run: int = 0
    browser_pid: Optional[int] = None

state = SessionState()
session: Optional[CoStarSession] = None
session_lock = threading.Lock()
loop: Optional[asyncio.AbstractEventLoop] = None

# Cookie expiry tracking (conservative estimate)
COOKIE_VALID_HOURS = 2

app = Flask(__name__)
CORS(app)


def update_state(**kwargs):
    """Update session state."""
    global state
    for key, value in kwargs.items():
        if hasattr(state, key):
            setattr(state, key, value)


def is_session_valid() -> bool:
    """Check if session is still valid based on last auth time."""
    if state.status != "connected" or not state.last_auth:
        return False

    last_auth = datetime.fromisoformat(state.last_auth)
    return datetime.now() - last_auth < timedelta(hours=COOKIE_VALID_HOURS)


@app.route("/status", methods=["GET"])
def get_status():
    """Get current session status."""
    return jsonify({
        **asdict(state),
        "session_valid": is_session_valid(),
        "expires_in_minutes": max(0, int(
            (timedelta(hours=COOKIE_VALID_HOURS) -
             (datetime.now() - datetime.fromisoformat(state.last_auth))).total_seconds() / 60
        )) if state.last_auth and state.status == "connected" else 0,
    })


@app.route("/start", methods=["POST"])
def start_session():
    """Start the browser session."""
    global session, loop

    if state.status in ["starting", "authenticating"]:
        return jsonify({"error": "Session already starting"}), 400

    if state.status == "connected":
        return jsonify({"error": "Session already connected"}), 400

    def run_session():
        global session, loop, state

        try:
            update_state(status="starting", error=None)
            logger.info("Starting CoStar session...")

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def start():
                global session
                # Always visible (not headless) for auth
                session = CoStarSession(headless=False)
                await session.__aenter__()

                update_state(
                    status="connected",
                    started_at=datetime.now().isoformat(),
                    last_auth=datetime.now().isoformat(),
                    last_activity=datetime.now().isoformat(),
                )
                logger.info("CoStar session connected!")

                # Keep the session alive
                while state.status == "connected":
                    await asyncio.sleep(1)

            loop.run_until_complete(start())

        except Exception as e:
            logger.error(f"Session error: {e}")
            update_state(status="error", error=str(e))
        finally:
            if session:
                try:
                    loop.run_until_complete(session.__aexit__(None, None, None))
                except:
                    pass
            session = None
            if state.status != "error":
                update_state(status="offline")

    thread = threading.Thread(target=run_session, daemon=True)
    thread.start()

    # Wait a moment for startup
    time.sleep(1)

    return jsonify({"message": "Session starting...", "status": state.status})


@app.route("/stop", methods=["POST"])
def stop_session():
    """Stop the browser session."""
    global session, state

    if state.status == "offline":
        return jsonify({"error": "Session not running"}), 400

    logger.info("Stopping CoStar session...")
    update_state(status="offline")

    # The session thread will clean up when it sees status change
    time.sleep(2)

    return jsonify({"message": "Session stopped", "status": state.status})


@app.route("/auth", methods=["POST"])
def trigger_auth():
    """Trigger re-authentication (opens login page)."""
    global session, loop

    if state.status != "connected" or not session:
        return jsonify({"error": "Session not connected"}), 400

    update_state(status="authenticating")

    def do_auth():
        try:
            async def auth():
                # Navigate to login to trigger re-auth
                await session.tab.go_to("https://product.costar.com/")
                logger.info("Navigated to login - please authenticate")

                # Wait for user to complete auth
                for _ in range(120):  # 2 minutes
                    await asyncio.sleep(1)
                    url = await session._get_url()
                    if any(home in url for home in session.HOME_URLS if hasattr(session, 'HOME_URLS')) or "home" in url.lower():
                        await session._save_cookies()
                        update_state(
                            status="connected",
                            last_auth=datetime.now().isoformat(),
                        )
                        logger.info("Re-authentication successful!")
                        return

                update_state(status="error", error="Auth timeout")

            loop.call_soon_threadsafe(
                lambda: asyncio.ensure_future(auth())
            )
        except Exception as e:
            update_state(status="error", error=str(e))

    thread = threading.Thread(target=do_auth, daemon=True)
    thread.start()

    return jsonify({"message": "Authentication started - please complete in browser"})


@app.route("/query", methods=["POST"])
def execute_query():
    """Execute a query using the active session."""
    global session, loop

    if state.status != "connected" or not session:
        return jsonify({"error": "Session not connected"}), 400

    if not is_session_valid():
        return jsonify({"error": "Session expired - please re-authenticate"}), 401

    data = request.json
    query_type = data.get("query_type", "find_sellers")
    payload = data.get("payload", {})
    options = data.get("options", {})

    logger.info(f"Query request: type={query_type}, options={options}")

    result = {"error": None, "data": None}
    done_event = threading.Event()

    async def run_query():
        try:
            client = CoStarClient(session.tab, rate_limit=1.0)

            if query_type == "find_sellers":
                include_parcel = options.get("include_parcel", False)
                require_email = options.get("require_email", True)
                max_props = options.get("max_properties")
                logger.info(f"=== FIND_SELLERS OPTIONS ===")
                logger.info(f"  include_parcel: {include_parcel}")
                logger.info(f"  require_email: {require_email}")
                logger.info(f"  max_properties: {max_props}")
                logger.info(f"  raw options: {options}")
                extractor = ContactExtractor(
                    client=client,
                    require_email=require_email,
                    include_parcel=include_parcel,
                    concurrency=options.get("concurrency", 3),
                )

                payload_list = [payload] if not isinstance(payload, list) else payload
                contacts = await extractor.extract_from_payloads(
                    payload_list,
                    max_properties=options.get("max_properties"),
                )

                result["data"] = {
                    "contacts": contacts,
                    "count": len(contacts),
                }

            elif query_type == "graphql":
                # Execute raw GraphQL query
                gql_query = payload.get("query", "")
                variables = payload.get("variables", {})
                operation_name = payload.get("operationName")

                if not gql_query:
                    result["error"] = "Missing 'query' in payload"
                else:
                    response = await client.graphql(gql_query, variables, operation_name)
                    result["data"] = response

            elif query_type == "property_search":
                # Execute property search with payload
                max_pages = options.get("max_pages", 1)
                pins = await client.search_properties(payload, max_pages=max_pages)
                result["data"] = {
                    "pins": pins,
                    "count": len(pins),
                }

            else:
                result["error"] = f"Unknown query type: {query_type}"

            if not result["error"]:
                update_state(
                    last_activity=datetime.now().isoformat(),
                    queries_run=state.queries_run + 1,
                )

        except Exception as e:
            logger.error(f"Query error: {e}")
            result["error"] = str(e)
        finally:
            done_event.set()

    # Schedule the query on the session's event loop
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(run_query(), loop)
    else:
        return jsonify({"error": "Event loop not running"}), 500

    # Wait for completion (with timeout)
    timeout = options.get("timeout", 300)  # 5 min default
    if not done_event.wait(timeout):
        return jsonify({"error": "Query timeout"}), 504

    if result["error"]:
        return jsonify({"error": result["error"]}), 500

    return jsonify(result["data"])


@app.route("/count", methods=["POST"])
def count_properties():
    """Get property counts for search payloads without fetching all data."""
    global session, loop

    if state.status != "connected" or not session:
        return jsonify({"error": "Session not connected"}), 400

    if not is_session_valid():
        return jsonify({"error": "Session expired - please re-authenticate"}), 401

    data = request.json
    payload = data.get("payload", {})

    logger.info(f"Count request for {len(payload) if isinstance(payload, list) else 1} payload(s)")

    result = {"error": None, "data": None}
    done_event = threading.Event()

    async def run_count():
        try:
            client = CoStarClient(session.tab, rate_limit=1.0)

            # Handle single payload or list of payloads
            payload_list = [payload] if not isinstance(payload, list) else payload

            counts = []
            for i, p in enumerate(payload_list):
                count_result = await client.count_properties(p)
                counts.append({
                    "payload_index": i,
                    "property_count": count_result.get("PropertyCount", 0),
                    "unit_count": count_result.get("UnitCount", 0),
                    "shopping_center_count": count_result.get("ShoppingCenterCount", 0),
                    "space_count": count_result.get("SpaceCount", 0),
                })
                logger.info(f"Payload {i+1}: {count_result.get('PropertyCount', 0)} properties")

            total_properties = sum(c["property_count"] for c in counts)
            result["data"] = {
                "counts": counts,
                "total_properties": total_properties,
                "payload_count": len(counts),
            }

            update_state(last_activity=datetime.now().isoformat())

        except Exception as e:
            logger.error(f"Count error: {e}")
            result["error"] = str(e)
        finally:
            done_event.set()

    # Schedule the count on the session's event loop
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(run_count(), loop)
    else:
        return jsonify({"error": "Event loop not running"}), 500

    # Wait for completion (with timeout)
    timeout = data.get("timeout", 60)  # 1 min default for counts
    if not done_event.wait(timeout):
        return jsonify({"error": "Count timeout"}), 504

    if result["error"]:
        return jsonify({"error": result["error"]}), 500

    return jsonify(result["data"])


def main():
    import argparse
    parser = argparse.ArgumentParser(description="CoStar Session Service")
    parser.add_argument("--port", type=int, default=8765, help="Port to run on")
    args = parser.parse_args()

    logger.info(f"Starting CoStar Session Service on port {args.port}")
    logger.info("Endpoints:")
    logger.info("  GET  /status  - Get session status")
    logger.info("  POST /start   - Start browser session")
    logger.info("  POST /stop    - Stop browser session")
    logger.info("  POST /auth    - Trigger re-authentication")
    logger.info("  POST /query   - Execute a query")
    logger.info("  POST /count   - Get property counts (fast preview)")

    app.run(host="0.0.0.0", port=args.port, threaded=True)


if __name__ == "__main__":
    main()
