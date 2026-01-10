-- Upstream Sourcing Engine Database Schema
-- Supabase PostgreSQL
-- 24 core tables + 4 optional

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- SUPPORTING ENTITIES (create first for foreign key references)
-- =============================================================================

-- Markets (CoStar market reference)
CREATE TABLE markets (
    id INTEGER PRIMARY KEY,  -- CoStar market_key_id
    name TEXT NOT NULL,
    state TEXT,
    property_type_ids INTEGER[],
    bounding_box JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- CORE ENTITIES
-- =============================================================================

-- Properties (CRE Assets)
CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    costar_property_id TEXT UNIQUE,
    address TEXT NOT NULL,
    property_name TEXT,
    property_type TEXT,  -- Industrial, Office, Retail, Multifamily, etc.
    building_size_sqft INTEGER,
    lot_size_acres DECIMAL(10,2),
    year_built INTEGER,
    building_class TEXT,  -- A, B, C
    percent_leased DECIMAL(5,2),
    market_id INTEGER REFERENCES markets(id),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_properties_costar_id ON properties(costar_property_id);
CREATE INDEX idx_properties_market ON properties(market_id);
CREATE INDEX idx_properties_type ON properties(property_type);

-- Companies (Owner Organizations = "Leads")
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    costar_company_id TEXT UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'engaged', 'qualified', 'handed_off', 'dnc', 'rejected'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'costar' CHECK (source IN ('costar', 'manual', 'referral')),
    assigned_user_id UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_costar_id ON companies(costar_company_id);

-- Contacts (People)
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    costar_person_id TEXT UNIQUE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    title TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'dnc', 'bounced', 'unsubscribed'
    )),
    status_changed_at TIMESTAMPTZ DEFAULT NOW(),
    last_contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_company ON contacts(company_id);
CREATE INDEX idx_contacts_status ON contacts(status);

-- Property Loans (Distress Data)
CREATE TABLE property_loans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    costar_loan_id TEXT UNIQUE,
    lender_name TEXT,
    loan_type TEXT CHECK (loan_type IN (
        'acquisition', 'refinance', 'construction', 'conventional', 'bridge', 'cmbs', 'other'
    )),
    original_amount DECIMAL(15,2),
    current_balance DECIMAL(15,2),
    origination_date DATE,
    maturity_date DATE,
    interest_rate DECIMAL(5,3),
    interest_rate_type TEXT CHECK (interest_rate_type IN ('fixed', 'variable')),
    ltv_original DECIMAL(5,2),
    ltv_current DECIMAL(5,2),
    dscr_current DECIMAL(5,2),
    payment_status TEXT CHECK (payment_status IN (
        'performing', '30_day', '60_day', '90_day', 'maturity_default',
        'foreclosure', 'bankrupt', 'reo', 'defeased'
    )),
    is_balloon_maturity BOOLEAN DEFAULT FALSE,
    is_modification BOOLEAN DEFAULT FALSE,
    special_servicing_status TEXT CHECK (special_servicing_status IN ('current', 'previous', 'never')),
    watchlist_status TEXT CHECK (watchlist_status IN ('current', 'previous', 'never')),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_property_loans_property ON property_loans(property_id);
CREATE INDEX idx_property_loans_maturity ON property_loans(maturity_date);
CREATE INDEX idx_property_loans_payment_status ON property_loans(payment_status);
CREATE INDEX idx_property_loans_ltv ON property_loans(ltv_current);
CREATE INDEX idx_property_loans_dscr ON property_loans(dscr_current);

-- Property-Company Junction
CREATE TABLE property_companies (
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL DEFAULT 'owner' CHECK (relationship IN ('owner', 'manager', 'lender')),
    ownership_pct DECIMAL(5,2),
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (property_id, company_id)
);

CREATE INDEX idx_property_companies_company ON property_companies(company_id);

-- =============================================================================
-- SOURCING ENTITIES
-- =============================================================================

-- Sourcing Strategies
CREATE TABLE sourcing_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL CHECK (category IN (
        'hold_period', 'financial_distress', 'property_distress', 'equity'
    )),
    description TEXT,
    filter_template JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extraction Lists (forward declare, will add FK after agent_executions)
CREATE TABLE extraction_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sourcing_strategy_id UUID REFERENCES sourcing_strategies(id),
    name TEXT NOT NULL,
    payload_json JSONB,
    source_file TEXT,
    property_count INTEGER DEFAULT 0,
    contact_count INTEGER DEFAULT 0,
    extracted_at TIMESTAMPTZ,
    agent_execution_id UUID,  -- FK added after agent_executions table
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_extraction_lists_strategy ON extraction_lists(sourcing_strategy_id);

-- List Properties (Junction)
CREATE TABLE list_properties (
    extraction_list_id UUID REFERENCES extraction_lists(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (extraction_list_id, property_id)
);

CREATE INDEX idx_list_properties_property ON list_properties(property_id);

-- =============================================================================
-- OUTREACH ENTITIES (CRM)
-- =============================================================================

-- Email Templates
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT,
    body_text TEXT,
    category TEXT CHECK (category IN ('cold_outreach', 'follow_up', 'nurture', 'closing')),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequences (Drip Campaigns)
CREATE TABLE sequences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
    schedule JSONB,  -- {"ranges": [{"weekday": 1, "start": "09:00", "end": "17:00"}, ...]}
    timezone TEXT DEFAULT 'America/Los_Angeles',
    stop_on_reply BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sequence Steps
CREATE TABLE sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('email', 'call', 'task')),
    delay_seconds INTEGER NOT NULL DEFAULT 0,
    email_template_id UUID REFERENCES email_templates(id),
    threading TEXT CHECK (threading IN ('new_thread', 'old_thread')),
    required BOOLEAN DEFAULT FALSE,
    task_description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sequence_id, step_order)
);

CREATE INDEX idx_sequence_steps_sequence ON sequence_steps(sequence_id);

-- Sequence Subscriptions
CREATE TABLE sequence_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sequence_id UUID NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id),  -- context for merge tags
    current_step_id UUID REFERENCES sequence_steps(id),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'completed', 'unsubscribed', 'replied'
    )),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    next_step_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sequence_subscriptions_contact ON sequence_subscriptions(contact_id);
CREATE INDEX idx_sequence_subscriptions_status ON sequence_subscriptions(status);
CREATE INDEX idx_sequence_subscriptions_next_step ON sequence_subscriptions(next_step_at) WHERE status = 'active';

-- Activities
CREATE TABLE activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    activity_type TEXT NOT NULL CHECK (activity_type IN (
        'email_sent', 'email_received', 'email_opened', 'email_clicked',
        'call', 'note', 'meeting', 'status_change'
    )),
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    direction TEXT CHECK (direction IN ('outbound', 'inbound')),
    email_template_id UUID REFERENCES email_templates(id),
    sequence_subscription_id UUID REFERENCES sequence_subscriptions(id),
    metadata JSONB,  -- opens, clicks, bounce info, conversation_id
    activity_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_company ON activities(company_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);
CREATE INDEX idx_activities_type ON activities(activity_type);
CREATE INDEX idx_activities_activity_at ON activities(activity_at);

-- =============================================================================
-- SUPPORTING ENTITIES (continued)
-- =============================================================================

-- DNC List (Do Not Contact)
CREATE TABLE dnc_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    company_name TEXT,
    reason TEXT CHECK (reason IN ('requested', 'bounced', 'complaint', 'manual')),
    source TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id),
    notes TEXT
);

CREATE INDEX idx_dnc_email ON dnc_entries(email);
CREATE INDEX idx_dnc_phone ON dnc_entries(phone);

-- =============================================================================
-- AGENT AUTOMATION
-- =============================================================================

-- Agent Definitions (Registry)
CREATE TABLE agent_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    model TEXT DEFAULT 'sonnet' CHECK (model IN ('sonnet', 'opus', 'haiku')),
    tools TEXT[],
    file_path TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Executions
CREATE TABLE agent_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_definition_id UUID REFERENCES agent_definitions(id),
    agent_name TEXT,  -- for ad-hoc runs without registry
    prompt TEXT,
    response TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
        'queued', 'running', 'completed', 'failed', 'cancelled'
    )),
    error_message TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    metadata JSONB,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_definition_id);

-- Add FK to extraction_lists now that agent_executions exists
ALTER TABLE extraction_lists
ADD CONSTRAINT fk_extraction_agent_execution
FOREIGN KEY (agent_execution_id) REFERENCES agent_executions(id);

-- Agent Tasks (Work Queue)
CREATE TABLE agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_definition_id UUID REFERENCES agent_definitions(id),
    task_type TEXT NOT NULL CHECK (task_type IN (
        'build_query', 'import_csv', 'run_sequence_step', 'sync_outlook',
        'classify_response', 'enrich_contact', 'write_outreach'
    )),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'completed', 'failed', 'cancelled'
    )),
    input_data JSONB,
    output_data JSONB,
    agent_execution_id UUID REFERENCES agent_executions(id),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tasks_status_priority ON agent_tasks(status, priority DESC) WHERE status = 'pending';
CREATE INDEX idx_agent_tasks_scheduled ON agent_tasks(scheduled_at) WHERE status = 'pending' AND scheduled_at IS NOT NULL;

-- Execution Context
CREATE TABLE agent_execution_context (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
    context_type TEXT NOT NULL CHECK (context_type IN (
        'property', 'company', 'contact', 'extraction_list'
    )),
    context_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_context_execution ON agent_execution_context(agent_execution_id);
CREATE INDEX idx_agent_context_entity ON agent_execution_context(context_type, context_id);

-- =============================================================================
-- AGENT WORKFLOWS
-- =============================================================================

-- Workflows
CREATE TABLE agent_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'schedule', 'event')),
    trigger_config JSONB,  -- cron for schedule, event name for event
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Steps
CREATE TABLE agent_workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    step_type TEXT NOT NULL CHECK (step_type IN ('agent', 'wait_manual', 'condition', 'webhook')),
    agent_definition_id UUID REFERENCES agent_definitions(id),
    input_mapping JSONB,   -- map workflow context to agent input
    output_mapping JSONB,  -- map agent output to workflow context
    condition JSONB,       -- when to run this step
    timeout_seconds INTEGER,
    on_success TEXT DEFAULT 'next',  -- next | complete | goto:{step_order}
    on_failure TEXT DEFAULT 'abort', -- retry | skip | abort | goto:{step_order}
    max_retries INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workflow_id, step_order)
);

CREATE INDEX idx_workflow_steps_workflow ON agent_workflow_steps(workflow_id);

-- Workflow Runs
CREATE TABLE agent_workflow_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES agent_workflows(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
    )),
    current_step_order INTEGER,
    context JSONB DEFAULT '{}',  -- accumulated data from all steps
    trigger_source TEXT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_runs_status ON agent_workflow_runs(status);
CREATE INDEX idx_workflow_runs_workflow ON agent_workflow_runs(workflow_id);

-- Workflow Step Runs
CREATE TABLE agent_workflow_step_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_run_id UUID NOT NULL REFERENCES agent_workflow_runs(id) ON DELETE CASCADE,
    workflow_step_id UUID NOT NULL REFERENCES agent_workflow_steps(id) ON DELETE CASCADE,
    agent_execution_id UUID REFERENCES agent_executions(id),
    agent_task_id UUID REFERENCES agent_tasks(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'running', 'waiting', 'completed', 'failed', 'skipped'
    )),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_step_runs_run ON agent_workflow_step_runs(workflow_run_id);
CREATE INDEX idx_workflow_step_runs_status ON agent_workflow_step_runs(status);

-- =============================================================================
-- EMAIL SYNC TABLES (2 additional)
-- =============================================================================

-- Email Sync State
CREATE TABLE email_sync_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder TEXT NOT NULL CHECK (folder IN ('inbox', 'sent')),
    last_sync_at TIMESTAMPTZ,
    last_entry_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (folder)
);

-- Synced Emails (raw email storage)
CREATE TABLE synced_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    outlook_entry_id TEXT UNIQUE NOT NULL,
    outlook_conversation_id TEXT,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_email TEXT,
    from_name TEXT,
    to_emails TEXT[],
    cc_emails TEXT[],
    subject TEXT,
    body_text TEXT,
    body_html TEXT,
    received_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    is_read BOOLEAN DEFAULT FALSE,
    has_attachments BOOLEAN DEFAULT FALSE,
    matched_contact_id UUID REFERENCES contacts(id),
    matched_company_id UUID REFERENCES companies(id),
    linked_activity_id UUID REFERENCES activities(id),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synced_emails_conversation ON synced_emails(outlook_conversation_id);
CREATE INDEX idx_synced_emails_from ON synced_emails(from_email);
CREATE INDEX idx_synced_emails_contact ON synced_emails(matched_contact_id);

-- =============================================================================
-- OPTIONAL TABLES (2 additional)
-- =============================================================================

-- Settings (config KV store)
CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email Events (tracking opens/clicks)
CREATE TABLE email_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
    url TEXT,  -- for clicks
    ip_address INET,
    user_agent TEXT,
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_events_activity ON email_events(activity_id);
CREATE INDEX idx_email_events_type ON email_events(event_type);

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all tables with updated_at column
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_property_loans_updated_at BEFORE UPDATE ON property_loans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON email_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sequences_updated_at BEFORE UPDATE ON sequences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sequence_steps_updated_at BEFORE UPDATE ON sequence_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sequence_subscriptions_updated_at BEFORE UPDATE ON sequence_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_definitions_updated_at BEFORE UPDATE ON agent_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_tasks_updated_at BEFORE UPDATE ON agent_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_workflows_updated_at BEFORE UPDATE ON agent_workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_workflow_steps_updated_at BEFORE UPDATE ON agent_workflow_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_agent_workflow_runs_updated_at BEFORE UPDATE ON agent_workflow_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update company status_changed_at when status changes
CREATE OR REPLACE FUNCTION update_status_changed_at()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_changed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_companies_status_changed BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_status_changed_at();

CREATE TRIGGER update_contacts_status_changed BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_status_changed_at();

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE properties IS 'CRE assets sourced from CoStar';
COMMENT ON TABLE companies IS 'Owner organizations - leads in the sourcing pipeline';
COMMENT ON TABLE contacts IS 'People at companies who receive outreach';
COMMENT ON TABLE property_loans IS 'Loan data for distress-based sourcing plays';
COMMENT ON TABLE sourcing_strategies IS 'Predefined CoStar query strategies (distress, hold period, etc.)';
COMMENT ON TABLE extraction_lists IS 'Results of CoStar queries - batches of properties';
COMMENT ON TABLE sequences IS 'Automated drip campaigns for outreach';
COMMENT ON TABLE activities IS 'All touchpoints with contacts/companies';
COMMENT ON TABLE agent_definitions IS 'Registry of Claude Code agents';
COMMENT ON TABLE agent_executions IS 'Logs of agent runs with prompts and responses';
COMMENT ON TABLE agent_tasks IS 'Work queue for automated agent execution';
COMMENT ON TABLE agent_workflows IS 'Multi-step pipelines chaining agents together';
