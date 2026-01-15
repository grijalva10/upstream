# Build Dashboard Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → Campaigns → Pipeline → Calls → **Dashboard**

We're building **Dashboard** - the home page with at-a-glance metrics and actions.

## What Dashboard Does

1. Shows key metrics: new replies, deals in pipeline, calls today
2. Highlights items needing attention (pending approvals, stalled deals)
3. Quick access to common actions
4. Agent activity log

## Database

Uses data from all the tables created in `supabase/migrations/00017_upstream_v2_schema.sql`:
- `inbox_messages` - For reply counts
- `deals` - For pipeline snapshot
- `calls` - For today's calls
- `campaigns` - For active campaigns
- `enrollments` - For email counts

## Tasks

### 1. Create Dashboard Page

Create `apps/web/src/app/(app)/dashboard/page.tsx`:

**Layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│ Dashboard                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ New      │ │ Deals    │ │ Calls    │ │ Emails   │           │
│  │ Replies  │ │ Pipeline │ │ Today    │ │ Pending  │           │
│  │   12     │ │   24     │ │    3     │ │   45     │           │
│  │ View →   │ │ View →   │ │ View →   │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Needs Attention                              Quick Actions     │
│  ─────────────────────────────────────        ─────────────     │
│  ⚠️ 3 replies need classification             [New Search]      │
│  ⚠️ 2 deals stalled > 7 days                  [Schedule Call]   │
│  ⚠️ 1 call scheduled in 30 min                [View Inbox]      │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pipeline Snapshot                                              │
│  ─────────────────────────────────────────────────────────────  │
│  Qualifying: 12  │  Qualified: 5  │  Packaged: 3  │  Handed: 4  │
│  ████████████    │  █████         │  ███          │  ████       │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Today's Calls                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  10:00 AM  John Smith @ ABC Holdings   [View Prep] [Join]       │
│  2:00 PM   Jane Doe @ XYZ Properties   [View Prep]              │
│  4:30 PM   Mike Johnson @ 123 LLC      [View Prep]              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Recent Activity                                                │
│  ─────────────────────────────────────────────────────────────  │
│  📧 Reply from John Smith (interested) - 5 min ago              │
│  📞 Call completed with Jane Doe - 1 hr ago                     │
│  📤 Email sent to 15 contacts - 2 hr ago                        │
│  ✅ Deal DEAL-000023 marked qualified - 3 hr ago                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Metric Cards Component

Create `apps/web/src/app/(app)/dashboard/_components/metric-card.tsx`:

```tsx
interface MetricCardProps {
  title: string;
  value: number;
  subtitle?: string;
  trend?: { value: number; direction: 'up' | 'down' };
  href?: string;
  icon?: React.ReactNode;
}
```

Cards to create:
1. **New Replies** - Count of inbox_messages where status = 'new'
2. **Deals in Pipeline** - Count of deals where status in ('qualifying', 'qualified', 'packaged')
3. **Calls Today** - Count of calls where scheduled_at is today
4. **Emails Pending** - Count of enrollments where status = 'active' and current_step < 3

### 3. Needs Attention Component

Create `apps/web/src/app/(app)/dashboard/_components/needs-attention.tsx`:

Alerts for:
- Unclassified replies (inbox_messages where classification is null, status = 'new')
- Stalled deals (deals in 'qualifying' for > 7 days with no recent activity)
- Upcoming calls (calls scheduled within next 60 minutes)
- Approval queue items (if email_drafts table has pending items)
- Bounced emails (recent bounces needing attention)

Each alert is clickable → navigates to relevant page.

### 4. Pipeline Snapshot Component

Create `apps/web/src/app/(app)/dashboard/_components/pipeline-snapshot.tsx`:

- Bar chart or simple counts for each stage
- Clickable to navigate to /pipeline with filter

### 5. Today's Calls Component

Create `apps/web/src/app/(app)/dashboard/_components/todays-calls.tsx`:

- List of calls scheduled today
- Shows time, contact name, company
- "View Prep" button
- Highlighted if call is within 30 minutes

### 6. Recent Activity Component

Create `apps/web/src/app/(app)/dashboard/_components/recent-activity.tsx`:

Aggregates recent events from:
- inbox_messages (new replies)
- deal_activity (status changes, notes)
- enrollments (emails sent)
- calls (completed calls)

Shows last 10 items with:
- Icon by type
- Description
- Relative time
- Click to navigate

### 7. Create API Routes

`apps/web/src/app/api/dashboard/stats/route.ts`:
```typescript
// Returns all dashboard metrics in one call
{
  new_replies: number;
  deals_in_pipeline: number;
  calls_today: number;
  emails_pending: number;
  pipeline_by_stage: {
    qualifying: number;
    qualified: number;
    packaged: number;
    handed_off: number;
  };
}
```

`apps/web/src/app/api/dashboard/alerts/route.ts`:
```typescript
// Returns items needing attention
{
  alerts: Array<{
    type: 'reply' | 'stalled_deal' | 'upcoming_call' | 'approval' | 'bounce';
    message: string;
    count: number;
    href: string;
  }>;
}
```

`apps/web/src/app/api/dashboard/activity/route.ts`:
```typescript
// Returns recent activity feed
{
  items: Array<{
    type: string;
    description: string;
    created_at: string;
    href?: string;
  }>;
}
```

### 8. Auto-Refresh

Dashboard should auto-refresh metrics every 60 seconds using React Query or SWR.

## Existing Patterns

Look at:
- `apps/web/src/app/(app)/dashboard/_components/` - Existing dashboard components (if any)
- `apps/web/src/components/metric-card.tsx` - May already exist
- Other pages for data fetching patterns

## UI Components

- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/progress` (for pipeline bars)
- Custom metric cards

## Don't

- Don't implement complex charts (keep it simple)
- Don't add too many metrics (focus on actionable items)
- Don't implement real-time WebSocket updates (polling is fine)

## Verify

After building:
1. Dashboard loads at /dashboard
2. All metric cards show correct counts
3. Clicking metric cards navigates to relevant pages
4. Needs Attention shows relevant alerts
5. Pipeline snapshot reflects actual deal counts
6. Today's calls shows correct calls
7. Activity feed shows recent events
8. Auto-refresh works (change data, see update)
