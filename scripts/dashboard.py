#!/usr/bin/env python3
"""
Upstream Pipeline Dashboard - Terminal UI

Run: python scripts/dashboard.py
"""

import os
import sys
from datetime import datetime, timedelta

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8')

# Add parent to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Installing psycopg2...")
    os.system("pip install psycopg2-binary")
    import psycopg2
    from psycopg2.extras import RealDictCursor


def get_connection():
    return psycopg2.connect(
        host="127.0.0.1",
        port=55322,
        database="postgres",
        user="postgres",
        password="postgres"
    )


def print_header(title: str):
    width = 60
    print()
    print("=" * width)
    print(f" {title}")
    print("=" * width)


def print_table(headers: list, rows: list, widths: list = None):
    if not rows:
        print("  (none)")
        return

    if not widths:
        widths = [max(len(str(h)), max(len(str(r[i])) for r in rows)) + 2
                  for i, h in enumerate(headers)]

    # Header
    header_row = "".join(str(h).ljust(w) for h, w in zip(headers, widths))
    print(f"  {header_row}")
    print("  " + "-" * sum(widths))

    # Rows
    for row in rows:
        row_str = "".join(str(v).ljust(w) for v, w in zip(row, widths))
        print(f"  {row_str}")


def format_status(status: str) -> str:
    icons = {
        "draft": "📝",
        "pending_queries": "⏳",
        "pending_approval": "👀",
        "approved": "✅",
        "active": "🟢",
        "paused": "⏸️",
        "completed": "✔️",
        "failed": "❌",
    }
    return f"{icons.get(status, '•')} {status}"


def main():
    conn = get_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("\n" + "╔" + "═" * 58 + "╗")
    print("║" + " UPSTREAM PIPELINE DASHBOARD ".center(58) + "║")
    print("║" + f" {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ".center(58) + "║")
    print("╚" + "═" * 58 + "╝")

    # === PIPELINE SUMMARY ===
    print_header("📊 PIPELINE SUMMARY")

    cur.execute("""
        SELECT
            status,
            COUNT(*) as count,
            COALESCE(SUM(total_properties), 0) as properties,
            COALESCE(SUM(total_contacts), 0) as contacts
        FROM client_criteria
        GROUP BY status
        ORDER BY
            CASE status
                WHEN 'pending_queries' THEN 1
                WHEN 'pending_approval' THEN 2
                WHEN 'approved' THEN 3
                WHEN 'active' THEN 4
                ELSE 5
            END
    """)
    rows = cur.fetchall()

    if rows:
        print_table(
            ["Status", "Count", "Properties", "Contacts"],
            [[format_status(r["status"]), r["count"], r["properties"], r["contacts"]] for r in rows],
            [25, 8, 12, 10]
        )
    else:
        print("  No criteria in pipeline yet.")

    # === NEEDS ATTENTION ===
    print_header("⚠️  NEEDS ATTENTION")

    cur.execute("""
        SELECT
            c.name as client,
            cc.name as criteria,
            cc.status,
            cc.created_at::date as created
        FROM client_criteria cc
        JOIN clients c ON c.id = cc.client_id
        WHERE cc.status IN ('pending_queries', 'pending_approval')
        ORDER BY cc.created_at
        LIMIT 5
    """)
    rows = cur.fetchall()

    if rows:
        print_table(
            ["Client", "Criteria", "Status", "Created"],
            [[r["client"][:20], r["criteria"][:25], format_status(r["status"]), r["created"]] for r in rows],
            [22, 27, 22, 12]
        )
    else:
        print("  ✅ Nothing needs attention")

    # === RECENT ACTIVITY ===
    print_header("📬 RECENT ACTIVITY (24h)")

    cur.execute("""
        SELECT
            task_type,
            status,
            COUNT(*) as count
        FROM agent_tasks
        WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY task_type, status
        ORDER BY task_type, status
    """)
    rows = cur.fetchall()

    if rows:
        print_table(
            ["Task Type", "Status", "Count"],
            [[r["task_type"], r["status"], r["count"]] for r in rows],
            [25, 15, 10]
        )
    else:
        print("  No agent activity in last 24h")

    # === ACTIVE CLIENTS ===
    print_header("👥 ACTIVE CLIENTS")

    cur.execute("""
        SELECT
            c.name,
            c.email,
            COUNT(cc.id) as criteria_count,
            COALESCE(SUM(cc.total_properties), 0) as total_props
        FROM clients c
        LEFT JOIN client_criteria cc ON cc.client_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id, c.name, c.email
        ORDER BY c.created_at DESC
        LIMIT 5
    """)
    rows = cur.fetchall()

    if rows:
        print_table(
            ["Name", "Email", "Criteria", "Properties"],
            [[r["name"][:25], (r["email"] or "-")[:25], r["criteria_count"], r["total_props"]] for r in rows],
            [27, 27, 10, 12]
        )
    else:
        print("  No active clients")

    # === QUICK ACTIONS ===
    print_header("🚀 QUICK ACTIONS")
    print("""
  In Claude Code, use @upstream-operator and say:

  • "new buyer [paste JSON]"     - Add new buyer criteria
  • "status"                     - Show this dashboard
  • "pending"                    - Show items needing action
  • "approve [criteria name]"    - Approve and run extraction
  • "check replies"              - Sync and classify emails
""")

    print()
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
