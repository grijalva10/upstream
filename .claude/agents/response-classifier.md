---
name: response-classifier
description: |
  DEPRECATED - This agent spec is for reference only.
  Email classification is now handled by the unified process-replies.job.ts worker job.
  The job classifies emails AND takes autonomous action in a single pipeline.
model: sonnet
tools: Read, Bash
---

# Response Classifier (DEPRECATED)

> **Note:** This agent has been consolidated into the `process-replies` worker job.
> Classification + action execution now happens in a single unified pipeline.
> This file is kept for documentation purposes.

## New Implementation

Email replies are now processed by:
- **Job:** `apps/worker/src/jobs/process-replies.job.ts`
- **Schedule:** Every 2 minutes
- **Flow:** Sync → Classify → Execute Action (all in one job)

## Classification Categories (19 total)

| Category | Description | Autonomous Action |
|----------|-------------|-------------------|
| `hot_interested` | Shows interest, wants to engage | Draft reply |
| `hot_schedule` | Wants a call, gave phone | Check calendar → propose times |
| `hot_confirm` | Confirming a proposed time | Create event → send invite |
| `hot_pricing` | Provided price, NOI, cap rate | Extract data → store → reply |
| `question` | Asking about deal/terms | Draft answer |
| `info_request` | Wants documents sent | Attach doc → send |
| `referral` | Gave another contact | Create contact → enroll |
| `broker` | Redirected to broker | Log broker → flag for decision |
| `ooo` | Out of office | Schedule follow-up task |
| `soft_pass` | Not now, maybe later | Nurture task (90 days) |
| `hard_pass` | Stop emailing, DNC | Add to DNC → archive |
| `wrong_contact` | Stale/incorrect contact | Flag for research |
| `bounce` | Delivery failure | Mark bounced → exclude |
| `doc_promised` | Said they'll send docs | Track → schedule follow-up |
| `doc_received` | Sent documents | Parse → check if qualified |
| `buyer_inquiry` | Wants to BUY, not sell | Start criteria gathering |
| `buyer_criteria_update` | Adding to buy criteria | Continue gathering → create search |
| `general_update` | General correspondence | Reply if needed |
| `unclear` | Cannot determine intent | Flag for human review |

## Qualification Criteria

A deal is qualified when:
- **2 of 3 pricing fields:** asking_price, NOI, cap_rate
- **Plus:** rent_roll document received
- **Plus:** operating_statement/T12 document received

## Autonomous Actions by Classification

### Scheduling Flow
```
"Call me" → Check Outlook calendar → Propose 3-4 slots
     ↓
"Tuesday works" → Create calendar event → Send invite → Create call prep task
```

### Document Collection Flow
```
"I'll send the rent roll" → Track as 'promised' → Schedule 3-day follow-up
     ↓
(No docs after 3 days) → Auto follow-up email
     ↓
(No docs after 10 days + 2 follow-ups) → Mark as 'ghosted' → Nurture task
```

### Buyer Inquiry Flow
```
"We're looking to buy industrial" → Extract criteria → Ask for missing fields
     ↓
(Criteria complete) → Create search → Queue sourcing agent → Find properties
```

## Database Tables Used

| Table | Purpose |
|-------|---------|
| `synced_emails` | Email storage + classification |
| `qualification_data` | Deal qualification tracking |
| `buyer_criteria_tracking` | Buyer inquiry multi-turn gathering |
| `scheduled_calls` | Calendar event tracking |
| `tasks` | Follow-ups, reviews, nurture reminders |
| `dnc_entries` | Do Not Contact list |
| `email_exclusions` | Bounce exclusions |
| `email_drafts` | Human review queue for low-confidence |

## Related Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| `process-replies` | Every 2 min | Main classification + action |
| `auto-follow-up` | Daily 9 AM | Follow up on promised docs |
| `ghost-detection` | Daily 9:30 AM | Mark unresponsive contacts |

## Confidence Thresholds

- **≥ 0.85**: Auto-send reply
- **0.70 - 0.84**: Auto-send but monitor
- **< 0.70**: Create draft for human review
