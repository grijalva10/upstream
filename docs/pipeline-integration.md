# Upstream Pipeline Integration Guide

This document describes how agents and worker jobs work together in the Upstream sourcing pipeline.

> **Note:** The architecture evolved from a pure agent-based design to a hybrid approach where most automation runs as scheduled worker jobs (pg-boss) with agents handling complex reasoning tasks.

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SOURCING PHASE                           │
├─────────────────────────────────────────────────────────────┤
│  @sourcing-agent  │ Generate CoStar queries from criteria   │
│        ↓                                                    │
│  [CoStar extraction] → properties, companies, contacts      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    OUTREACH PHASE                           │
├─────────────────────────────────────────────────────────────┤
│  @outreach-copy-gen │ Create personalized 3-email sequence  │
│        ↓                                                    │
│  email_queue → process-queue job → send-email job           │
│        ↓                                                    │
│  [Outlook COM sends] → activities logged                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    REPLY HANDLING                           │
├─────────────────────────────────────────────────────────────┤
│  email-sync job (every 5 min) → synced_emails              │
│        ↓                                                    │
│  process-replies job (every 2 min)                         │
│    ├── Pre-filter: newsletters, bounces, internal          │
│    └── AI classify: hot | question | pass | bounce | other │
│        ↓                                                    │
│  ┌────────────────────┬────────────────────┐               │
│  │ hot/question       │ pass/bounce        │               │
│  │ → email_drafts     │ → DNC/exclusions   │               │
│  │ → [Human reviews]  │ → status updates   │               │
│  └────────────────────┴────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    AUTONOMOUS OPS                           │
├─────────────────────────────────────────────────────────────┤
│  auto-follow-up job (daily 9 AM)                           │
│    └── Send follow-ups for pending docs, OOO returns       │
│                                                             │
│  ghost-detection job (daily 9:30 AM)                       │
│    └── Mark contacts unresponsive after X days no reply    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              QUALIFICATION (Manual Currently)               │
├─────────────────────────────────────────────────────────────┤
│  Human reviews email_drafts in /approvals UI               │
│  Human tracks qualification in deals table                  │
│  Human schedules calls and creates deal packages           │
│                                                             │
│  (Future: qualify-agent, schedule-agent, deal-packager)    │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Active Agents

#### 1. @sourcing-agent
**Trigger**: Buyer criteria input or new search created
**Input**: Natural language buyer requirements
**Output**: CoStar query payloads, strategy summary
**Writes to**: searches.payloads_json, searches.strategy_summary

#### 2. @outreach-copy-gen
**Trigger**: Campaign creation or "generate emails"
**Input**: Contact + property + buyer context
**Output**: 3-email sequence with subject lines and body copy
**Writes to**: email_queue (via API)

### Worker Jobs

#### email-sync
**Schedule**: Every 5 minutes
**Purpose**: Pull new emails from Outlook
**Writes to**: synced_emails

#### process-replies
**Schedule**: Every 2 minutes
**Purpose**: Classify inbound emails + take action
**Classification**: 5 categories (hot, question, pass, bounce, other)
**Actions**: Create drafts, update DNC, add exclusions, update statuses
**Writes to**: synced_emails, email_drafts, dnc_entries, email_exclusions, contacts, companies

#### process-queue
**Schedule**: Every minute
**Purpose**: Dequeue emails ready to send
**Writes to**: Triggers send-email jobs

#### send-email
**Trigger**: On demand (from process-queue)
**Purpose**: Send email via Outlook COM
**Writes to**: activities

#### auto-follow-up
**Schedule**: Daily at 9 AM
**Purpose**: Send follow-ups for pending docs and OOO returns
**Writes to**: email_queue

#### ghost-detection
**Schedule**: Daily at 9:30 AM
**Purpose**: Mark unresponsive contacts
**Writes to**: contacts.status

### Not Yet Implemented

These were in the original design but are currently manual:

- **qualify-agent**: Track pricing, motivation, decision maker
- **schedule-agent**: Propose time slots, create calendar events, call prep
- **deal-packager**: Create deal packages, notify matching clients

## Data Flow

### Sourcing → Outreach
```
searches.payloads_json ───────────────────────► CoStar extraction
properties, companies, contacts ──────────────► outreach-copy-gen context
outreach-copy-gen output ─────────────────────► email_queue
```

### Outreach → Reply Handling
```
email_queue → process-queue → send-email ─────► activities (email_sent)
[Outlook receives reply]
email-sync job ───────────────────────────────► synced_emails
process-replies job ──────────────────────────► classification + action
```

### Reply Classification → Actions
```
hot/question ─────────────────────────────────► email_drafts (for human review)
pass (with DNC request) ──────────────────────► dnc_entries
pass (no DNC) ────────────────────────────────► company.status = dnc/nurture
bounce ───────────────────────────────────────► email_exclusions
other ────────────────────────────────────────► logged only
```

## Status Transitions

### Company Status Flow
```
new ──► contacted ──► engaged ──► qualified ──► handed_off
                          │
                          ├──► nurture (soft_pass)
                          └──► dnc (hard_pass)
```

### Qualification Status Flow
```
new ──► engaging ──► qualified ──► docs_received ──► ready_to_package
```

### Sequence Status Flow
```
active ──► completed (3 emails sent)
       ├──► replied (response received)
       ├──► paused (soft_pass)
       └──► unsubscribed (hard_pass/dnc)
```

## Approval Queue Flow

AI-generated reply drafts go through human approval before sending.

### Email Draft Types
| Type | Generated By | Purpose |
|------|--------------|---------|
| `cold_outreach` | outreach-copy-gen | Initial 3-email sequence |
| `reply` | process-replies job | Response to hot/question emails |

### Approval Process
1. AI generates draft → `email_drafts` with `status: pending`
2. Human reviews in `/approvals` UI
3. Approve → `status: approved`
4. process-queue picks up → send-email sends → `status: sent`
5. Activity logged

## Database Views

### approval_queue
Combined view of all items awaiting human approval (email drafts + classification reviews).

### qualification_pipeline
Shows deals in progress with their qualification status and what's missing.

### client_pipeline_summary
Aggregated stats per client: criteria count, extractions, properties, contacts.

## Integration Test Scenarios

### Scenario 1: Cold Outreach → Hot Reply
1. sourcing-agent generates CoStar queries
2. CoStar extraction populates properties/companies/contacts
3. outreach-copy-gen creates email sequence
4. Emails queued → process-queue → send-email
5. Owner replies: "Interested, we'd consider $22M"
6. email-sync pulls reply
7. process-replies classifies as `hot`, creates email_draft
8. Human reviews draft in /approvals, edits if needed, approves
9. Reply sent, human continues qualification manually

### Scenario 2: Cold Outreach → Bounce
1. Email sent via Outlook
2. Bounce received
3. email-sync pulls bounce notification
4. process-replies classifies as `bounce`
5. Contact added to email_exclusions
6. Contact status updated to `bounced`

### Scenario 3: Soft Pass → Nurture
1. Owner replies: "Not right now, maybe next year"
2. email-sync pulls reply
3. process-replies classifies as `pass` (soft)
4. Company status → nurture
5. Sequence stops
6. ghost-detection job will skip this contact

## Error Handling

### Classification Low Confidence
When confidence < 0.7:
- Draft created with `status: pending` for human review
- Human reviews in /approvals or /inbox UI
- Human can edit and approve or reject

### Outlook COM Failure
When email send fails:
- Retry up to 3 times
- Log error to activities
- If bounce-related, add to exclusions

### Missing Data for Deal Package
If qualification_data incomplete:
- Log warning
- Don't create package
- Flag for human review

## Metrics to Track

| Metric | Source | Purpose |
|--------|--------|---------|
| Emails sent | activities | Volume tracking |
| Reply rate | synced_emails / activities | Campaign effectiveness |
| Classification accuracy | (needs human review) | Agent quality |
| Time to qualify | qualification_data timestamps | Pipeline velocity |
| Deal conversion | deal_packages / extraction_lists | Success rate |

## Local Requirements

These must run on the operator's Windows machine:
1. **Supabase local** - PostgreSQL database
2. **Outlook desktop** - COM automation for email
3. **Node.js** - Worker jobs run via pg-boss

## Commands

```bash
# Start all services (web + worker + CoStar service)
npm run dev

# Or start individually
npm run dev:web            # Next.js web app
npm run dev:worker         # pg-boss worker (runs scheduled jobs)

# Database
npx supabase start         # Start local Supabase
npx supabase stop          # Stop (preserves data)
npx supabase db reset      # Reset and re-seed

# Manual job triggers (via API)
# POST /api/jobs/email-sync      - Sync Outlook
# POST /api/jobs/process-replies - Classify replies
# POST /api/jobs/generate-queries - Run sourcing agent

# Direct database access
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
```
