-- Migration: Autonomous Reply Handling
-- Extends schema for fully autonomous email reply processing
-- Adds tracking for: scheduling state, document collection, buyer criteria gathering

-- =============================================================================
-- EXTEND SYNCED_EMAILS FOR AUTONOMOUS TRACKING
-- =============================================================================

-- Add columns for richer classification and state tracking
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS scheduling_state JSONB;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS thread_id TEXT;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS in_reply_to_id UUID REFERENCES synced_emails(id);

COMMENT ON COLUMN synced_emails.scheduling_state IS 'Tracks scheduling conversations: {status, offered_slots, selected_slot, calendar_event_id}';
COMMENT ON COLUMN synced_emails.thread_id IS 'Conversation thread ID for grouping related emails';

-- Add index for thread lookups
CREATE INDEX IF NOT EXISTS idx_synced_emails_thread ON synced_emails(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_synced_emails_matched_contact ON synced_emails(matched_contact_id) WHERE matched_contact_id IS NOT NULL;

-- =============================================================================
-- EXTEND QUALIFICATION_DATA FOR DOCUMENT TRACKING
-- =============================================================================

-- Add document tracking columns
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS rent_roll_status TEXT DEFAULT 'not_requested'
    CHECK (rent_roll_status IN ('not_requested', 'requested', 'promised', 'received', 'not_available'));
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS operating_statement_status TEXT DEFAULT 'not_requested'
    CHECK (operating_statement_status IN ('not_requested', 'requested', 'promised', 'received', 'not_available'));

-- Add follow-up tracking
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ;
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0;
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS ghosted_at TIMESTAMPTZ;

-- Add extracted document data
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS rent_roll_data JSONB;
ALTER TABLE qualification_data ADD COLUMN IF NOT EXISTS operating_statement_data JSONB;

COMMENT ON COLUMN qualification_data.rent_roll_status IS 'Document collection status for rent roll';
COMMENT ON COLUMN qualification_data.operating_statement_status IS 'Document collection status for T12/operating statement';
COMMENT ON COLUMN qualification_data.follow_up_count IS 'Number of follow-ups sent for pending documents';
COMMENT ON COLUMN qualification_data.ghosted_at IS 'When contact was marked as ghosted (no response after follow-ups)';

-- =============================================================================
-- BUYER CRITERIA TRACKING (for inbound buyer inquiries)
-- =============================================================================

CREATE TABLE IF NOT EXISTS buyer_criteria_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,

    -- Gathering status
    status TEXT DEFAULT 'gathering' CHECK (status IN ('gathering', 'complete', 'stale')),

    -- Collected criteria (built up over multiple emails)
    property_types TEXT[],
    markets TEXT[],
    submarkets TEXT[],
    size_min INTEGER,
    size_max INTEGER,
    price_min NUMERIC,
    price_max NUMERIC,
    deal_type TEXT CHECK (deal_type IN ('stabilized', 'value_add', 'development', 'any')),
    timeline TEXT,
    exchange_1031 BOOLEAN DEFAULT FALSE,
    other_notes TEXT,

    -- Tracking
    missing_fields TEXT[],
    search_id UUID REFERENCES searches(id),  -- Created when criteria complete

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    UNIQUE(contact_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_criteria_status ON buyer_criteria_tracking(status);
CREATE INDEX IF NOT EXISTS idx_buyer_criteria_contact ON buyer_criteria_tracking(contact_id);

COMMENT ON TABLE buyer_criteria_tracking IS 'Tracks multi-turn buyer criteria gathering from inbound inquiries';

-- Trigger for updated_at
CREATE TRIGGER update_buyer_criteria_tracking_updated_at BEFORE UPDATE ON buyer_criteria_tracking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- SCHEDULED CALLS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS scheduled_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    calendar_event_id TEXT,  -- Outlook entry ID

    -- Context
    phone TEXT,
    subject TEXT,
    notes TEXT,
    prep_url TEXT,  -- Link to call prep PDF

    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show', 'rescheduled')),
    outcome TEXT,  -- Notes from the call

    -- Source tracking
    source_email_id UUID REFERENCES synced_emails(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_scheduled_calls_status ON scheduled_calls(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_contact ON scheduled_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_calls_scheduled ON scheduled_calls(scheduled_at);

COMMENT ON TABLE scheduled_calls IS 'Tracks scheduled calls with prospects including calendar integration';

CREATE TRIGGER update_scheduled_calls_updated_at BEFORE UPDATE ON scheduled_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- EXTEND TASKS FOR AUTONOMOUS OPERATIONS
-- =============================================================================

-- Add task types for autonomous operations
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN (
    'call_reminder', 'follow_up', 'review_deal', 'call_prep',
    'doc_follow_up', 'nurture', 'research_owner', 'broker_decision',
    'schedule_call', 'ooo_follow_up', 'human_review'
));

-- Add source tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES synced_emails(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tasks.source_email_id IS 'The email that triggered this task creation';
COMMENT ON COLUMN tasks.auto_generated IS 'True if created by autonomous agent, false if manual';

-- =============================================================================
-- CLASSIFICATION EXPANSION
-- =============================================================================

-- Update the classification comment to reflect full set
COMMENT ON COLUMN synced_emails.classification IS 'Classification codes:
- hot_interested: Shows interest, wants to engage
- hot_schedule: Wants to schedule a call
- hot_confirm: Confirming a proposed meeting time
- hot_pricing: Provided pricing/deal info
- question: Asking about the deal
- info_request: Wants documents sent
- referral: Redirected to another person
- broker: Redirected to broker
- ooo: Out of office
- soft_pass: Not now, maybe later
- hard_pass: Do not contact
- wrong_contact: Stale/incorrect contact
- bounce: Delivery failure
- doc_promised: Said they will send documents
- doc_received: Sent documents/attachments
- buyer_inquiry: Wants to buy, not sell
- buyer_criteria_update: Adding to buy criteria
- general_update: General correspondence
- unclear: Cannot determine intent';

-- =============================================================================
-- DNC TABLE (if not exists from earlier migration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS dnc_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    reason TEXT NOT NULL CHECK (reason IN ('requested', 'hostile', 'legal', 'spam_complaint')),
    source TEXT,  -- 'email_response', 'manual', 'import'
    source_email_id UUID REFERENCES synced_emails(id),
    notes TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dnc_email ON dnc_entries(email);

COMMENT ON TABLE dnc_entries IS 'Do Not Contact list - permanent exclusion from all outreach';

-- =============================================================================
-- HELPFUL VIEWS
-- =============================================================================

-- Pending follow-ups view (for auto follow-up job)
CREATE OR REPLACE VIEW pending_doc_follow_ups AS
SELECT
    qd.id,
    qd.company_id,
    qd.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    co.name AS company_name,
    p.address AS property_address,
    qd.asking_price,
    qd.noi,
    qd.cap_rate,
    qd.rent_roll_status,
    qd.operating_statement_status,
    qd.last_response_at,
    qd.last_follow_up_at,
    qd.follow_up_count,
    CASE
        WHEN qd.rent_roll_status IN ('requested', 'promised') THEN 'rent_roll'
        ELSE NULL
    END AS pending_rent_roll,
    CASE
        WHEN qd.operating_statement_status IN ('requested', 'promised') THEN 'operating_statement'
        ELSE NULL
    END AS pending_op_statement
FROM qualification_data qd
JOIN companies co ON qd.company_id = co.id
JOIN contacts c ON c.company_id = co.id AND c.status = 'active'
LEFT JOIN properties p ON qd.property_id = p.id
WHERE qd.status IN ('new', 'engaging')
  AND qd.ghosted_at IS NULL
  AND (qd.rent_roll_status IN ('requested', 'promised')
       OR qd.operating_statement_status IN ('requested', 'promised'))
  AND (qd.last_follow_up_at IS NULL
       OR qd.last_follow_up_at < NOW() - INTERVAL '3 days')
  AND qd.follow_up_count < 3;

COMMENT ON VIEW pending_doc_follow_ups IS 'Contacts who promised docs but havent sent them - ready for follow-up';

-- Ghost detection view
CREATE OR REPLACE VIEW potential_ghosts AS
SELECT
    qd.id,
    qd.company_id,
    qd.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    co.name AS company_name,
    qd.last_response_at,
    qd.follow_up_count,
    qd.asking_price,
    qd.noi
FROM qualification_data qd
JOIN companies co ON qd.company_id = co.id
JOIN contacts c ON c.company_id = co.id AND c.status = 'active'
WHERE qd.status IN ('new', 'engaging')
  AND qd.ghosted_at IS NULL
  AND qd.last_response_at < NOW() - INTERVAL '10 days'
  AND qd.follow_up_count >= 2;

COMMENT ON VIEW potential_ghosts IS 'Contacts who stopped responding after 2+ follow-ups - candidates for ghost status';

-- Qualification readiness view
CREATE OR REPLACE VIEW qualification_readiness AS
SELECT
    qd.id,
    qd.company_id,
    qd.property_id,
    co.name AS company_name,
    p.address AS property_address,
    qd.asking_price,
    qd.noi,
    qd.cap_rate,
    qd.rent_roll_status,
    qd.operating_statement_status,
    qd.status,
    -- Count pricing fields (need 2 of 3)
    (CASE WHEN qd.asking_price IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN qd.noi IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN qd.cap_rate IS NOT NULL THEN 1 ELSE 0 END) AS pricing_count,
    -- Check if qualified
    CASE
        WHEN (CASE WHEN qd.asking_price IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN qd.noi IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN qd.cap_rate IS NOT NULL THEN 1 ELSE 0 END) >= 2
             AND qd.rent_roll_status = 'received'
             AND qd.operating_statement_status = 'received'
        THEN TRUE
        ELSE FALSE
    END AS is_qualified,
    -- What's missing
    ARRAY_REMOVE(ARRAY[
        CASE WHEN qd.asking_price IS NULL AND qd.noi IS NULL THEN 'pricing (need 2 of: price, NOI, cap)' END,
        CASE WHEN qd.rent_roll_status != 'received' THEN 'rent_roll' END,
        CASE WHEN qd.operating_statement_status != 'received' THEN 'operating_statement' END
    ], NULL) AS missing_items
FROM qualification_data qd
JOIN companies co ON qd.company_id = co.id
LEFT JOIN properties p ON qd.property_id = p.id
WHERE qd.status NOT IN ('ready_to_package')
  AND qd.ghosted_at IS NULL;

COMMENT ON VIEW qualification_readiness IS 'Shows qualification progress and what is still needed';

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE buyer_criteria_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage buyer_criteria_tracking"
    ON buyer_criteria_tracking FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage scheduled_calls"
    ON scheduled_calls FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage dnc_entries"
    ON dnc_entries FOR ALL USING (auth.role() = 'authenticated');
