# Upstream Pipeline Integration Guide

This document describes how the 6 agents work together in the Upstream sourcing pipeline.

## Pipeline Overview

```
┌─────────────────┐
│ sourcing-agent  │ Generate CoStar queries from buyer criteria
└───────┬─────────┘
        │ extraction_lists, properties
        ▼
┌──────────────────┐
│drip-campaign-exec│ Enroll contacts, manage 3-email sequences
└───────┬──────────┘
        │ sequence_subscriptions (awaiting_approval=true)
        ▼
┌─────────────────┐
│ [Human Approves]│ Review and approve email drafts
└───────┬─────────┘
        │ awaiting_approval=false
        ▼
┌──────────────────┐
│ Outlook COM Send │ Emails sent via Outlook
└───────┬──────────┘
        │ activities logged
        ▼
┌──────────────────┐
│ Outlook Sync     │ Sync incoming replies
└───────┬──────────┘
        │ synced_emails
        ▼
┌───────────────────────┐
│ response-classifier   │ Classify into 8 categories
└───────┬───────────────┘
        │ classification, extracted_pricing
        ▼
┌─────────────────────┐        ┌─────────────────────┐
│  interested/        │        │  soft_pass/         │
│  pricing_given/     │        │  hard_pass/         │
│  question           │        │  bounce             │
└───────┬─────────────┘        └───────┬─────────────┘
        │                              │
        ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│ qualify-agent       │        │ Auto-handle:        │
│ - Check missing data│        │ - DNC list          │
│ - Generate follow-up│        │ - Email exclusions  │
│ - Escalate to call  │        │ - Nurture list      │
└───────┬─────────────┘        └─────────────────────┘
        │
        ├──── call requested ────┐
        │                        ▼
        │               ┌─────────────────────┐
        │               │ schedule-agent      │
        │               │ - Propose times     │
        │               │ - Create calendar   │
        │               │ - Send call prep    │
        │               └─────────────────────┘
        │
        ▼
┌─────────────────────┐
│ qualification_data  │ Track: pricing, motivation, decision maker
└───────┬─────────────┘
        │ status = 'qualified'
        ▼
┌─────────────────────┐
│ deal-packager       │ Create deal package, notify matching clients
└───────┬─────────────┘
        │ deal_packages, email_drafts
        ▼
┌─────────────────────┐
│ [Client Notified]   │ Deal handed off
└─────────────────────┘
```

## Agent Responsibilities

### 1. sourcing-agent
**Trigger**: Buyer criteria input
**Input**: Natural language buyer requirements
**Output**: CoStar query payloads, extraction_lists
**Writes to**: client_criteria, extraction_lists

### 2. drip-campaign-exec
**Trigger**: Extraction list created or "execute campaign"
**Input**: extraction_list_id
**Output**: sequence_subscriptions with scheduled emails
**Writes to**: sequence_subscriptions, email_drafts

### 3. response-classifier
**Trigger**: New synced_emails from Outlook
**Input**: Email subject, body, from_email
**Output**: Classification JSON with confidence and extracted data
**Writes to**: synced_emails.classification, email_exclusions, dnc_entries

### 4. qualify-agent
**Trigger**: response-classifier returns interested/pricing_given/question
**Input**: Classified email + existing qualification_data
**Output**: Follow-up email draft, qualification_data updates
**Writes to**: email_drafts, qualification_data

### 5. schedule-agent
**Trigger**: Call request detected in email
**Input**: Email with call signals, company/property context
**Output**: Time slot proposals, calendar events, call prep
**Writes to**: email_drafts, tasks, (Outlook calendar via COM)

### 6. deal-packager
**Trigger**: qualification_data.status = 'qualified'
**Input**: Qualified deal data
**Output**: Deal package JSON, client notifications
**Writes to**: deal_packages, email_drafts

## Data Flow Between Agents

### sourcing-agent → drip-campaign-exec
```
extraction_lists.id ──────────────────────────► create sequence_subscriptions
properties.* ─────────────────────────────────► personalize email templates
companies.*, contacts.* ──────────────────────► recipient info
```

### drip-campaign-exec → response-classifier
```
(Outlook sync)
synced_emails ────────────────────────────────► classify response
sequence_subscriptions ───────────────────────► stop if reply received
```

### response-classifier → qualify-agent
```
synced_emails.classification ─────────────────► determine response type
synced_emails.extracted_pricing ──────────────► update qualification_data
```

### qualify-agent → schedule-agent
```
email_drafts (with call request) ─────────────► detect call signals
qualification_data ───────────────────────────► context for call prep
```

### qualify-agent → deal-packager
```
qualification_data.status = 'qualified' ──────► trigger packaging
qualification_data.* ─────────────────────────► source for package
synced_emails.* ──────────────────────────────► conversation summary
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

All agent-generated emails go through an approval queue before sending.

### Email Draft Types
| Type | Generated By | Purpose |
|------|--------------|---------|
| `cold_outreach` | drip-campaign-exec | Initial 3-email sequence |
| `follow_up` | qualify-agent | Response to interested |
| `qualification` | qualify-agent | Request pricing/motivation |
| `scheduling` | schedule-agent | Time slot proposals |
| `escalation` | qualify-agent | Escalate to call |

### Approval Process
```sql
-- List pending approvals
SELECT * FROM approval_queue ORDER BY created_at ASC;

-- Approve
UPDATE email_drafts SET status = 'approved' WHERE id = :id;

-- Send (after approval)
-- Outlook COM sends email
-- email_drafts.status = 'sent'
-- activities logged
```

## Database Views

### approval_queue
Combined view of all items awaiting human approval (email drafts + classification reviews).

### qualification_pipeline
Shows deals in progress with their qualification status and what's missing.

### client_pipeline_summary
Aggregated stats per client: criteria count, extractions, properties, contacts.

## Integration Test Scenarios

### Scenario 1: Cold Outreach → Reply → Qualification → Deal
1. sourcing-agent generates queries
2. drip-campaign-exec creates sequences
3. Human approves Email 1
4. Email 1 sent
5. Owner replies: "Interested, we'd consider $22M"
6. response-classifier: `pricing_given`, confidence 0.9
7. qualify-agent: generates follow-up asking for NOI
8. Human approves
9. Owner replies with NOI
10. qualify-agent: updates qualification_data
11. Owner provides motivation
12. qualification_data.status = 'qualified'
13. deal-packager: creates package
14. Matching clients notified

### Scenario 2: Cold Outreach → Bounce
1. Email 1 sent
2. Bounce received
3. response-classifier: `bounce`, confidence 1.0
4. Contact added to email_exclusions
5. Sequence stopped

### Scenario 3: Interested → Call Escalation
1. Owner replies: "Let's discuss"
2. response-classifier: `interested`
3. qualify-agent: asks for pricing
4. Owner: "What are you thinking?"
5. qualify-agent: asks again
6. Owner: "Make me an offer"
7. qualify-agent: detects dodging, escalates to call
8. schedule-agent: proposes 3 time slots
9. Owner confirms time
10. Calendar event created
11. Call prep email sent 30 min before

### Scenario 4: Soft Pass → Nurture
1. Owner replies: "Not right now, maybe next year"
2. response-classifier: `soft_pass`
3. Company status → nurture
4. Sequence paused
5. Task created for follow-up in 6 months

## Error Handling

### Classification Low Confidence
When confidence < 0.5:
- `needs_human_review = true`
- Appears in approval_queue
- Human manually classifies

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
3. **Python with pywin32** - For Outlook COM

## Commands

```bash
# Start local Supabase
npx supabase start

# Reset database
npx supabase db reset

# Run extraction pipeline
python scripts/run_extraction.py output/queries/Client_payloads.json

# Process approval queue
python scripts/approval_queue.py list
python scripts/approval_queue.py approve --id <uuid>

# Execute pending sends
python scripts/execute_drip_sends.py

# Sync Outlook emails
python scripts/sync_outlook.py

# Run response classifier
python scripts/classify_responses.py

# Generate call prep
python scripts/generate_call_prep.py
```
