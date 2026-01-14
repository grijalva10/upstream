-- Migration: Add workflow statuses for criteria pipeline
-- Adds generating, pending_review, extracting statuses

-- =============================================================================
-- UPDATE CLIENT_CRITERIA STATUS CONSTRAINT
-- =============================================================================

ALTER TABLE client_criteria DROP CONSTRAINT IF EXISTS client_criteria_status_check;
ALTER TABLE client_criteria ADD CONSTRAINT client_criteria_status_check
    CHECK (status IN (
        'draft',           -- Initial state, criteria created
        'pending_queries', -- Legacy: waiting for queries (same as generating)
        'generating',      -- Sourcing agent generating queries
        'pending_review',  -- Queries generated, waiting for review
        'pending_approval',-- Legacy: same as pending_review
        'approved',        -- Queries approved, ready for extraction
        'extracting',      -- Extraction in progress
        'active',          -- Extraction complete, ready for outreach
        'paused',          -- Temporarily paused
        'archived'         -- No longer active
    ));

COMMENT ON COLUMN client_criteria.status IS 'Workflow status: draft → generating → pending_review → approved → extracting → active';
