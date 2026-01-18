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

> **Status:** This agent is NOT invoked as a subagent.
> Classification logic is implemented inline in `apps/worker/src/jobs/process-replies.job.ts`.
> This file is kept as documentation for the classification system.

## Current Implementation

Email replies are processed by:
- **Job:** `apps/worker/src/jobs/process-replies.job.ts`
- **Schedule:** Every 2 minutes via pg-boss
- **Flow:** Fetch unclassified → Pre-filter by sender → Classify via Claude → Execute action

## Classification Categories (5 simplified)

The production system uses 5 categories (not the 16 in the DB enum):

| Category | Description | Action Taken |
|----------|-------------|--------------|
| `hot` | Interested, gave pricing, wants to schedule, sent docs | Create draft reply, update deal data |
| `question` | Asking about deal/buyer/terms | Create draft answer |
| `pass` | Not interested, wrong person, has broker, DNC | Update company status, add to DNC if requested |
| `bounce` | Delivery failure | Add to email_exclusions, mark contact bounced |
| `other` | OOO, newsletters, general, unclear | No action (filtered or logged) |

## Pre-filtering (Before AI Classification)

The job auto-classifies without AI for:
- **Newsletters/automated:** CoStar alerts, platform notifications → `other`
- **Internal team:** lee-associates.com → `other`
- **Bounces:** mailer-daemon, postmaster → `bounce`

## Human Review Queue

- **Confidence < 0.7:** Creates `email_drafts` with `status: pending` for human approval
- **All hot/question replies:** Draft created for review (never auto-sends)

## Why Inline vs Agent?

The inline prompt approach was chosen because:
1. Classification + action in single job reduces latency
2. Full context (contact, company, property, loan, deal, thread) available in one query
3. Simpler error handling and retry logic
4. No inter-process communication overhead

## Related Files

| File | Purpose |
|------|---------|
| `apps/worker/src/jobs/process-replies.job.ts` | Main implementation |
| `apps/web/src/app/(app)/inbox/` | UI for reviewing classified emails |
| `apps/web/src/app/(app)/approvals/` | Draft approval queue (coming soon) |

## Database Tables Used

| Table | Purpose |
|-------|---------|
| `synced_emails` | Email storage + classification fields |
| `deals` | Qualification data (asking_price, noi, cap_rate) |
| `email_drafts` | Human review queue |
| `dnc_entries` | Do Not Contact list |
| `email_exclusions` | Bounce exclusions |
| `contacts` | Contact status updates |
| `companies` | Company status updates |
