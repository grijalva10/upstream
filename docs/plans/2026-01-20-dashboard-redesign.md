# Dashboard Redesign: Mission Control

**Date:** 2026-01-20
**Status:** Design approved, ready for implementation

## Overview

Redesign the operator dashboard as a single-screen command center showing the entire Upstream system at a glance. No scrolling required on 1080p displays.

**Design goals:**
- See the entire system on one screen
- Morning triage + health check + progress tracking + navigation
- Linear/Vercel meets terminal aesthetic
- Information density between scannable and command center

## Visual Foundation

### Colors
- Background: `#0a0a0a` (near-black)
- Primary text: `#fafafa` (white)
- Secondary text: `#71717a` (zinc-500)
- Borders: `#27272a` (zinc-800)
- Status green: `#22c55e` (green-500)
- Status amber: `#f59e0b` (amber-500)
- Status red: `#ef4444` (red-500)

### Typography
- Headers: System sans-serif (Inter or system default)
- Data/counts: Monospace (`JetBrains Mono`, `SF Mono`, or `Fira Code`)
- No bold except for emphasis; use color/size for hierarchy

### Spacing
- Tight: 4px-8px gaps
- Panel padding: 12px
- No card shadows, 1px borders only

## Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│ UPSTREAM                                    Worker: ● running    9:14a │
├─────────────────────┬─────────────────────┬─────────────────────────────┤
│                     │                     │                             │
│   ATTENTION         │   PIPELINE          │   CAMPAIGNS                 │
│   (action items)    │   (lead/deal flow)  │   (all campaigns)           │
│                     │                     │                             │
├─────────────────────┼─────────────────────┤                             │
│                     │                     │                             │
│   JOBS              │   SEARCHES          │                             │
│   (8 background)    │   (sourcing status) │                             │
│                     │                     │                             │
├─────────────────────┴─────────────────────┴─────────────────────────────┤
│   SERVICES: CoStar ● 3h ago    Outlook ● 2m ago    Claude CLI ● 1d ago  │
└─────────────────────────────────────────────────────────────────────────┘
```

Grid: 3 columns, campaigns spans full right column height.

## Panel Specifications

### Header Bar

```
UPSTREAM                                          Worker ● running   Mon 9:14a
```

| Element | Behavior |
|---------|----------|
| UPSTREAM | Static app name, left-aligned |
| Worker status | Clickable toggle: `● running` (green) / `○ paused` (amber) |
| Timestamp | Current day + time, updates every minute |

**Worker toggle:** Clicking pauses/resumes the pg-boss worker via `worker_status` table update.

---

### ATTENTION Panel

Position: Top-left
Purpose: What needs immediate action

```
▾ ATTENTION (5)
  ● 2 drafts pending          → /inbox?type=email
  ● 1 hot reply               → /inbox?type=email
  ○ 3 low-confidence          → /inbox?type=email
  ○ 1 call @ 2:30p            → /calls
  ○ 2 stalled deals (7+ days) → /pipeline?filter=stalled
```

**Legend:**
- `●` (filled) = requires action now
- `○` (empty) = awareness item

**Data queries:**

| Item | Source |
|------|--------|
| Drafts pending | `email_drafts WHERE status = 'pending'` |
| Hot replies | `tasks WHERE type = 'incoming_email'` + join `synced_emails` for classification = 'hot' |
| Low-confidence | `synced_emails WHERE needs_review = true` |
| Calls today | `calls WHERE status = 'scheduled' AND scheduled_at::date = CURRENT_DATE` |
| Stalled deals | `potential_ghosts` view |

**Empty state:** `✓ All clear` in muted text

**Interaction:** Each row links to filtered view

---

### PIPELINE Panel

Position: Top-center
Purpose: Lead and deal funnel at a glance

```
▾ PIPELINE
  LEADS  142 → 89 → 34 → 12 → 8 → 3 → 2
         new  cnt  rpl  eng  wt  qual hoff

  DEALS   23 → 12 →  5 →  2 → 1
          new gath qual pkg  hoff
```

**Abbreviations:**
- `cnt` = contacted
- `rpl` = replied
- `eng` = engaged
- `wt` = waiting
- `qual` = qualified
- `hoff` = handed_off
- `gath` = gathering
- `pkg` = packaging

**Styling:**
- Numbers in monospace, bold if non-zero
- Zero counts in zinc-500 (muted)
- Arrow (→) connects stages

**Data:** Use existing RPC functions:
- `get_lead_pipeline_counts()`
- `get_deal_pipeline_counts()`

**Interaction:**
- Click LEADS row → `/leads`
- Click DEALS row → `/pipeline`
- Hover number → tooltip with delta from yesterday (future enhancement)

---

### CAMPAIGNS Panel

Position: Right column (full height)
Purpose: All campaigns with key metrics

```
▾ CAMPAIGNS (6)
  ┌────────────────────────────────────────┐
  │ Industrial OC 2026           ● active  │
  │ 52/200 enrolled   12% reply   3 hot    │
  ├────────────────────────────────────────┤
  │ Retail PHX Maturity          ● active  │
  │ 18/75 enrolled    8% reply    1 hot    │
  ├────────────────────────────────────────┤
  │ Office LA Refi               ○ paused  │
  │ 34/120 enrolled   6% reply    0 hot    │
  ├────────────────────────────────────────┤
  │ Multifamily SD               ◐ draft   │
  │ 0/0 enrolled      —           —        │
  └────────────────────────────────────────┘

  + New campaign
```

**Status indicators:**
- `●` active (green)
- `○` paused (amber)
- `◐` draft (zinc)
- `✓` completed (muted)

**Metrics per campaign:**
- Enrolled: `{replied}/{total_enrolled}`
- Reply rate: percentage
- Hot: count of hot classification replies

**Data query:**
```sql
SELECT
  c.id, c.name, c.status, c.total_enrolled, c.total_replied,
  (SELECT COUNT(*)
   FROM enrollments e
   JOIN synced_emails se ON se.contact_id = e.contact_id
   WHERE e.campaign_id = c.id AND se.classification = 'hot'
  ) as hot_count
FROM campaigns c
ORDER BY
  CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
  created_at DESC
```

**Interaction:**
- Click row → `/campaigns/[id]`
- `+ New campaign` button top-right

---

### JOBS Panel

Position: Mid-left
Purpose: Background job health with expandable details

```
▾ JOBS
  ┌──────────────────┬─────────┬─────────┬───┐
  │ email-sync       │ 2m ago  │ → 3m    │ ● │
  │ process-replies  │ 30s ago │ → 1m30s │ ● │
  │ process-queue    │ 45s ago │ → 15s   │ ● │
  │ send-email       │ 1h ago  │ triggered│ ○ │
  │ generate-queries │ 3d ago  │ triggered│ ○ │
  │ auto-follow-up   │ 9:00a   │ → tmrw  │ ● │
  │ ghost-detection  │ 9:30a   │ → tmrw  │ ● │
  │ reconcile-status │ Sun 6a  │ → Sun   │ ● │
  └──────────────────┴─────────┴─────────┴───┘
```

**Columns:**
1. Job name (abbreviated)
2. Last run (relative time)
3. Next run (countdown or "triggered")
4. Status dot

**Status logic:**

| Type | Green | Amber | Red |
|------|-------|-------|-----|
| Scheduled | Last run within 2x interval | 2x-4x interval | >4x or failed |
| Triggered | No recent failures | — | Recent failure |
| Idle | Normal | >24h idle | — |

**Expanded state (click row):**
```
▾ email-sync       │ 2m ago  │ → 3m    │ ● │
  Last: 47 synced, 3 new inbound
  Prev: 52 synced, 1 new inbound
  Prev: 38 synced, 0 new inbound
```

**Data:** Use `get_pgboss_jobs()` RPC filtered by job name, plus hardcoded schedule info.

**Job schedule reference:**
| Job | Schedule |
|-----|----------|
| email-sync | `*/5 * * * *` (every 5m) |
| process-replies | `*/2 * * * *` (every 2m) |
| process-queue | `* * * * *` (every 1m) |
| send-email | triggered |
| generate-queries | triggered |
| auto-follow-up | `0 9 * * *` (daily 9am) |
| ghost-detection | `30 9 * * *` (daily 9:30am) |
| reconcile-lead-status | `0 6 * * 0` (Sunday 6am) |

---

### SEARCHES Panel

Position: Mid-center
Purpose: Sourcing pipeline status

```
▾ SEARCHES (8)
  ┌────────────────────────────┬───────────┬──────┐
  │ Industrial OC 2026         │ extracted │  847 │
  │ Retail PHX Maturity        │ campaign  │  312 │
  │ Office LA Refi             │ extractng │  ... │
  │ Multifamily SD             │ ready     │    — │
  │ NNN Southwest              │ new       │    — │
  └────────────────────────────┴───────────┴──────┘
  View all →
```

**Status abbreviations:**
- `new` = just created
- `ready` = queries_ready
- `extractng` = extracting (with pulse animation)
- `extracted` = extraction complete
- `campaign` = campaign_active
- `complete` = done (hidden by default)

**Styling:**
- `extractng` → amber text + subtle pulse
- `campaign` → green text
- Others → default white or muted

**Data query:**
```sql
SELECT
  s.id, s.name, s.status,
  (SELECT COUNT(*) FROM search_properties WHERE search_id = s.id) as property_count
FROM searches s
WHERE status != 'complete'
ORDER BY created_at DESC
LIMIT 6
```

**Interaction:** Click row → `/searches/[id]`

---

### SERVICES Bar

Position: Bottom (full width)
Purpose: External service health

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  CoStar ● 3h ago        Outlook ● 2m ago        Claude CLI ● 1d ago
  847 properties         last sync: 9:12a        last agent: sourcing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Per service:**
- Line 1: Name + status dot + last activity
- Line 2: Context-specific detail

**Status thresholds:**

| Service | Green | Amber | Red |
|---------|-------|-------|-----|
| CoStar | <24h | 1-7d | >7d |
| Outlook | <10m | 10-30m | >30m |
| Claude CLI | <7d | 7-30d | >30d |

**Data sources:**
- CoStar: `SELECT MAX(created_at) FROM properties`
- Outlook: `SELECT last_sync_at FROM email_sync_state`
- Claude CLI: `SELECT MAX(updated_at) FROM searches WHERE payloads_json IS NOT NULL`

**Interaction:** Click service → trigger manual action (e.g., sync) or open settings

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `a` | Focus attention panel |
| `p` | Navigate to /pipeline |
| `c` | Navigate to /campaigns |
| `j` | Toggle all jobs expanded/collapsed |
| `s` | Navigate to /searches |
| `r` | Refresh dashboard data |
| `?` | Show shortcuts overlay |

## Auto-refresh

- Poll interval: 30 seconds
- Visual indicator: Subtle pulse on header timestamp during refresh
- No full page reload, just data fetch

## Responsive Behavior

| Breakpoint | Layout |
|------------|--------|
| ≥1280px | Full 3-column as designed |
| 1024-1279px | 2 columns, campaigns below pipeline |
| <1024px | Single column stack (not optimized) |

This is a desktop operator tool. Mobile is not a priority.

## Implementation Notes

### New Components Needed
- `MissionControlDashboard` - main layout
- `AttentionPanel` - action items list
- `PipelineFlow` - horizontal funnel display
- `CampaignsPanel` - campaign list with metrics
- `JobsPanel` - expandable job status rows
- `SearchesPanel` - search status list
- `ServicesBar` - horizontal service status

### Data Fetching
- Single `getDashboardData()` server function (similar to current)
- Add queries for: job history, search counts
- May need new RPC for job output summaries

### Database Changes
- None required - uses existing tables and RPCs
- Optional: Add RPC for job output summaries from pg-boss

### Files to Modify
- `apps/web/src/app/(app)/dashboard/page.tsx` - complete rewrite
- `apps/web/src/app/(app)/dashboard/_components/` - replace all components

### Files to Delete
- `pipeline-snapshot.tsx` (replaced by PipelineFlow)
- `agent-activity.tsx` (replaced by JobsPanel)
- `services-status-card.tsx` (replaced by ServicesBar)
- `campaigns-card.tsx` (replaced by CampaignsPanel)
- `calls-today-card.tsx` (merged into AttentionPanel)
- `new-replies-card.tsx` (merged into AttentionPanel)
- `stalled-deals-card.tsx` (merged into AttentionPanel)
- `deals-ready-card.tsx` (remove - accessible via pipeline)
- `criteria-table.tsx` (remove - not needed on dashboard)
- `new-criteria-dialog.tsx` (remove - not needed on dashboard)

## Success Criteria

1. Entire system visible on one 1080p screen without scrolling
2. Morning triage takes <5 seconds to identify action items
3. System health assessable at a glance
4. Clean, modern aesthetic matching Linear/terminal style
5. All panels link to relevant detail pages
