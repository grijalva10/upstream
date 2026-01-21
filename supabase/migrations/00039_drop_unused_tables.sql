-- Migration: Drop unused tables and consolidate exclusions
--
-- Part 1: Drop tables never used in application code
-- Part 2: Consolidate dnc_entries into exclusions table
-- Part 3: Clean up email_exclusions references (already dropped in 00024)
--
-- Verified by searching apps/ for .from("table_name") patterns.
-- None of these tables have any usage in the application.

-- ============================================================================
-- PART 1: DROP UNUSED TABLES
-- ============================================================================

-- Agent infrastructure (never used - pg-boss replaced this)
DROP TABLE IF EXISTS agent_execution_context CASCADE;
DROP TABLE IF EXISTS agent_executions CASCADE;
DROP TABLE IF EXISTS agent_definitions CASCADE;
DROP TABLE IF EXISTS agent_metric_definitions CASCADE;
DROP TABLE IF EXISTS agent_feedback CASCADE;

-- Email infrastructure (never implemented)
DROP TABLE IF EXISTS email_events CASCADE;
DROP TABLE IF EXISTS email_templates CASCADE;
DROP TABLE IF EXISTS email_template_variants CASCADE;

-- Sequence infrastructure (replaced by campaigns)
DROP TABLE IF EXISTS sequence_subscriptions CASCADE;
DROP TABLE IF EXISTS sequence_steps CASCADE;
DROP TABLE IF EXISTS sequences CASCADE;

-- Orchestrator infrastructure (never used)
DROP TABLE IF EXISTS checkpoint_approvals CASCADE;
DROP TABLE IF EXISTS checkpoint_settings CASCADE;
DROP TABLE IF EXISTS orchestrator_status CASCADE;
DROP TABLE IF EXISTS send_rate_tracking CASCADE;

-- Reference data (agent reads from JSON files instead)
DROP TABLE IF EXISTS sourcing_strategies CASCADE;
DROP TABLE IF EXISTS markets CASCADE;
DROP TABLE IF EXISTS costar_lookups CASCADE;

-- Duplicate/unused tables
DROP TABLE IF EXISTS inbox_messages CASCADE;
DROP TABLE IF EXISTS scheduled_calls CASCADE;
DROP TABLE IF EXISTS buyer_criteria_tracking CASCADE;

-- ============================================================================
-- PART 2: CONSOLIDATE EXCLUSIONS
-- ============================================================================

-- Migrate dnc_entries data into exclusions table
-- The exclusions table has a better schema: exclusion_type, value, reason
INSERT INTO exclusions (exclusion_type, value, reason, created_at)
SELECT
  'email',
  LOWER(email),
  CASE
    WHEN reason = 'requested' THEN 'dnc'
    WHEN reason = 'hostile' THEN 'dnc'
    WHEN reason = 'legal' THEN 'dnc'
    WHEN reason = 'spam_complaint' THEN 'dnc'
    ELSE 'dnc'
  END,
  COALESCE(added_at, NOW())
FROM dnc_entries
WHERE email IS NOT NULL
ON CONFLICT (exclusion_type, value) DO NOTHING;

-- Drop the legacy dnc_entries table
DROP TABLE IF EXISTS dnc_entries CASCADE;

-- Note: email_exclusions was already dropped in migration 00024

-- ============================================================================
-- PART 3: CLEANUP COMMENTS
-- ============================================================================

COMMENT ON TABLE exclusions IS 'Unified exclusion list for emails, domains, companies, and contacts. Consolidates former dnc_entries and email_exclusions tables.';
