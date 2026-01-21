# Schema Simplification - Final Design

> **Status:** Implemented in migration `00038_schema_simplification.sql`
> **Date:** 2025-01-20

## Overview

This schema change simplifies the lead/deal model to be **action-oriented** for AI agents. Instead of asking "what status is this lead?", AI can now ask "what should I do next?"

## Key Changes

### 1. Lead Status (Added: replied, waiting)

```
new → contacted → replied → engaged → waiting → qualified → handed_off
                                         ↘ nurture
                                         ↘ closed
```

| Status | Definition | AI Action |
|--------|------------|-----------|
| `new` | Identified, no outreach yet | Enroll in campaign |
| `contacted` | Email sent, waiting for reply | Wait |
| `replied` | Got response, needs triage | Triage & route |
| `engaged` | Two-way conversation active | Draft responses |
| `waiting` | Ball in their court | Monitor, follow up if silent |
| `qualified` | Has pricing + motivation + timeline | Package deal |
| `handed_off` | Sent to Lee 1031 X | Done |
| `nurture` | "Not now, maybe later" | Schedule future outreach |
| `closed` | Dead | Nothing |

### 2. Lead Type (Replaces is_buyer/is_seller/company_type)

Single field answers: "Why are we talking to them?"

| Value | Definition |
|-------|------------|
| `seller` | We want to GET a deal from them |
| `buyer` | We want to GIVE deals to them |
| `buyer_seller` | Bidirectional |
| `broker` | Middleman |
| `other` | Vendor, lender, etc. |

### 3. Closed Reason (New)

When `status = 'closed'`, this field explains why:

| Value | Meaning |
|-------|---------|
| `dnc` | Requested no contact (compliance) |
| `not_interested` | Hard no, won't sell |
| `has_broker` | Already listed |
| `wrong_contact` | Not the decision maker |
| `bad_data` | Wrong email, defunct company |
| `duplicate` | Merged with another lead |

### 4. Deal Status (Simplified)

```
new → gathering → qualified → packaging → handed_off
                     ↘ lost
```

| Status | Definition |
|--------|------------|
| `new` | Deal created from hot lead |
| `gathering` | Collecting pricing, motivation, docs |
| `qualified` | Has price + motivation + timeline |
| `packaging` | Creating deal package |
| `handed_off` | Sent to Lee 1031 X |
| `lost` | Dead (see `lost_reason`) |

### 5. lead_actions VIEW (AI Query Interface)

AI agents query this view to get the next action for each lead:

```sql
SELECT * FROM lead_actions
WHERE next_action IS NOT NULL
ORDER BY updated_at DESC;
```

Returns:
- All lead fields
- `next_action`: computed action (enroll_campaign, triage_reply, review_draft, complete_task, package_deal, follow_up, nurture_outreach)
- `pending_tasks`: count of pending tasks
- `pending_drafts`: count of pending email drafts
- `last_activity_at`: most recent activity timestamp

## Removed Fields

| Table | Removed | Reason |
|-------|---------|--------|
| leads | `is_buyer` | Replaced by `lead_type` |
| leads | `is_seller` | Replaced by `lead_type` |
| leads | `company_type` | Replaced by `lead_type` |
| leads | `qualification_status` | Never used |

## Unchanged

- **contacts table**: No changes (current schema works)
- **tasks table**: Only added `in_progress` status
- **email_drafts table**: No changes

## Migration File

`supabase/migrations/00038_schema_simplification.sql`

To apply:
```bash
npx supabase db reset  # Resets and applies all migrations
```

## Validation Queries

After migration, verify:

```sql
-- All leads have lead_type
SELECT COUNT(*) FROM leads WHERE lead_type IS NULL;  -- Should be 0

-- All closed leads have reason
SELECT COUNT(*) FROM leads WHERE status = 'closed' AND closed_reason IS NULL;  -- Should be 0

-- lead_actions view works
SELECT next_action, COUNT(*) FROM lead_actions GROUP BY next_action;
```

## Usage Examples

### AI: "What needs my attention?"

```sql
SELECT name, status, next_action, pending_tasks, pending_drafts
FROM lead_actions
WHERE next_action IS NOT NULL
ORDER BY
  CASE next_action
    WHEN 'triage_reply' THEN 1
    WHEN 'review_draft' THEN 2
    WHEN 'complete_task' THEN 3
    WHEN 'follow_up' THEN 4
    ELSE 5
  END;
```

### AI: "Show me all buyers"

```sql
SELECT * FROM leads WHERE lead_type IN ('buyer', 'buyer_seller');
```

### AI: "Why did we close this lead?"

```sql
SELECT name, closed_reason FROM leads WHERE status = 'closed';
```

### AI: "What deals are we working?"

```sql
SELECT d.*, l.name as lead_name
FROM deals d
JOIN leads l ON l.id = d.lead_id
WHERE d.status NOT IN ('handed_off', 'lost');
```
