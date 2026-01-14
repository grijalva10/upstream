#!/usr/bin/env python3
"""
Upstream Background Service

Uses Claude Code headless to run agents for:
- Response classification (@response-classifier)
- Follow-up generation (@qualify-agent)
- Email sending (@drip-campaign-exec)

Usage:
    python scripts/service.py              # Run once
    python scripts/service.py --loop       # Run continuously
    python scripts/service.py --interval 900  # Custom interval (seconds)
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timedelta
from typing import Optional

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json
except ImportError:
    os.system("pip install psycopg2-binary")
    import psycopg2
    from psycopg2.extras import RealDictCursor, Json

# Database config
DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 55322,
    "database": "postgres",
    "user": "postgres",
    "password": "postgres"
}

# Service config
DEFAULT_INTERVAL = 15 * 60  # 15 minutes
BATCH_SIZE = 10  # Max emails to process per cycle

# Claude CLI path (Windows)
CLAUDE_CLI = os.path.expanduser("~/.claude/local/node_modules/.bin/claude.cmd")

# Domains to skip classification (system/newsletter emails)
SKIP_DOMAINS = {
    "alerts.costar.com",
    "email.costar.com",
    "txn.dropbox.com",
    "sharepointonline.com",
    "crowdstreet.com",
    "n8n.io",
    "noreply",
    "no-reply",
    "mailer-daemon",
    "postmaster",
}


def log(message: str, level: str = "INFO"):
    """Simple logging with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")


def should_skip_email(from_email: str, subject: str = "") -> bool:
    """Check if email should be auto-skipped (system/newsletter)."""
    if not from_email:
        return True
    email_lower = from_email.lower()
    for skip in SKIP_DOMAINS:
        if skip in email_lower:
            return True
    # Skip if subject contains common newsletter patterns
    subject_lower = (subject or "").lower()
    skip_subjects = ["daily alert", "newsletter", "digest", "security:", "quarantine"]
    for pattern in skip_subjects:
        if pattern in subject_lower:
            return True
    return False


def get_db():
    """Get database connection."""
    return psycopg2.connect(**DB_CONFIG)


# =============================================================================
# CLAUDE CODE HEADLESS
# =============================================================================

def run_claude(prompt: str, timeout: int = 180) -> Optional[str]:
    """
    Run Claude Code in headless mode with a prompt.
    Uses stdin to avoid Windows shell escaping issues.
    Returns the response text or None on error.
    """
    try:
        # Use stdin to pass the prompt (avoids Windows escaping issues)
        result = subprocess.run(
            [CLAUDE_CLI, "-p", "-", "--output-format", "text"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            shell=True  # Required for .cmd on Windows
        )

        if result.returncode == 0:
            return result.stdout.strip()
        else:
            log(f"Claude error: {result.stderr}", "ERROR")
            return None

    except subprocess.TimeoutExpired:
        log(f"Claude timeout after {timeout}s", "ERROR")
        return None
    except FileNotFoundError:
        log("Claude CLI not found. Is it installed?", "ERROR")
        return None
    except Exception as e:
        log(f"Claude error: {e}", "ERROR")
        return None


def run_agent(agent: str, prompt: str, timeout: int = 180) -> Optional[str]:
    """
    Run a specific agent via Claude Code headless.
    Use for complex tasks that need tools.
    """
    full_prompt = f"@{agent} {prompt}"
    return run_claude(full_prompt, timeout)


# =============================================================================
# SYNC OUTLOOK
# =============================================================================

def sync_outlook() -> int:
    """
    Sync new emails from Outlook inbox to database.
    Returns count of new emails synced.
    """
    log("Syncing Outlook inbox...")

    try:
        from integrations.outlook import OutlookClient
    except ImportError as e:
        log(f"Outlook integration not available: {e}", "ERROR")
        return 0

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get last sync time
    cur.execute("""
        SELECT last_sync_at FROM email_sync_state
        WHERE folder = 'inbox'
        ORDER BY last_sync_at DESC LIMIT 1
    """)
    row = cur.fetchone()
    last_sync = row["last_sync_at"] if row else datetime.now() - timedelta(days=7)

    try:
        client = OutlookClient()
        emails = client.email.inbox.get_messages(limit=50, since=last_sync)

        new_count = 0
        for email in emails:
            # Check if already synced
            cur.execute(
                "SELECT id FROM synced_emails WHERE outlook_entry_id = %s",
                (email.entry_id,)
            )
            if cur.fetchone():
                continue

            # Insert new email
            cur.execute("""
                INSERT INTO synced_emails (
                    outlook_entry_id, outlook_conversation_id, direction,
                    from_email, from_name, subject, body_text, body_html,
                    received_at, is_read, has_attachments
                ) VALUES (%s, %s, 'inbound', %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                email.entry_id,
                email.conversation_id,
                email.sender_email,
                email.sender_name,
                email.subject,
                email.body,
                email.html_body,
                email.received_time,
                email.is_read,
                email.has_attachments
            ))
            new_count += 1

        # Update sync state
        cur.execute("""
            INSERT INTO email_sync_state (folder, last_sync_at, last_entry_id)
            VALUES ('inbox', NOW(), %s)
            ON CONFLICT (folder) DO UPDATE SET
                last_sync_at = NOW(),
                last_entry_id = EXCLUDED.last_entry_id
        """, (emails[0].entry_id if emails else None,))

        conn.commit()
        log(f"Synced {new_count} new emails")
        return new_count

    except Exception as e:
        log(f"Outlook sync error: {e}", "ERROR")
        conn.rollback()
        return 0
    finally:
        cur.close()
        conn.close()


# =============================================================================
# CLASSIFY EMAILS (via Claude Code headless - batched)
# =============================================================================

def classify_emails() -> int:
    """
    Classify unclassified emails using Claude Code headless.
    Batches multiple emails into single call for efficiency.
    Returns count of emails classified.
    """
    log("Classifying new emails...")

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get unclassified emails
    cur.execute("""
        SELECT id, from_email, from_name, subject, body_text
        FROM synced_emails
        WHERE classification IS NULL
          AND direction = 'inbound'
        ORDER BY received_at DESC
        LIMIT %s
    """, (BATCH_SIZE,))
    emails = cur.fetchall()

    if not emails:
        log("No emails to classify")
        cur.close()
        conn.close()
        return 0

    # First pass: skip system emails
    to_classify = []
    classified = 0

    for email in emails:
        from_email = email["from_email"] or ""
        subject = email["subject"] or ""

        if should_skip_email(from_email, subject):
            log(f"  Skipping: {from_email[:30]}...")
            cur.execute("""
                UPDATE synced_emails
                SET
                    classification = 'system',
                    classification_confidence = 1.0,
                    classified_at = NOW(),
                    classified_by = 'auto-filter'
                WHERE id = %s
            """, (email["id"],))
            classified += 1
        else:
            to_classify.append(email)

    if not to_classify:
        conn.commit()
        cur.close()
        conn.close()
        log(f"Classified {classified}/{len(emails)} emails (all system)")
        return classified

    # Build batch prompt for Claude Code headless
    log(f"  Classifying {len(to_classify)} emails via Claude Code...")

    emails_for_prompt = []
    for i, email in enumerate(to_classify):
        emails_for_prompt.append({
            "index": i,
            "id": str(email["id"]),
            "from_email": email["from_email"],
            "from_name": email["from_name"],
            "subject": email["subject"],
            "body_text": (email["body_text"] or "")[:1000]  # Truncate for batch
        })

    prompt = f"""Classify these CRE email responses. Return ONLY a JSON array, no markdown.

Emails:
{json.dumps(emails_for_prompt, indent=2)}

Classifications: interested, pricing_given, question, referral, broker_redirect, soft_pass, hard_pass, bounce

Return JSON array: [{{"index": 0, "id": "...", "classification": "...", "confidence": 0.0-1.0}}, ...]"""

    response = run_claude(prompt, timeout=180)

    if response:
        try:
            # Find JSON array in response
            start = response.find("[")
            end = response.rfind("]") + 1
            if start >= 0 and end > start:
                results = json.loads(response[start:end])

                for result in results:
                    email_id = result.get("id")
                    classification = result.get("classification")
                    confidence = result.get("confidence", 0.5)

                    if email_id and classification:
                        cur.execute("""
                            UPDATE synced_emails
                            SET
                                classification = %s,
                                classification_confidence = %s,
                                classified_at = NOW(),
                                classified_by = 'claude-headless'
                            WHERE id = %s
                        """, (classification, confidence, email_id))

                        # Find original email for handle_classification
                        orig_email = next((e for e in to_classify if str(e["id"]) == email_id), None)
                        if orig_email:
                            handle_classification(cur, orig_email["from_email"], result)

                        classified += 1
                        log(f"    -> {classification} ({confidence:.0%})")

        except json.JSONDecodeError as e:
            log(f"  Failed to parse batch response: {e}", "ERROR")
    else:
        log("  No response from Claude Code", "ERROR")

    conn.commit()
    cur.close()
    conn.close()

    log(f"Classified {classified}/{len(emails)} emails")
    return classified


def handle_classification(cur, from_email: str, result: dict):
    """Handle database updates based on classification."""
    classification = result.get("classification")

    if classification == "bounce":
        cur.execute("""
            INSERT INTO email_exclusions (email, reason, created_at)
            VALUES (%s, 'bounce', NOW())
            ON CONFLICT (email) DO NOTHING
        """, (from_email,))

    elif classification == "hard_pass":
        cur.execute("""
            INSERT INTO dnc_entries (email, reason, source, added_at)
            VALUES (%s, 'requested', 'email_response', NOW())
            ON CONFLICT (email) DO NOTHING
        """, (from_email,))

        cur.execute("""
            UPDATE sequence_subscriptions
            SET status = 'unsubscribed', completed_at = NOW()
            WHERE contact_id = (SELECT id FROM contacts WHERE email = %s)
              AND status = 'active'
        """, (from_email,))

    elif classification in ("interested", "pricing_given"):
        cur.execute("""
            UPDATE companies
            SET status = 'engaged', updated_at = NOW()
            WHERE id = (SELECT company_id FROM contacts WHERE email = %s)
              AND status IN ('new', 'contacted')
        """, (from_email,))

        cur.execute("""
            UPDATE sequence_subscriptions
            SET status = 'replied', completed_at = NOW()
            WHERE contact_id = (SELECT id FROM contacts WHERE email = %s)
              AND status = 'active'
        """, (from_email,))


# =============================================================================
# PROCESS TASKS (via appropriate agents)
# =============================================================================

def process_pending_tasks() -> int:
    """
    Process pending agent tasks from the queue.
    """
    log("Processing pending tasks...")

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get pending tasks
    cur.execute("""
        SELECT id, task_type, criteria_id, input_data
        FROM agent_tasks
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at
        LIMIT 5
    """)
    tasks = cur.fetchall()

    if not tasks:
        log("No pending tasks")
        cur.close()
        conn.close()
        return 0

    processed = 0
    for task in tasks:
        log(f"  Processing: {task['task_type']} ({str(task['id'])[:8]})")

        # Mark as running
        cur.execute("""
            UPDATE agent_tasks
            SET status = 'running', started_at = NOW()
            WHERE id = %s
        """, (task["id"],))
        conn.commit()

        try:
            if task["task_type"] == "generate_queries":
                success = process_generate_queries(cur, task)
            elif task["task_type"] == "run_extraction":
                success = process_run_extraction(cur, task)
            else:
                log(f"    Unknown task type: {task['task_type']}", "ERROR")
                success = False

            # Update status
            cur.execute("""
                UPDATE agent_tasks
                SET status = %s, completed_at = NOW()
                WHERE id = %s
            """, ("completed" if success else "failed", task["id"]))

            processed += 1

        except Exception as e:
            log(f"    Task error: {e}", "ERROR")
            cur.execute("""
                UPDATE agent_tasks
                SET status = 'failed', completed_at = NOW()
                WHERE id = %s
            """, (task["id"],))

        conn.commit()

    cur.close()
    conn.close()

    log(f"Processed {processed} tasks")
    return processed


def process_generate_queries(cur, task: dict) -> bool:
    """Run sourcing agent to generate queries."""
    input_data = task.get("input_data", {})
    criteria_json = input_data.get("criteria_json", {})

    prompt = f"""Generate CoStar queries for this buyer criteria.
Write the payloads to output/queries/ and update the database.

Criteria:
{json.dumps(criteria_json, indent=2)}

Criteria ID: {task['criteria_id']}
"""

    response = run_agent("sourcing-agent", prompt, timeout=300)

    if response:
        # Update criteria status
        cur.execute("""
            UPDATE client_criteria
            SET status = 'pending_approval'
            WHERE id = %s
        """, (task["criteria_id"],))
        log(f"    Queries generated, pending approval")
        return True

    return False


def process_run_extraction(cur, task: dict) -> bool:
    """Run CoStar extraction."""
    input_data = task.get("input_data", {})
    criteria_name = input_data.get("criteria_name", "unknown")

    # Find payload file
    safe_name = criteria_name.replace(" ", "_").replace("/", "_")
    payload_patterns = [
        f"output/queries/{safe_name}_payloads.json",
        f"output/queries/*_payloads.json"  # fallback
    ]

    # Try to run extraction
    import glob
    for pattern in payload_patterns:
        files = glob.glob(pattern)
        if files:
            cmd = f"python scripts/run_extraction.py {files[0]}"
            log(f"    Running: {cmd}")
            result = subprocess.run(cmd, shell=True, capture_output=True, text=True)

            if result.returncode == 0:
                cur.execute("""
                    UPDATE client_criteria
                    SET status = 'active'
                    WHERE id = %s
                """, (task["criteria_id"],))
                return True
            else:
                log(f"    Extraction failed: {result.stderr}", "ERROR")
                return False

    log("    No payload file found", "ERROR")
    return False


# =============================================================================
# SEND APPROVED EMAILS
# =============================================================================

def send_approved_emails() -> int:
    """
    Send emails that have been approved.
    """
    log("Sending approved emails...")

    try:
        from integrations.outlook import OutlookClient
    except ImportError as e:
        log(f"Outlook integration not available: {e}", "ERROR")
        return 0

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Get approved drafts
    cur.execute("""
        SELECT id, to_email, subject, body
        FROM email_drafts
        WHERE status = 'approved'
        ORDER BY created_at
        LIMIT %s
    """, (BATCH_SIZE,))
    drafts = cur.fetchall()

    if not drafts:
        log("No approved emails to send")
        cur.close()
        conn.close()
        return 0

    sent = 0
    try:
        client = OutlookClient()

        for draft in drafts:
            try:
                client.email.send(
                    to=draft["to_email"],
                    subject=draft["subject"],
                    body=draft["body"]
                )

                cur.execute("""
                    UPDATE email_drafts
                    SET status = 'sent', sent_at = NOW()
                    WHERE id = %s
                """, (draft["id"],))

                sent += 1
                log(f"  Sent to: {draft['to_email']}")

            except Exception as e:
                log(f"  Failed: {draft['to_email']}: {e}", "ERROR")
                cur.execute("""
                    UPDATE email_drafts
                    SET status = 'rejected'
                    WHERE id = %s
                """, (draft["id"],))

        conn.commit()

    except Exception as e:
        log(f"Outlook error: {e}", "ERROR")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    log(f"Sent {sent} emails")
    return sent


# =============================================================================
# MAIN SERVICE LOOP
# =============================================================================

def run_cycle():
    """Run one complete service cycle."""
    log("=" * 60)
    log("STARTING SERVICE CYCLE")
    log("=" * 60)

    try:
        # 1. Sync Outlook
        sync_outlook()

        # 2. Classify new emails
        classify_emails()

        # 3. Process pending agent tasks
        process_pending_tasks()

        # 4. Send approved emails
        send_approved_emails()

        log("=" * 60)
        log("CYCLE COMPLETE")
        log("=" * 60)

    except Exception as e:
        log(f"Cycle error: {e}", "ERROR")


def main():
    parser = argparse.ArgumentParser(description="Upstream Background Service")
    parser.add_argument("--loop", action="store_true", help="Run continuously")
    parser.add_argument("--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"Loop interval in seconds (default: {DEFAULT_INTERVAL})")
    args = parser.parse_args()

    log("=" * 60)
    log("UPSTREAM SERVICE")
    log("Using Claude Code headless for agents")
    log("=" * 60)

    if args.loop:
        log(f"Loop mode: running every {args.interval}s")
        log("Press Ctrl+C to stop")
        print()

        while True:
            try:
                run_cycle()
                log(f"Sleeping {args.interval}s...")
                time.sleep(args.interval)
            except KeyboardInterrupt:
                log("Stopped by user")
                break
    else:
        run_cycle()
        log("Single run complete. Use --loop for continuous.")


if __name__ == "__main__":
    main()
