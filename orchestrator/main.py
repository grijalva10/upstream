#!/usr/bin/env python3
"""
Upstream Orchestrator - Main entry point.

Runs two concurrent loops:
1. Send Loop (30s): Check for due emails and send with proper spacing
2. Response Loop (5min): Sync inbox, classify emails, route responses

Usage:
    python -m orchestrator.main              # Run both loops
    python -m orchestrator.main --send-only  # Run send loop only
    python -m orchestrator.main --response-only  # Run response loop only
    python -m orchestrator.main --dry-run    # Run without sending emails
"""
import argparse
import asyncio
import logging
import signal
import sys
from typing import Optional

from .config import Config, get_config
from .db import get_db
from .loops.send import SendLoop, run_send_loop
from .loops.response import run_response_loop

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("orchestrator")

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')


class Orchestrator:
    """
    Main orchestrator that runs send and response loops concurrently.

    Two core loops:
    1. Send Loop (30s): Check for due emails, send with 30-90s spacing
    2. Response Loop (5min): Sync inbox, classify, route responses
    """

    def __init__(self, config: Optional[Config] = None):
        self.config = config or get_config()
        self._running = False
        self._tasks = []
        self._db = get_db()

    async def start(
        self,
        send_loop: bool = True,
        response_loop: bool = True
    ):
        """Start the orchestrator with specified loops."""
        logger.info("=" * 60)
        logger.info("UPSTREAM ORCHESTRATOR")
        logger.info("=" * 60)
        logger.info(f"Dry run mode: {self.config.dry_run}")

        if send_loop:
            logger.info("Send loop: ENABLED (30s interval)")
        if response_loop:
            logger.info("Response loop: ENABLED (5min interval)")

        self._running = True

        # Register orchestrator as running
        try:
            self._db.update_orchestrator_status(
                is_running=True,
                loops_enabled={"send": send_loop, "response": response_loop},
                config={"dry_run": self.config.dry_run}
            )
            logger.info("Registered orchestrator status")
        except Exception as e:
            logger.warning(f"Failed to register status: {e}")

        # Set up signal handlers
        for sig in (signal.SIGTERM, signal.SIGINT):
            signal.signal(sig, self._handle_shutdown)

        try:
            tasks = []

            # Always run heartbeat loop
            tasks.append(asyncio.create_task(
                self._run_heartbeat_loop(),
                name="heartbeat_loop"
            ))

            if send_loop:
                tasks.append(asyncio.create_task(
                    self._run_send_loop(),
                    name="send_loop"
                ))

            if response_loop:
                tasks.append(asyncio.create_task(
                    self._run_response_loop(),
                    name="response_loop"
                ))

            self._tasks = tasks

            if tasks:
                logger.info("Loops started. Press Ctrl+C to stop.")
                await asyncio.gather(*tasks)
            else:
                logger.warning("No loops enabled!")

        except asyncio.CancelledError:
            logger.info("Orchestrator cancelled")
        finally:
            # Mark as stopped
            try:
                self._db.mark_orchestrator_stopped()
            except Exception as e:
                logger.warning(f"Failed to update stopped status: {e}")
            logger.info("Orchestrator stopped")

    async def _run_heartbeat_loop(self):
        """Send heartbeat every 30 seconds."""
        logger.info("Heartbeat loop started")

        while self._running:
            try:
                self._db.send_heartbeat()
            except Exception as e:
                logger.warning(f"Heartbeat failed: {e}")

            await asyncio.sleep(30)

    async def _run_send_loop(self):
        """Run the send loop with 30s interval."""
        send_loop = SendLoop(config=self.config)

        logger.info("Send loop started")

        while self._running:
            try:
                sent = await send_loop.process_due_emails()
                if sent > 0:
                    logger.info(f"Send cycle: {sent} emails sent")
            except Exception as e:
                logger.exception(f"Send loop error: {e}")

            await asyncio.sleep(30)

    async def _run_response_loop(self):
        """Run the response loop with 5min interval."""
        from .loops.response import EmailSync, ResponseLoop

        sync = EmailSync()
        response = ResponseLoop(config=self.config)

        logger.info("Response loop started")

        while self._running:
            try:
                # 1. Sync inbox
                new_emails = await sync.sync_inbox(limit=50)

                # 2. Classify unclassified emails
                processed = await response.process_unclassified_emails()

                if new_emails > 0 or processed > 0:
                    logger.info(f"Response cycle: {new_emails} synced, {processed} classified")

            except Exception as e:
                logger.exception(f"Response loop error: {e}")

            await asyncio.sleep(300)  # 5 minutes

    def _handle_shutdown(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, shutting down...")
        self._running = False

        # Cancel all tasks
        for task in self._tasks:
            task.cancel()

    async def stop(self):
        """Stop the orchestrator."""
        self._running = False
        for task in self._tasks:
            task.cancel()


async def run_once(config: Optional[Config] = None):
    """Run one cycle of both loops (useful for testing)."""
    from .loops.response import EmailSync, ResponseLoop

    config = config or get_config()

    logger.info("Running single cycle...")

    # Send loop
    send_loop = SendLoop(config=config)
    sent = await send_loop.process_due_emails()
    logger.info(f"Send: {sent} emails")

    # Response loop
    sync = EmailSync()
    response = ResponseLoop(config=config)

    new_emails = await sync.sync_inbox(limit=50)
    processed = await response.process_unclassified_emails()
    logger.info(f"Response: {new_emails} synced, {processed} classified")

    logger.info("Single cycle complete")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Upstream Orchestrator")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Run without sending emails"
    )
    parser.add_argument(
        "--send-only",
        action="store_true",
        help="Run send loop only"
    )
    parser.add_argument(
        "--response-only",
        action="store_true",
        help="Run response loop only"
    )
    parser.add_argument(
        "--once",
        action="store_true",
        help="Run one cycle and exit"
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        help="Log level"
    )

    args = parser.parse_args()

    # Configure logging
    logging.getLogger().setLevel(getattr(logging, args.log_level))

    # Override config with CLI args
    config = get_config()
    if args.dry_run:
        config.dry_run = True
        logger.info("Dry run mode enabled")

    if args.once:
        # Run once and exit
        asyncio.run(run_once(config))
    else:
        # Run continuously
        orchestrator = Orchestrator(config)

        send_loop = not args.response_only
        response_loop = not args.send_only

        asyncio.run(orchestrator.start(
            send_loop=send_loop,
            response_loop=response_loop
        ))


if __name__ == "__main__":
    main()
