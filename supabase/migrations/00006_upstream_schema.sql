-- Migration: Upstream Pipeline Schema
-- Adds tables and columns required for the Upstream sourcing engine pipeline
-- Phase 1 of RALPH.md specification

-- =============================================================================
-- NEW TABLES
-- =============================================================================

-- Tasks (call reminders, follow-ups, review tasks)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- 'call_reminder', 'follow_up', 'review_deal', 'call_prep'
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    due_time TIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'snoozed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_company ON tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id);

COMMENT ON TABLE tasks IS 'Work queue for call reminders, follow-ups, and review tasks';

-- Qualification Data (tracks pricing, motivation, decision maker for each deal)
CREATE TABLE IF NOT EXISTS qualification_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,

    -- Pricing (need 2 of 3 to qualify)
    asking_price NUMERIC,
    noi NUMERIC,
    cap_rate NUMERIC,
    price_per_sf NUMERIC,

    -- Motivation
    motivation TEXT,
    timeline TEXT,
    seller_priorities TEXT,

    -- Supporting docs
    has_operating_statements BOOLEAN DEFAULT FALSE,
    has_rent_roll BOOLEAN DEFAULT FALSE,

    -- Decision maker
    decision_maker_confirmed BOOLEAN DEFAULT FALSE,
    decision_maker_name TEXT,
    decision_maker_title TEXT,

    -- Status tracking
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'engaging', 'qualified', 'docs_received', 'ready_to_package'
    )),

    -- Email exchange tracking (for escalation logic)
    email_count INTEGER DEFAULT 0,
    last_response_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    qualified_at TIMESTAMPTZ,
    packaged_at TIMESTAMPTZ,

    -- Unique constraint: one qualification record per company/property pair
    UNIQUE(company_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_qualification_data_status ON qualification_data(status);
CREATE INDEX IF NOT EXISTS idx_qualification_data_company ON qualification_data(company_id);
CREATE INDEX IF NOT EXISTS idx_qualification_data_property ON qualification_data(property_id);

COMMENT ON TABLE qualification_data IS 'Tracks qualification progress for each company/property deal';

-- Email Template Variants (A/B testing for templates)
CREATE TABLE IF NOT EXISTS email_template_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES email_templates(id) ON DELETE CASCADE,
    variant_name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sends INTEGER DEFAULT 0,
    opens INTEGER DEFAULT 0,
    replies INTEGER DEFAULT 0,
    positive_replies INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_template_variants_template ON email_template_variants(template_id);
CREATE INDEX IF NOT EXISTS idx_email_template_variants_active ON email_template_variants(is_active) WHERE is_active = true;

COMMENT ON TABLE email_template_variants IS 'A/B test variants for email templates with performance tracking';

-- Email Exclusions (permanent exclusion list for bounces, hard passes)
CREATE TABLE IF NOT EXISTS email_exclusions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('bounce', 'hard_pass', 'spam_complaint', 'invalid')),
    bounce_type TEXT, -- 'hard', 'soft', 'block'
    source_email_id UUID, -- optional reference to synced_emails
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_exclusions_email ON email_exclusions(email);
CREATE INDEX IF NOT EXISTS idx_email_exclusions_reason ON email_exclusions(reason);

COMMENT ON TABLE email_exclusions IS 'Permanent email exclusion list - bounces, hard passes, complaints';

-- Deal Packages (packaged qualified deals for handoff)
CREATE TABLE IF NOT EXISTS deal_packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    qualification_data_id UUID REFERENCES qualification_data(id) ON DELETE SET NULL,

    -- Package content (JSON for flexibility)
    package_json JSONB NOT NULL,

    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'handed_off', 'rejected')),

    -- Source tracking
    extraction_list_id UUID REFERENCES extraction_lists(id),
    client_criteria_id UUID,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    handed_off_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_deal_packages_status ON deal_packages(status);
CREATE INDEX IF NOT EXISTS idx_deal_packages_company ON deal_packages(company_id);
CREATE INDEX IF NOT EXISTS idx_deal_packages_property ON deal_packages(property_id);

COMMENT ON TABLE deal_packages IS 'Packaged qualified deals ready for handoff to buyers';

-- Email Drafts (approval queue for agent-generated emails)
CREATE TABLE IF NOT EXISTS email_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

    -- Context
    in_reply_to_email_id UUID, -- Reference to synced_emails if this is a reply
    draft_type TEXT NOT NULL CHECK (draft_type IN (
        'cold_outreach', 'follow_up', 'qualification', 'scheduling', 'escalation'
    )),

    -- Approval flow
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'sent')),
    generated_by TEXT, -- agent name that generated this
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,

    -- If sent
    sent_at TIMESTAMPTZ,
    sent_activity_id UUID REFERENCES activities(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_contact ON email_drafts(contact_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_pending ON email_drafts(created_at) WHERE status = 'pending';

COMMENT ON TABLE email_drafts IS 'Approval queue for agent-generated email drafts';

-- =============================================================================
-- ALTER EXISTING TABLES
-- =============================================================================

-- Companies: add broker tracking and qualification status
ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_broker BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_contact TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'new';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lead_score NUMERIC;

COMMENT ON COLUMN companies.has_broker IS 'True if owner redirected to broker';
COMMENT ON COLUMN companies.broker_contact IS 'Broker email/contact info if has_broker is true';
COMMENT ON COLUMN companies.qualification_status IS 'Pipeline status: new, contacted, engaged, qualified, handed_off';
COMMENT ON COLUMN companies.lead_score IS 'Computed lead score based on signals';

-- Sequence Subscriptions: add tracking for drip campaign execution
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS last_response_classification TEXT;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS awaiting_approval BOOLEAN DEFAULT TRUE;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS last_email_at TIMESTAMPTZ;

COMMENT ON COLUMN sequence_subscriptions.emails_sent IS 'Count of emails sent in this sequence';
COMMENT ON COLUMN sequence_subscriptions.last_response_classification IS 'Classification of most recent response';
COMMENT ON COLUMN sequence_subscriptions.awaiting_approval IS 'True if next email needs manual approval';
COMMENT ON COLUMN sequence_subscriptions.last_email_at IS 'Timestamp of last email sent';

-- Synced Emails: add classification fields
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS extracted_pricing JSONB;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS needs_human_review BOOLEAN DEFAULT FALSE;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classified_at TIMESTAMPTZ;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classified_by TEXT; -- agent name

CREATE INDEX IF NOT EXISTS idx_synced_emails_classification ON synced_emails(classification);
CREATE INDEX IF NOT EXISTS idx_synced_emails_needs_review ON synced_emails(needs_human_review) WHERE needs_human_review = true;

COMMENT ON COLUMN synced_emails.classification IS 'Classification: interested, pricing_given, question, referral, broker_redirect, soft_pass, hard_pass, bounce';
COMMENT ON COLUMN synced_emails.classification_confidence IS 'Confidence score 0.0-1.0';
COMMENT ON COLUMN synced_emails.extracted_pricing IS 'Extracted pricing data: {asking_price, noi, cap_rate}';
COMMENT ON COLUMN synced_emails.needs_human_review IS 'Flag for low confidence classifications';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Updated_at triggers for new tables
CREATE TRIGGER update_qualification_data_updated_at BEFORE UPDATE ON qualification_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_deal_packages_updated_at BEFORE UPDATE ON deal_packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_email_drafts_updated_at BEFORE UPDATE ON email_drafts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- Approval Queue View: shows all pending items across the system
CREATE OR REPLACE VIEW approval_queue AS
SELECT
    'email_draft' AS item_type,
    ed.id AS item_id,
    ed.created_at,
    ed.to_email AS target,
    ed.subject AS summary,
    ed.draft_type AS context,
    ed.generated_by,
    c.name AS company_name,
    p.address AS property_address
FROM email_drafts ed
LEFT JOIN companies c ON ed.company_id = c.id
LEFT JOIN properties p ON ed.property_id = p.id
WHERE ed.status = 'pending'

UNION ALL

SELECT
    'classification_review' AS item_type,
    se.id AS item_id,
    se.created_at,
    se.from_email AS target,
    se.subject AS summary,
    se.classification AS context,
    se.classified_by AS generated_by,
    mc.name AS company_name,
    NULL AS property_address
FROM synced_emails se
LEFT JOIN companies mc ON se.matched_company_id = mc.id
WHERE se.needs_human_review = true

ORDER BY created_at ASC;

COMMENT ON VIEW approval_queue IS 'Combined view of all items awaiting human approval';

-- Qualification Pipeline View
CREATE OR REPLACE VIEW qualification_pipeline AS
SELECT
    qd.id,
    qd.status,
    c.name AS company_name,
    c.status AS company_status,
    p.address AS property_address,
    p.property_type,
    p.building_size_sqft,
    qd.asking_price,
    qd.noi,
    qd.cap_rate,
    qd.motivation,
    qd.timeline,
    qd.decision_maker_confirmed,
    qd.email_count,
    qd.last_response_at,
    qd.created_at,
    qd.qualified_at,
    -- Compute pricing completeness
    (CASE WHEN qd.asking_price IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN qd.noi IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN qd.cap_rate IS NOT NULL THEN 1 ELSE 0 END) AS pricing_fields_filled,
    -- Compute readiness
    CASE
        WHEN qd.status = 'qualified' THEN 'Ready to Package'
        WHEN (CASE WHEN qd.asking_price IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN qd.noi IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN qd.cap_rate IS NOT NULL THEN 1 ELSE 0 END) >= 2
             AND qd.motivation IS NOT NULL
             AND qd.decision_maker_confirmed THEN 'Ready to Qualify'
        WHEN qd.email_count >= 2 AND qd.last_response_at < NOW() - INTERVAL '5 days' THEN 'Stalled - Escalate'
        ELSE 'In Progress'
    END AS pipeline_status
FROM qualification_data qd
LEFT JOIN companies c ON qd.company_id = c.id
LEFT JOIN properties p ON qd.property_id = p.id
WHERE qd.status NOT IN ('ready_to_package')
ORDER BY qd.last_response_at DESC NULLS LAST;

COMMENT ON VIEW qualification_pipeline IS 'Pipeline view of deals in qualification process';

-- =============================================================================
-- RLS POLICIES (optional - enable if using Supabase auth)
-- =============================================================================

-- Enable RLS on new tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_template_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_drafts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for authenticated users
CREATE POLICY "Authenticated users can manage tasks"
    ON tasks FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage qualification_data"
    ON qualification_data FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage email_template_variants"
    ON email_template_variants FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage email_exclusions"
    ON email_exclusions FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage deal_packages"
    ON deal_packages FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage email_drafts"
    ON email_drafts FOR ALL USING (auth.role() = 'authenticated');
