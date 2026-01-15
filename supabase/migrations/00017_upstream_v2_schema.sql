-- Upstream V2 Schema Migration
-- Aligns database with upstream-v2-spec.md

-- ============================================================================
-- SEARCHES (rename from client_criteria concept)
-- ============================================================================

CREATE TABLE IF NOT EXISTS searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- 'lee-1031-x', 'manual', 'inbound'
  source_contact_id UUID REFERENCES contacts(id), -- if inbound (from reply)

  -- The buyer criteria JSON
  criteria_json JSONB NOT NULL,

  -- Agent-generated outputs
  strategy_summary TEXT,
  payloads_json JSONB, -- array of CoStar query payloads

  -- Results counts
  total_properties INT DEFAULT 0,
  total_companies INT DEFAULT 0,
  total_contacts INT DEFAULT 0,

  -- Status: pending_queries → extracting → ready → campaign_created
  status TEXT NOT NULL DEFAULT 'pending_queries',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction: which search found which property
CREATE TABLE IF NOT EXISTS search_properties (
  search_id UUID NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (search_id, property_id)
);

-- ============================================================================
-- CAMPAIGNS
-- ============================================================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id UUID NOT NULL REFERENCES searches(id),
  name TEXT NOT NULL,

  -- Status: draft → active → paused → completed
  status TEXT NOT NULL DEFAULT 'draft',

  -- Email templates with merge tags
  email_1_subject TEXT,
  email_1_body TEXT,
  email_2_subject TEXT,
  email_2_body TEXT,
  email_2_delay_days INT DEFAULT 3,
  email_3_subject TEXT,
  email_3_body TEXT,
  email_3_delay_days INT DEFAULT 4,

  -- Send settings
  send_window_start TIME DEFAULT '09:00',
  send_window_end TIME DEFAULT '17:00',
  timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Metrics (denormalized for quick display)
  total_enrolled INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_replied INT DEFAULT 0,
  total_stopped INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENROLLMENTS (one per property/contact combo in a campaign)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),

  -- Status: pending → active → replied → completed → stopped
  status TEXT NOT NULL DEFAULT 'pending',
  current_step INT DEFAULT 0, -- 0 = not started, 1-3 = which email

  -- Email tracking
  email_1_sent_at TIMESTAMPTZ,
  email_1_opened_at TIMESTAMPTZ,
  email_2_sent_at TIMESTAMPTZ,
  email_2_opened_at TIMESTAMPTZ,
  email_3_sent_at TIMESTAMPTZ,
  email_3_opened_at TIMESTAMPTZ,

  -- Reply handling
  replied_at TIMESTAMPTZ,
  reply_classification TEXT, -- interested, wants_offer, not_interested, etc.

  -- Stop tracking
  stopped_at TIMESTAMPTZ,
  stopped_reason TEXT, -- replied, dnc, bounce, manual

  -- Flags (computed at creation for warnings)
  flag_already_contacted_any BOOLEAN DEFAULT FALSE,
  flag_already_contacted_this BOOLEAN DEFAULT FALSE,
  flag_is_dnc BOOLEAN DEFAULT FALSE,
  flag_is_bounced BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate enrollments for same property/contact in same campaign
  UNIQUE (campaign_id, property_id, contact_id)
);

-- ============================================================================
-- INBOX MESSAGES (replies matched to enrollments)
-- ============================================================================

CREATE TABLE IF NOT EXISTS inbox_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Outlook sync info
  outlook_id TEXT UNIQUE,
  thread_id TEXT,

  -- Email content
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ NOT NULL,

  -- Matched to our data
  enrollment_id UUID REFERENCES enrollments(id),
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),

  -- Classification (auto-set by agent)
  classification TEXT, -- interested, wants_offer, wants_to_buy, schedule_call, question, not_interested, wrong_contact, broker_redirect, dnc, bounce, unclassified
  classification_confidence FLOAT,
  classification_reasoning TEXT,

  -- Review status
  status TEXT NOT NULL DEFAULT 'new', -- new, reviewed, actioned
  action_taken TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DEALS (seller opportunities being qualified)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT UNIQUE, -- DEAL-000001

  -- Related entities
  property_id UUID NOT NULL REFERENCES properties(id),
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  search_id UUID REFERENCES searches(id),
  enrollment_id UUID REFERENCES enrollments(id),

  -- Status: qualifying → qualified → packaged → handed_off → closed → lost
  status TEXT NOT NULL DEFAULT 'qualifying',

  -- Qualification fields
  asking_price NUMERIC,
  noi NUMERIC,
  cap_rate NUMERIC, -- computed or provided
  motivation TEXT, -- why selling
  timeline TEXT, -- when want to close
  decision_maker_confirmed BOOLEAN DEFAULT FALSE,
  price_realistic BOOLEAN, -- is price reasonable vs market

  -- Documents
  rent_roll_url TEXT,
  operating_statement_url TEXT,
  other_docs JSONB, -- array of {name, url}

  -- Loan info
  loan_amount NUMERIC,
  loan_maturity DATE,
  loan_rate NUMERIC,
  lender_name TEXT,

  -- Package fields (for lee-1031-x export)
  investment_summary TEXT, -- AI-generated narrative
  investment_highlights JSONB, -- AI-generated array of bullets
  admin_notes TEXT,

  -- Handoff tracking
  handed_off_to TEXT, -- 'brian' or 'lee-1031-x'
  handed_off_at TIMESTAMPTZ,
  lee_1031_x_deal_id TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate display_id automatically
CREATE OR REPLACE FUNCTION generate_deal_display_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.display_id IS NULL THEN
    NEW.display_id := 'DEAL-' || LPAD(
      (SELECT COALESCE(MAX(SUBSTRING(display_id FROM 6)::INT), 0) + 1 FROM deals)::TEXT,
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_deal_display_id
  BEFORE INSERT ON deals
  FOR EACH ROW
  EXECUTE FUNCTION generate_deal_display_id();

-- ============================================================================
-- CALLS (scheduled calls with prep)
-- ============================================================================

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,

  -- Status: scheduled → completed → no_show → rescheduled → cancelled
  status TEXT NOT NULL DEFAULT 'scheduled',

  -- Content
  call_prep_md TEXT, -- AI-generated prep doc
  notes_md TEXT, -- post-call notes (user pasted)
  outcome TEXT, -- qualified, needs_followup, not_interested, reschedule
  action_items JSONB, -- array of action items

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- DEAL ACTIVITY (timeline of everything)
-- ============================================================================

CREATE TABLE IF NOT EXISTS deal_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,

  -- Activity type
  activity_type TEXT NOT NULL, -- email_sent, email_received, call_scheduled, call_completed, doc_received, status_change, note_added, handed_off
  description TEXT,
  metadata JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- EXCLUSIONS (DNC, bounces, bad contacts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's excluded
  exclusion_type TEXT NOT NULL, -- email, domain, company, contact
  value TEXT NOT NULL, -- email address, domain, or ID

  -- Why
  reason TEXT NOT NULL, -- bounce, dnc, bad_contact, broker, manual
  source_message_id UUID REFERENCES inbox_messages(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (exclusion_type, value)
);

-- ============================================================================
-- UPDATE EXISTING TABLES
-- ============================================================================

-- Add buyer/seller flags to contacts
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS is_buyer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_decision_maker BOOLEAN;

-- Add buyer/seller flags to companies
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_buyer BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_seller BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_searches_status ON searches(status);
CREATE INDEX IF NOT EXISTS idx_searches_source ON searches(source);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_search ON campaigns(search_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_campaign ON enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_contact ON enrollments(contact_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_status ON inbox_messages(status);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_classification ON inbox_messages(classification);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_enrollment ON inbox_messages(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_property ON deals(property_id);
CREATE INDEX IF NOT EXISTS idx_calls_scheduled ON calls(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_exclusions_type_value ON exclusions(exclusion_type, value);

-- ============================================================================
-- RLS POLICIES (basic - all authenticated users can access)
-- ============================================================================

ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE exclusions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users
CREATE POLICY "Authenticated users can access searches" ON searches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access search_properties" ON search_properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access campaigns" ON campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access enrollments" ON enrollments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access inbox_messages" ON inbox_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access deals" ON deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access calls" ON calls FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access deal_activity" ON deal_activity FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can access exclusions" ON exclusions FOR ALL TO authenticated USING (true) WITH CHECK (true);
