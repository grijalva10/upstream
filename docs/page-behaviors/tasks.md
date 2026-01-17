# Tasks Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Overview

The Tasks page is the central work queue for all human action items in the sourcing workflow. It aggregates follow-ups, call reminders, call prep, document requests, and review items into a single prioritized list.

---

## 2. Task Types

| Type | Description | Icon | Auto-Generated |
|------|-------------|------|----------------|
| `call_reminder` | Reminder before scheduled call | Phone | Yes (from calls) |
| `call_prep` | Prepare materials before call | Document | Yes (from calls) |
| `follow_up` | Generic follow-up needed | ArrowRight | Yes/No |
| `doc_follow_up` | Follow up on promised documents | FileText | Yes |
| `nurture` | Re-engage soft pass contact | Repeat | Yes |
| `ooo_follow_up` | Follow up after OOO period ends | Calendar | Yes |
| `schedule_call` | Need to schedule a call | CalendarPlus | Yes |
| `review_deal` | Review deal for packaging | Eye | Yes |
| `research_owner` | Research property owner | Search | Yes/No |
| `broker_decision` | Decide on broker relationship | Users | Yes |
| `human_review` | AI needs human decision | AlertCircle | Yes |

---

## 3. Task States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `pending` | Not yet started | No badge | `in_progress`, `completed`, `cancelled` |
| `in_progress` | Currently being worked | Blue "In Progress" | `completed`, `cancelled` |
| `completed` | Done | Green "Done" | — |
| `cancelled` | No longer needed | Gray "Cancelled" | — |
| `snoozed` | Postponed to later date | Yellow "Snoozed" | `pending` (auto) |

---

## 4. Task Priority

| Priority | Description | UI Indicator |
|----------|-------------|--------------|
| 1 | Critical - today | Red badge |
| 2 | High - within 24h | Orange badge |
| 3 | Medium - this week | Yellow badge |
| 4 | Low - can wait | Gray badge |
| 5 | Backlog | No badge |

---

## 5. Human Actions

### List Page (/tasks)

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **View by status** | Tab click | Filters by task status | URL param `?status=[status]` |
| **View by type** | Dropdown | Filters by task type | URL param |
| **Search** | Search box | Text search on title/description | Query param |
| **Select task** | Click row | Shows detail panel | URL param `?id=[uuid]` |
| **Quick complete** | Checkbox | Marks task done | Updates `tasks.status` to `completed` |
| **Create task** | "Add Task" button | Opens create dialog | — |
| **Bulk complete** | Select + action | Marks multiple done | Updates multiple `tasks.status` |

### Detail Panel

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Mark complete** | "Complete" button | Marks task done | Updates `tasks.status`, `completed_at` |
| **Snooze** | "Snooze" button | Opens date picker | Updates `tasks.due_date`, `status` |
| **Change priority** | Priority dropdown | Updates priority | Updates `tasks.priority` |
| **Edit description** | Inline edit | Updates task details | Updates `tasks.description` |
| **Add note** | Note button | Adds completion note | Updates `tasks.notes` |
| **View contact** | Contact link | Navigate to contact | — |
| **View deal** | Deal link | Navigate to deal | — |
| **View property** | Property link | Navigate to property | — |
| **View source email** | Email link | Opens email in inbox | — |
| **Delete task** | Delete button | Removes task | Deletes `tasks` record |

### Task-Specific Actions

| Task Type | Special Action | What It Does |
|-----------|----------------|--------------|
| `call_reminder` | "Join Call" | Opens calendar/meeting link |
| `call_prep` | "View Prep" | Opens call prep PDF |
| `doc_follow_up` | "Send Follow-up" | Opens compose with template |
| `nurture` | "Send Nurture" | Opens compose with nurture template |
| `schedule_call` | "Propose Times" | Opens slot picker |
| `review_deal` | "Review Deal" | Navigate to deal page |
| `broker_decision` | "Log Broker" | Opens broker decision dialog |
| `human_review` | "Take Action" | Shows original email for review |

---

## 6. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Create call reminder** | Call scheduled | Active | Active | Creates task 15min before call |
| **Create call prep** | Call scheduled | Active | Active | Creates task 1hr before call |
| **Create doc follow-up** | 3 days since promise | Disabled | Active | Creates `doc_follow_up` task |
| **Create nurture task** | `soft_pass` + 90 days | Disabled | Active | Creates `nurture` task |
| **Create OOO follow-up** | OOO detected + return date | Disabled | Active | Creates `ooo_follow_up` task |
| **Auto-complete** | Related action done | Disabled | Active | Updates `tasks.status` |
| **Prioritize** | Multiple tasks due | Disabled | Active | Updates `tasks.priority` |
| **Snooze on OOO** | OOO detected | Disabled | Active | Snoozes related tasks |

---

## 7. View Modes

| Mode | Shows | Count Badge |
|------|-------|-------------|
| `today` | Due today or overdue | Yes (red if overdue) |
| `upcoming` | Due within 7 days | Yes |
| `pending` | All pending tasks | Yes |
| `completed` | Recently completed | No |
| `all` | Everything | No |

---

## 8. Database Tables

### Core Tables

| Table | Role |
|-------|------|
| `tasks` | Task records with type, status, dates |
| `calls` | Linked scheduled calls |
| `deals` | Linked deals |
| `contacts` | Linked contacts |
| `companies` | Linked companies |
| `properties` | Linked properties |
| `synced_emails` | Source emails for tasks |

### Tasks Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `type` | TEXT | Task type (see types above) |
| `title` | TEXT | Task title |
| `description` | TEXT | Details/instructions |
| `status` | TEXT | pending, in_progress, completed, cancelled, snoozed |
| `priority` | INTEGER | 1-5 (1 = highest) |
| `due_date` | DATE | When task is due |
| `due_time` | TIME | Optional specific time |
| `contact_id` | UUID | Linked contact |
| `company_id` | UUID | Linked company |
| `property_id` | UUID | Linked property |
| `deal_id` | UUID | Linked deal |
| `source_email_id` | UUID | Email that triggered task |
| `auto_generated` | BOOLEAN | True if created by AI |
| `notes` | TEXT | Completion notes |
| `completed_at` | TIMESTAMPTZ | When marked complete |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

## 9. Processes

### Task Creation Process (Manual)

```
1. User clicks "Add Task"
2. Dialog opens with fields:
   - Title (required)
   - Type (dropdown)
   - Due date (required)
   - Priority (default: 3)
   - Description
   - Link to: contact/company/property/deal
3. Submit creates task record
4. Appears in task list based on due date
```

### Call Reminder Generation

```
1. Call scheduled (via schedule-agent or manual)
2. System creates two tasks:
   a. call_prep: Due 1 hour before call
      - Title: "Prep for call with {contact_name}"
      - Description: Property address, deal status
      - Links: call_id, contact_id, property_id
   b. call_reminder: Due 15 minutes before call
      - Title: "Call with {contact_name} at {time}"
      - Description: Phone number, meeting link
      - Links: call_id, contact_id
3. Both tasks auto_generated = true
```

### Document Follow-up Generation (Eventual Mode)

```
1. AI detects 'doc_promised' classification
2. Creates qualification_data or updates deal:
   - rent_roll_status = 'promised' OR
   - operating_statement_status = 'promised'
3. After 3 days with no receipt:
   a. Check follow_up_count < 3
   b. Create doc_follow_up task
   c. Title: "Follow up on rent roll from {contact_name}"
   d. Description: What was promised, when
4. On task completion:
   a. If doc received: Update status to 'received'
   b. If follow-up sent: Increment follow_up_count
```

### Nurture Task Generation (Eventual Mode)

```
1. AI classifies response as 'soft_pass'
2. Extract timing context (e.g., "not until Q3")
3. Calculate follow-up date (default: 90 days)
4. Create nurture task:
   - Type: nurture
   - Due date: calculated date
   - Title: "Re-engage {contact_name}"
   - Description: Original response, reason for soft pass
   - Priority: 4 (low)
5. On task completion:
   - Open compose with nurture template
   - Mention time passage since last contact
```

### Task Completion Process

```
1. User clicks "Complete" or checkbox
2. Optional: Add completion note
3. System updates:
   - status = 'completed'
   - completed_at = NOW()
4. Related actions:
   - If call_prep: Mark as done
   - If doc_follow_up: Prompt for status update
   - If review_deal: Navigate to deal
5. Task moves to "completed" view
```

---

## 10. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `tasks/page.tsx` | Main page |
| `task-list.tsx` | `_components/` | Task list with grouping |
| `task-row.tsx` | `_components/` | Individual task row |
| `task-detail.tsx` | `_components/` | Right panel detail view |
| `add-task-dialog.tsx` | `_components/` | Create task dialog |
| `snooze-picker.tsx` | `_components/` | Snooze date selector |
| `task-actions.tsx` | `_components/` | Type-specific action buttons |

---

## 11. Today View Integration

The Tasks page powers the "Today" dashboard section:

```
Today View Components:
├── Overdue tasks (red, sorted by due date)
├── Tasks due today (sorted by priority, time)
├── Calls today (from calls table)
├── Pending drafts (from email_drafts)
└── Low-confidence reviews (from synced_emails)
```

SQL View: `today_view`

---

## 12. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | Call reminders only, all else manual |
| **Phase 2** | Assisted | AI creates tasks, human reviews |
| **Phase 3** | Semi-autonomous | AI creates + prioritizes, auto-snooze |
| **Phase 4** | Autonomous | Full task management with learning |

### Phase 1 → 2 Criteria
- Call reminder system working reliably
- User comfortable with AI-created tasks

### Phase 2 → 3 Criteria
- Task suggestions accepted > 90%
- Priority assignments accurate

### Phase 3 → 4 Criteria
- Full workflow runs without errors
- User opts in to auto-management

---

## 13. Edge Cases

| Scenario | Handling |
|----------|----------|
| Overdue task | Highlight in red, boost priority to 1 |
| Call cancelled | Auto-cancel related call_prep and call_reminder |
| Contact goes DNC | Cancel pending tasks for that contact |
| Multiple tasks for same contact | Group in UI, allow bulk actions |
| Snooze to weekend | Auto-adjust to next Monday |
| Task has no linked entity | Show "Link to..." prompt |
| Duplicate task created | Warn and offer to merge |

---

## 14. Notification Rules

| Trigger | Notification | When |
|---------|--------------|------|
| Task due | Browser notification | Due time |
| Task overdue | Badge update | On overdue |
| Call in 15 min | Desktop + browser | 15 min before |
| High priority created | Banner | On creation |
| AI created task | Toast | On creation |

---

## 15. Integration Points

| System | Integration |
|--------|-------------|
| **Inbox** | `human_review` tasks from low-confidence classifications |
| **Deals** | `review_deal` tasks, deal_id linking |
| **Calls** | `call_reminder`, `call_prep` from scheduled calls |
| **People** | Contact/company linking, DNC cancellation |
| **Campaigns** | Follow-up tasks from no-reply sequences |
| **Today dashboard** | Aggregated task feed |
