# Migration: Sequences to Campaigns

**Date:** 2026-01-19
**Status:** Approved

## Summary

Remove the legacy `sequences`, `sequence_steps`, and `sequence_subscriptions` tables in favor of the newer `campaigns` and `enrollments` system. The legacy tables are mostly unused but `sequences` is still queried for send window settings.

## Current State

Two parallel systems exist for drip campaigns:

| Legacy System | New System | Status |
|--------------|------------|--------|
| `sequences` | `campaigns` | sequences still queried for send settings |
| `sequence_steps` | (3 emails hardcoded in campaigns) | sequence_steps unused |
| `sequence_subscriptions` | `enrollments` | sequence_subscriptions unused |

### Problem

`send-email.job.ts` reads from `sequences` to get send window settings (spacing, humanization, weekdays). The `campaigns` table is missing these columns.

## Changes

### 1. Schema: Add Columns to Campaigns

**Migration:** `00031_campaigns_send_settings.sql`

```sql
-- Add send settings to campaigns (migrating from sequences)
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS weekdays_only BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS spacing_min_sec INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS spacing_max_sec INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS humanize_timing BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS humanize_variance_min INTEGER DEFAULT -15,
ADD COLUMN IF NOT EXISTS humanize_variance_max INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS simulate_breaks BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN campaigns.weekdays_only IS 'Only send on weekdays (Mon-Fri)';
COMMENT ON COLUMN campaigns.spacing_min_sec IS 'Minimum seconds between campaign emails';
COMMENT ON COLUMN campaigns.spacing_max_sec IS 'Maximum seconds between campaign emails';
COMMENT ON COLUMN campaigns.humanize_timing IS 'Add random variance to send timing';
COMMENT ON COLUMN campaigns.humanize_variance_min IS 'Minutes to shift window start (negative = earlier)';
COMMENT ON COLUMN campaigns.humanize_variance_max IS 'Minutes to shift window start (positive = later)';
COMMENT ON COLUMN campaigns.simulate_breaks IS 'Add occasional longer pauses between emails';
```

### 2. Worker: Update send-email.job.ts

**File:** `apps/worker/src/jobs/send-email.job.ts`

Change `SendEmailPayload` interface:
```typescript
// Before
sequenceId?: string;

// After
campaignId?: string;
```

Change query from `sequences` to `campaigns` (lines 76-93):
```typescript
// Before
if (sequenceId && (jobType === 'cold_outreach' || jobType === 'follow_up')) {
  const { data: sequence } = await supabase
    .from('sequences')
    .select('*')
    .eq('id', sequenceId)
    .single();

// After
if (campaignId && (jobType === 'cold_outreach' || jobType === 'follow_up')) {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();
```

Update `getEmailCategory()` to use `campaignId` instead of `sequenceId`.

### 3. Worker: Update process-queue.job.ts

**File:** `apps/worker/src/jobs/process-queue.job.ts`

Line 92:
```typescript
// Before
sequenceId: email.sequence_id,

// After
campaignId: email.campaign_id,
```

### 4. API: Update queue route

**File:** `apps/web/src/app/api/queue/route.ts`

Accept `campaignId` and `enrollmentId` instead of `sequenceId` and `subscriptionId`:
```typescript
const {
  // ... existing fields ...
  campaignId,      // was: sequenceId
  enrollmentId,    // was: subscriptionId
} = body;

// In insert:
campaign_id: campaignId,
enrollment_id: enrollmentId,
```

### 5. Types: Update packages/db/types.ts

Update email queue types to use `campaign_id` instead of `sequence_id`.

### 6. Schema: Drop Legacy Tables

**Migration:** `00032_remove_legacy_sequences.sql`

```sql
-- Remove legacy sequence system (replaced by campaigns/enrollments)

-- Step 1: Drop legacy foreign key columns from email_queue
ALTER TABLE email_queue DROP COLUMN IF EXISTS sequence_id;
ALTER TABLE email_queue DROP COLUMN IF EXISTS subscription_id;

-- Step 2: Drop legacy tables (order matters due to FK constraints)
DROP TABLE IF EXISTS sequence_subscriptions;
DROP TABLE IF EXISTS sequence_steps;
DROP TABLE IF EXISTS sequences;
```

### 7. Update packages/db/schema.sql

Remove the following table definitions:
- `sequences` (lines 263-274)
- `sequence_steps` (lines 277-293)
- `sequence_subscriptions` (lines 296-314)

Remove associated triggers and comments.

### 8. Regenerate Database Types

After migrations, run:
```bash
npx supabase gen types typescript --local > apps/web/src/lib/supabase/database.types.ts
```

## Implementation Order

1. Migration: Add columns to campaigns (safe, additive)
2. Update worker code (send-email.job.ts, process-queue.job.ts)
3. Update API (queue route, types)
4. Regenerate database types
5. Migration: Drop legacy tables (after verification)

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/00031_campaigns_send_settings.sql` | Add 7 columns to campaigns |
| `supabase/migrations/00032_remove_legacy_sequences.sql` | Drop legacy tables/columns |
| `apps/worker/src/jobs/send-email.job.ts` | Query campaigns, rename param |
| `apps/worker/src/jobs/process-queue.job.ts` | Pass campaignId |
| `apps/web/src/app/api/queue/route.ts` | Accept campaignId/enrollmentId |
| `packages/db/types.ts` | Update email queue types |
| `packages/db/schema.sql` | Remove 3 table definitions |
| `apps/web/src/lib/supabase/database.types.ts` | Regenerate |

## Risks

- **Low risk:** All changes are straightforward renames and column additions
- **Mitigation:** Split into two PRs - code changes first, table drops second
