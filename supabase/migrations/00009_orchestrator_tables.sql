-- Orchestrator tables for checkpoint management, feedback, and approval queue
-- Migration: 00009_orchestrator_tables.sql

-- ============================================================================
-- Checkpoint Settings
-- Controls whether checkpoints require approval (plan) or auto-execute (auto)
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkpoint_settings (
    checkpoint TEXT PRIMARY KEY,
    mode TEXT NOT NULL DEFAULT 'plan' CHECK (mode IN ('plan', 'auto')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE checkpoint_settings IS 'Controls plan/auto mode for each checkpoint';
COMMENT ON COLUMN checkpoint_settings.checkpoint IS 'Checkpoint name (sourcing, extraction, campaign)';
COMMENT ON COLUMN checkpoint_settings.mode IS 'plan = requires approval, auto = executes immediately';

-- Default checkpoints to plan mode
INSERT INTO checkpoint_settings (checkpoint, mode) VALUES
    ('sourcing', 'auto'),    -- Sourcing runs automatically (no approval needed)
    ('extraction', 'plan'),  -- Extraction requires 2FA (always plan)
    ('campaign', 'plan'),    -- Campaign requires approval initially
    ('classification', 'auto') -- Classification runs automatically
ON CONFLICT (checkpoint) DO NOTHING;


-- ============================================================================
-- Checkpoint Approvals (renamed from approval_queue to avoid view conflict)
-- Items waiting for user approval at checkpoints
-- ============================================================================

CREATE TABLE IF NOT EXISTS checkpoint_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkpoint TEXT NOT NULL REFERENCES checkpoint_settings(checkpoint),
    data JSONB NOT NULL,
    context JSONB,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    feedback TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    processed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_checkpoint_approvals_checkpoint_status ON checkpoint_approvals(checkpoint, status);
CREATE INDEX IF NOT EXISTS idx_checkpoint_approvals_created_at ON checkpoint_approvals(created_at);

COMMENT ON TABLE checkpoint_approvals IS 'Queue of items waiting for user approval at checkpoints';


-- ============================================================================
-- Agent Feedback
-- Stores feedback and learnings from agent executions for reinforcement
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_execution_id UUID REFERENCES agent_executions(id),
    agent_name TEXT NOT NULL,

    -- Feedback details
    feedback_type TEXT NOT NULL CHECK (feedback_type IN ('approve', 'retry', 'reject')),
    feedback_text TEXT,

    -- Expected vs actual outcomes
    expected_outcome JSONB,
    actual_outcome JSONB,

    -- What was adjusted based on feedback
    adjustment_made TEXT,

    -- Final outcome after adjustment
    final_outcome JSONB,

    -- Tags for retrieval (so agents can learn from similar situations)
    criteria_type TEXT,
    market_tags TEXT[],

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_feedback_agent_name ON agent_feedback(agent_name);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_criteria_type ON agent_feedback(criteria_type);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_created_at ON agent_feedback(created_at DESC);

COMMENT ON TABLE agent_feedback IS 'Feedback and learnings from agent executions for reinforcement';
COMMENT ON COLUMN agent_feedback.expected_outcome IS 'What the agent predicted would happen';
COMMENT ON COLUMN agent_feedback.actual_outcome IS 'What actually happened';
COMMENT ON COLUMN agent_feedback.adjustment_made IS 'Description of what was changed after feedback';


-- ============================================================================
-- Add missing columns to existing tables
-- ============================================================================

-- Add columns to client_criteria for query generation tracking
ALTER TABLE client_criteria ADD COLUMN IF NOT EXISTS generated_queries JSONB;
ALTER TABLE client_criteria ADD COLUMN IF NOT EXISTS queries_generated_at TIMESTAMPTZ;

-- Add columns to extraction_lists for campaign status
ALTER TABLE extraction_lists ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add columns to synced_emails for classification
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classification_confidence REAL;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS needs_manual_review BOOLEAN DEFAULT FALSE;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS review_reason TEXT;

-- Add columns to sequence_subscriptions for scheduling
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS scheduled_sends JSONB;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS stopped_reason TEXT;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS paused_reason TEXT;

-- Add columns to sequences for extraction linking
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS extraction_list_id UUID REFERENCES extraction_lists(id);

-- Add columns to tasks for email linking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS email_id UUID REFERENCES synced_emails(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS data JSONB;


-- ============================================================================
-- Email Exclusions (permanent exclusion list)
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_exclusions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('bounce', 'hard_pass', 'manual')),
    source_email_id UUID REFERENCES synced_emails(id),
    bounce_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_exclusions_email ON email_exclusions(email);

COMMENT ON TABLE email_exclusions IS 'Permanent email exclusion list (bounces, explicit opt-outs)';


-- ============================================================================
-- DNC Entries (company-level do not contact)
-- ============================================================================

-- Add source_email_id to dnc_entries if not exists
ALTER TABLE dnc_entries ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES synced_emails(id);
ALTER TABLE dnc_entries ADD COLUMN IF NOT EXISTS notes TEXT;


-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE checkpoint_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkpoint_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_exclusions ENABLE ROW LEVEL SECURITY;

-- Create policies (allow service role full access)
CREATE POLICY "Service role full access to checkpoint_settings" ON checkpoint_settings
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to checkpoint_approvals" ON checkpoint_approvals
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to agent_feedback" ON agent_feedback
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to email_exclusions" ON email_exclusions
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to view (read-only)
CREATE POLICY "Authenticated users can view checkpoint_settings" ON checkpoint_settings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view checkpoint_approvals" ON checkpoint_approvals
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view agent_feedback" ON agent_feedback
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view email_exclusions" ON email_exclusions
    FOR SELECT USING (auth.role() = 'authenticated');
