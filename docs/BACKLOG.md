# Backlog

Technical debt and feature gaps to address.

---

## Email Drafts - No Send Mechanism

**Added:** 2026-01-19

**Problem:** The `email_drafts` system is incomplete. Drafts can be:
- Created (by agents or humans) → status: `pending`
- Edited and approved via Inbox UI → status: `approved`
- But there's **no way to actually send** approved drafts

The `send-email` worker job reads from `email_queue` (used by campaigns), not `email_drafts`.

**Current workaround:** Copy/paste draft content into Outlook manually.

**Solution options:**
1. Add "Send Now" button in Inbox UI that:
   - Queues approved draft to `email_queue`
   - Triggers `send-email` job
   - Updates draft status to `sent`

2. Add worker job `send-drafts.job.ts` that:
   - Polls for `approved` drafts
   - Sends via Outlook bridge
   - Updates status to `sent`

3. Merge drafts into email_queue (simplify to one table)

**Files involved:**
- `apps/web/src/app/(app)/inbox/actions.ts` - has `approveDraft()` but no send
- `apps/worker/src/jobs/send-email.job.ts` - reads from `email_queue`, not `email_drafts`
- `apps/web/src/app/(app)/inbox/_components/mail-display.tsx` - UI for drafts

---
