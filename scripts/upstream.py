#!/usr/bin/env python3
"""
Upstream CLI - Core pipeline operations

Usage:
    python scripts/upstream.py status              # Show dashboard
    python scripts/upstream.py add-buyer FILE.json # Add buyer from JSON file
    python scripts/upstream.py pending             # List pending items
    python scripts/upstream.py approve CRITERIA_ID # Approve criteria
    python scripts/upstream.py extract CRITERIA_ID # Run extraction
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime

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


DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 55322,
    "database": "postgres",
    "user": "postgres",
    "password": "postgres"
}


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def cmd_status(args):
    """Show pipeline dashboard"""
    os.system("python scripts/dashboard.py")


def cmd_pending(args):
    """List items needing attention"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("\n=== PENDING APPROVAL ===\n")
    cur.execute("""
        SELECT
            cc.id,
            c.name as client,
            cc.name as criteria,
            cc.status,
            cc.created_at::date as created
        FROM client_criteria cc
        JOIN clients c ON c.id = cc.client_id
        WHERE cc.status IN ('pending_queries', 'pending_approval')
        ORDER BY cc.created_at
    """)
    rows = cur.fetchall()

    if rows:
        for r in rows:
            status_icon = "⏳" if r["status"] == "pending_queries" else "👀"
            print(f"  {status_icon} [{r['id'][:8]}] {r['client']} / {r['criteria']}")
            print(f"     Status: {r['status']} | Created: {r['created']}")
            print()
    else:
        print("  ✅ Nothing pending!")

    print("\n=== PENDING TASKS ===\n")
    cur.execute("""
        SELECT
            id,
            task_type,
            priority,
            created_at::date as created
        FROM agent_tasks
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at
    """)
    rows = cur.fetchall()

    if rows:
        for r in rows:
            print(f"  📋 [{r['id'][:8]}] {r['task_type']} (priority: {r['priority']})")
    else:
        print("  ✅ No pending tasks!")

    print()
    cur.close()
    conn.close()


def cmd_add_buyer(args):
    """Add new buyer from JSON file"""
    if not os.path.exists(args.file):
        print(f"Error: File not found: {args.file}")
        sys.exit(1)

    with open(args.file) as f:
        data = json.load(f)

    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Extract buyer info
    buyer = data.get("buyer", {})
    buyer_name = buyer.get("name") or buyer.get("entityName") or "Unknown Buyer"
    buyer_email = buyer.get("contact", {}).get("email")
    buyer_phone = buyer.get("contact", {}).get("phone")
    capital = buyer.get("entity", {}).get("capital", "N/A")

    # Check if client exists
    cur.execute("SELECT id FROM clients WHERE name = %s", (buyer_name,))
    existing = cur.fetchone()

    if existing:
        client_id = existing["id"]
        print(f"Using existing client: {buyer_name} ({client_id[:8]})")
    else:
        cur.execute("""
            INSERT INTO clients (name, email, phone, status, notes)
            VALUES (%s, %s, %s, 'active', %s)
            RETURNING id
        """, (buyer_name, buyer_email, buyer_phone, f"Capital: {capital}"))
        client_id = cur.fetchone()["id"]
        print(f"Created client: {buyer_name} ({client_id[:8]})")

    # Create criteria
    criteria = data.get("criteria", {})
    criteria_name = criteria.get("name") or f"Search {datetime.now().strftime('%Y-%m-%d')}"

    cur.execute("""
        INSERT INTO client_criteria (client_id, name, criteria_json, status)
        VALUES (%s, %s, %s, 'pending_queries')
        RETURNING id
    """, (client_id, criteria_name, Json(data)))
    criteria_id = cur.fetchone()["id"]
    print(f"Created criteria: {criteria_name} ({criteria_id[:8]})")

    # Create agent task
    cur.execute("""
        INSERT INTO agent_tasks (task_type, priority, status, criteria_id, input_data)
        VALUES ('generate_queries', 7, 'pending', %s, %s)
        RETURNING id
    """, (criteria_id, Json({
        "criteria_id": str(criteria_id),
        "client_id": str(client_id),
        "buyer_name": buyer_name,
        "criteria_json": data
    })))
    task_id = cur.fetchone()["id"]
    print(f"Created task: generate_queries ({task_id[:8]})")

    conn.commit()
    cur.close()
    conn.close()

    print(f"\n✅ Ready! Now run @sourcing-agent with criteria ID: {criteria_id}")
    print(f"\n   Or: python scripts/upstream.py approve {criteria_id[:8]}")


def cmd_approve(args):
    """Approve criteria and update status"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Find criteria by partial ID
    cur.execute("""
        SELECT id, name, status, queries_json
        FROM client_criteria
        WHERE id::text LIKE %s
    """, (f"{args.criteria_id}%",))
    criteria = cur.fetchone()

    if not criteria:
        print(f"Error: Criteria not found: {args.criteria_id}")
        sys.exit(1)

    if criteria["status"] not in ("pending_approval", "pending_queries", "draft"):
        print(f"Warning: Criteria status is '{criteria['status']}', not pending")

    # Update status
    cur.execute("""
        UPDATE client_criteria
        SET status = 'approved'
        WHERE id = %s
    """, (criteria["id"],))

    # Create extraction task
    cur.execute("""
        INSERT INTO agent_tasks (task_type, priority, status, criteria_id, input_data)
        VALUES ('run_extraction', 8, 'pending', %s, %s)
        RETURNING id
    """, (criteria["id"], Json({
        "criteria_id": str(criteria["id"]),
        "criteria_name": criteria["name"]
    })))
    task_id = cur.fetchone()["id"]

    conn.commit()
    cur.close()
    conn.close()

    print(f"✅ Approved: {criteria['name']}")
    print(f"   Created extraction task: {task_id[:8]}")
    print(f"\n   Run extraction with:")
    print(f"   python scripts/run_extraction.py output/queries/..._payloads.json")


def cmd_extract(args):
    """Run extraction for criteria"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Find criteria
    cur.execute("""
        SELECT cc.id, cc.name, cc.queries_json, c.name as client_name
        FROM client_criteria cc
        JOIN clients c ON c.id = cc.client_id
        WHERE cc.id::text LIKE %s
    """, (f"{args.criteria_id}%",))
    criteria = cur.fetchone()

    if not criteria:
        print(f"Error: Criteria not found: {args.criteria_id}")
        sys.exit(1)

    # Determine payload file
    client_safe = criteria["client_name"].replace(" ", "_").replace(".", "")
    payload_file = f"output/queries/{client_safe}_payloads.json"

    if not os.path.exists(payload_file):
        print(f"Warning: Payload file not found: {payload_file}")
        print("Run @sourcing-agent first to generate queries")

        # Check for any payload files
        import glob
        files = glob.glob("output/queries/*_payloads.json")
        if files:
            print(f"\nAvailable payload files:")
            for f in files:
                print(f"  - {f}")
        sys.exit(1)

    print(f"Running extraction for: {criteria['name']}")
    print(f"Payload file: {payload_file}")

    # Update status to active
    cur.execute("""
        UPDATE client_criteria
        SET status = 'active'
        WHERE id = %s
    """, (criteria["id"],))
    conn.commit()

    cur.close()
    conn.close()

    # Run extraction
    cmd = f"python scripts/run_extraction.py {payload_file}"
    print(f"\nExecuting: {cmd}\n")
    os.system(cmd)


def cmd_show(args):
    """Show details for a client or criteria"""
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Try to find by partial ID or name
    search = f"%{args.query}%"

    # Check criteria first
    cur.execute("""
        SELECT cc.*, c.name as client_name
        FROM client_criteria cc
        JOIN clients c ON c.id = cc.client_id
        WHERE cc.id::text LIKE %s OR cc.name ILIKE %s OR c.name ILIKE %s
        LIMIT 1
    """, (search, search, search))
    result = cur.fetchone()

    if result:
        print(f"\n=== CRITERIA: {result['name']} ===\n")
        print(f"  ID: {result['id']}")
        print(f"  Client: {result['client_name']}")
        print(f"  Status: {result['status']}")
        print(f"  Properties: {result['total_properties'] or 0}")
        print(f"  Contacts: {result['total_contacts'] or 0}")
        print(f"  Created: {result['created_at']}")

        if result['criteria_json']:
            print(f"\n  --- Criteria JSON ---")
            print(json.dumps(result['criteria_json'], indent=2)[:500])

        if result['queries_json']:
            print(f"\n  --- Queries ({len(result['queries_json'])} total) ---")
            for i, q in enumerate(result['queries_json'][:3]):
                print(f"    {i+1}. {q.get('name', 'Unnamed')}")

        if result['strategy_summary']:
            print(f"\n  --- Strategy Summary ---")
            print(result['strategy_summary'][:500])
    else:
        print(f"Nothing found for: {args.query}")

    cur.close()
    conn.close()


def main():
    parser = argparse.ArgumentParser(description="Upstream Pipeline CLI")
    subparsers = parser.add_subparsers(dest="command", help="Commands")

    # status
    subparsers.add_parser("status", help="Show pipeline dashboard")

    # pending
    subparsers.add_parser("pending", help="List pending items")

    # add-buyer
    p = subparsers.add_parser("add-buyer", help="Add buyer from JSON file")
    p.add_argument("file", help="Path to buyer criteria JSON file")

    # approve
    p = subparsers.add_parser("approve", help="Approve criteria")
    p.add_argument("criteria_id", help="Criteria ID (partial OK)")

    # extract
    p = subparsers.add_parser("extract", help="Run extraction")
    p.add_argument("criteria_id", help="Criteria ID (partial OK)")

    # show
    p = subparsers.add_parser("show", help="Show details")
    p.add_argument("query", help="Client name, criteria name, or ID")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    commands = {
        "status": cmd_status,
        "pending": cmd_pending,
        "add-buyer": cmd_add_buyer,
        "approve": cmd_approve,
        "extract": cmd_extract,
        "show": cmd_show,
    }

    commands[args.command](args)


if __name__ == "__main__":
    main()
