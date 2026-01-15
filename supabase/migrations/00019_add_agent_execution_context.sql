-- Add missing columns to agent_executions table
-- These are used by the agent runner to store execution context, session tracking, and error details

-- Add columns for context tracking and session resume
ALTER TABLE agent_executions
ADD COLUMN IF NOT EXISTS context JSONB,
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Add error column (schema has error_message but code uses error)
ALTER TABLE agent_executions
ADD COLUMN IF NOT EXISTS error TEXT;

-- Add tokens_used column (schema has input_tokens/output_tokens but code uses tokens_used)
ALTER TABLE agent_executions
ADD COLUMN IF NOT EXISTS tokens_used INTEGER;

-- Add updated_at column for tracking updates
ALTER TABLE agent_executions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Create index for session lookup
CREATE INDEX IF NOT EXISTS idx_agent_executions_session ON agent_executions(session_id);

-- Comments
COMMENT ON COLUMN agent_executions.context IS 'Context data for the execution (criteria_type, markets, etc.)';
COMMENT ON COLUMN agent_executions.session_id IS 'Claude Code session ID for multi-turn resume';
COMMENT ON COLUMN agent_executions.error IS 'Error message from failed execution';
COMMENT ON COLUMN agent_executions.tokens_used IS 'Total tokens used in execution';
COMMENT ON COLUMN agent_executions.updated_at IS 'Last update timestamp';
