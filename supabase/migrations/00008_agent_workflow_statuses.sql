-- Migration: Add workflow statuses for agent pipeline
-- Adds pending_approval status to client_criteria
-- Adds new task types for sourcing workflow

-- =============================================================================
-- UPDATE CLIENT_CRITERIA STATUS CONSTRAINT
-- =============================================================================

-- Drop and recreate constraint with new status
ALTER TABLE client_criteria DROP CONSTRAINT IF EXISTS client_criteria_status_check;
ALTER TABLE client_criteria ADD CONSTRAINT client_criteria_status_check
    CHECK (status IN ('draft', 'pending_queries', 'pending_approval', 'approved', 'active', 'paused', 'archived'));

-- =============================================================================
-- UPDATE AGENT_TASKS TASK_TYPE CONSTRAINT
-- =============================================================================

-- Drop and recreate constraint with new task types
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS agent_tasks_task_type_check;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_task_type_check
    CHECK (task_type IN (
        'build_query', 'run_extraction', 'import_csv', 'run_sequence_step',
        'sync_outlook', 'classify_response', 'enrich_contact', 'write_outreach',
        'generate_queries', 'package_deal'
    ));

-- =============================================================================
-- ADD REFERENCE TO CRITERIA IN AGENT_TASKS
-- =============================================================================

ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS criteria_id UUID REFERENCES client_criteria(id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_criteria ON agent_tasks(criteria_id) WHERE criteria_id IS NOT NULL;
