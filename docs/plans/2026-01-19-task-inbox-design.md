# Task Inbox Design

**Date:** 2026-01-19

## Overview

Create a task inbox page that shows tasks in three views (inbox, future, archive) and rename the current email "Inbox" to "Mail".

## Changes

### Routing

| Route | Before | After |
|-------|--------|-------|
| `/inbox` | Email management | Task inbox (new) |
| `/mail` | — | Email management (moved from /inbox) |

### Sidebar Navigation

```
Dashboard
Inbox (tasks)  ← NEW
Leads
Searches
Campaigns
Mail (email)   ← RENAMED from Inbox
Pipeline
Calls
Data
Jobs
Settings
```

### Task Inbox Views

| Tab | Filter | Purpose |
|-----|--------|---------|
| **Inbox** | `status IN ('pending','snoozed') AND due_date <= today` | Needs attention now |
| **Future** | `status IN ('pending','snoozed') AND due_date > today` | Scheduled for later |
| **Archive** | `status IN ('completed','cancelled')` | Done/dismissed |

Timezone: "Today" calculated using user's timezone (passed from client).

### Task Item UI

```
┌─────────────────────────────────────────────────────────────┐
│ ○  Call John Smith about pricing                    Today   │
│    Acme Properties · call_reminder                  2:00 PM │
└─────────────────────────────────────────────────────────────┘
```

### Interactions

- **Click row** → Navigate to lead detail (`/leads/[id]`)
- **Checkbox** → Mark complete (moves to archive)
- **Snooze button** → Snooze task (+1 day or prompt for date)

## File Changes

### Create (new task inbox)

```
apps/web/src/app/(app)/inbox/
├── page.tsx                    # Main page, fetches tasks
├── actions.ts                  # Server actions (complete, snooze)
└── _components/
    ├── task-tabs.tsx           # Tab navigation
    ├── task-list.tsx           # Renders list of tasks
    └── task-item.tsx           # Single task row with actions
```

### Move (email → mail)

```
apps/web/src/app/(app)/inbox/* → apps/web/src/app/(app)/mail/*
```

### Update

- `apps/web/src/components/sidebar.tsx` — reorder nav, add Inbox, rename old Inbox to Mail

## Database

No schema changes required. Existing `tasks` table has all needed fields:
- `due_date DATE NOT NULL`
- `status TEXT` — 'pending', 'completed', 'snoozed', 'cancelled'
- `lead_id UUID` — for navigation to lead detail
