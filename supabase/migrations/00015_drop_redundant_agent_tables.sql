-- Migration: Drop redundant agent tables (pg-boss replaces this functionality)
--
-- Keeping:
--   agent_executions - Audit log for agent runs
--   agent_definitions - Agent registry (may simplify later)
--
-- Removing:
--   agent_tasks - pg-boss handles job queue
--   agent_workflows - pg-boss can chain jobs
--   agent_workflow_steps - pg-boss handles this
--   agent_workflow_runs - pg-boss tracks runs
--   agent_workflow_step_runs - pg-boss tracks step runs

-- Drop in reverse dependency order
DROP TABLE IF EXISTS agent_workflow_step_runs CASCADE;
DROP TABLE IF EXISTS agent_workflow_runs CASCADE;
DROP TABLE IF EXISTS agent_workflow_steps CASCADE;
DROP TABLE IF EXISTS agent_workflows CASCADE;
DROP TABLE IF EXISTS agent_tasks CASCADE;

-- Update client_criteria to remove agent_tasks foreign key references if any
-- (The status workflow now uses pg-boss jobs instead)

COMMENT ON TABLE agent_executions IS 'Audit log for agent runs - kept for logging/debugging';
COMMENT ON TABLE agent_definitions IS 'Registry of available agents - kept for reference';
