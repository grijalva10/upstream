-- Schema Simplification Migration
--
-- This migration simplifies the lead/deal schema for AI-driven workflows.
-- See docs/plans/2025-01-20-schema-simplification-final.md for full documentation.
--
-- Key changes:
-- 1. leads: Add lead_type, closed_reason, new statuses (replied, waiting)
-- 2. leads: Remove is_buyer, is_seller, company_type, qualification_status
-- 3. deals: Simplify status, add lost_reason
-- 4. searches: Add status constraint
-- 5. tasks: Add in_progress status
-- 6. Create lead_actions VIEW for AI to query next actions

-- ============================================================================
-- DROP DEPENDENT VIEWS FIRST
-- ============================================================================

DROP VIEW IF EXISTS lead_actions CASCADE;
DROP VIEW IF EXISTS people_view CASCADE;
DROP VIEW IF EXISTS deal_pipeline CASCADE;
DROP VIEW IF EXISTS inbox_view CASCADE;
DROP VIEW IF EXISTS today_view CASCADE;
DROP VIEW IF EXISTS pending_doc_follow_ups CASCADE;

-- ============================================================================
-- LEADS TABLE
-- ============================================================================

-- Step 1: Drop OLD constraints first (before any data changes)
ALTER TABLE leads DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS companies_source_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_source_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_company_type_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_closed_reason_check;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_closed_requires_reason;

-- Step 2: Add new columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lead_type TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS closed_reason TEXT;

-- Step 3: Migrate lead_type from existing fields
UPDATE leads SET lead_type = CASE
  WHEN company_type = 'buyer' OR is_buyer = true THEN 'buyer'
  WHEN company_type = 'broker' THEN 'broker'
  WHEN is_buyer = true AND is_seller = true THEN 'buyer_seller'
  WHEN company_type IN ('lender', 'vendor') THEN 'other'
  ELSE 'seller'  -- default: we're sourcing deals from them
END
WHERE lead_type IS NULL;

-- Step 4: Migrate closed_reason and status (dnc, pass, rejected -> closed)
UPDATE leads SET closed_reason = 'dnc', status = 'closed' WHERE status = 'dnc';
UPDATE leads SET closed_reason = 'not_interested', status = 'closed' WHERE status = 'pass';
UPDATE leads SET closed_reason = 'not_interested', status = 'closed' WHERE status = 'rejected';

-- Step 5: Add new constraints
ALTER TABLE leads ADD CONSTRAINT leads_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,        -- identified, no outreach yet
    'contacted'::text,  -- email sent, waiting for reply
    'replied'::text,    -- got response, needs triage
    'engaged'::text,    -- two-way conversation active
    'waiting'::text,    -- ball in their court
    'qualified'::text,  -- has pricing + motivation + timeline
    'handed_off'::text, -- sent to Lee 1031 X
    'nurture'::text,    -- not now, revisit later (soft pass)
    'closed'::text      -- dead (see closed_reason)
  ]));

ALTER TABLE leads ADD CONSTRAINT leads_lead_type_check
  CHECK (lead_type = ANY (ARRAY[
    'seller'::text,       -- we want to GET a deal from them
    'buyer'::text,        -- we want to GIVE deals to them
    'buyer_seller'::text, -- bidirectional
    'broker'::text,       -- middleman, represents others
    'other'::text         -- vendor, lender, etc.
  ]));

ALTER TABLE leads ALTER COLUMN lead_type SET NOT NULL;

ALTER TABLE leads ADD CONSTRAINT leads_closed_reason_check
  CHECK (closed_reason IS NULL OR closed_reason = ANY (ARRAY[
    'dnc'::text,            -- requested no contact (compliance)
    'not_interested'::text, -- hard no, won't sell
    'has_broker'::text,     -- already listed / has representation
    'wrong_contact'::text,  -- not the owner / decision maker
    'bad_data'::text,       -- wrong email, defunct company
    'duplicate'::text       -- merged with another lead
  ]));

ALTER TABLE leads ADD CONSTRAINT leads_closed_requires_reason
  CHECK (status != 'closed' OR closed_reason IS NOT NULL);

ALTER TABLE leads ADD CONSTRAINT leads_source_check
  CHECK (source = ANY (ARRAY['costar'::text, 'manual'::text, 'referral'::text, 'inbound'::text]));

-- Step 6: Drop deprecated columns
ALTER TABLE leads DROP COLUMN IF EXISTS is_buyer;
ALTER TABLE leads DROP COLUMN IF EXISTS is_seller;
ALTER TABLE leads DROP COLUMN IF EXISTS company_type;
ALTER TABLE leads DROP COLUMN IF EXISTS qualification_status;

-- ============================================================================
-- DEALS TABLE
-- ============================================================================

-- Step 1: Drop old constraint
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;

-- Step 2: Add lost_reason column
ALTER TABLE deals ADD COLUMN IF NOT EXISTS lost_reason TEXT;

-- Step 3: Migrate status values
UPDATE deals SET status = 'gathering' WHERE status IN ('engaging', 'qualifying');
UPDATE deals SET status = 'packaging' WHERE status = 'docs_received';

-- Step 4: Add new status constraint
ALTER TABLE deals ADD CONSTRAINT deals_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,        -- deal created from hot lead
    'gathering'::text,  -- collecting pricing, motivation, docs
    'qualified'::text,  -- has price + motivation + timeline
    'packaging'::text,  -- creating deal package
    'handed_off'::text, -- sent to Lee 1031 X
    'lost'::text        -- dead (see lost_reason)
  ]));

-- Step 5: Add lost_reason constraint
ALTER TABLE deals ADD CONSTRAINT deals_lost_reason_check
  CHECK (lost_reason IS NULL OR lost_reason = ANY (ARRAY[
    'not_interested'::text,   -- changed mind
    'price_unrealistic'::text, -- couldn't agree on price
    'timing'::text,           -- not ready yet
    'went_with_broker'::text, -- listed with someone else
    'ghosted'::text,          -- stopped responding
    'other'::text
  ]));

ALTER TABLE deals ADD CONSTRAINT deals_lost_requires_reason
  CHECK (status != 'lost' OR lost_reason IS NOT NULL);

-- ============================================================================
-- SEARCHES TABLE
-- ============================================================================

-- Drop old constraint if exists
ALTER TABLE searches DROP CONSTRAINT IF EXISTS searches_status_check;

-- Migrate existing values first
UPDATE searches SET status = 'queries_ready' WHERE status = 'pending_extraction';
UPDATE searches SET status = 'queries_ready' WHERE status = 'pending_queries';
UPDATE searches SET status = 'complete' WHERE status = 'campaign_created';

-- Add status constraint
ALTER TABLE searches ADD CONSTRAINT searches_status_check
  CHECK (status = ANY (ARRAY[
    'new'::text,              -- just created, no payloads
    'queries_ready'::text,    -- sourcing agent generated payloads
    'extracting'::text,       -- CoStar extraction running
    'extracted'::text,        -- properties loaded, ready for campaign
    'campaign_active'::text,  -- outreach in progress
    'complete'::text          -- campaign finished
  ]));

-- ============================================================================
-- TASKS TABLE
-- ============================================================================

-- Drop old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Add new constraint with in_progress
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'in_progress'::text,
    'completed'::text,
    'snoozed'::text,
    'cancelled'::text
  ]));

-- ============================================================================
-- RECREATE VIEWS
-- ============================================================================

-- lead_actions VIEW (AI queries this for next action)
CREATE VIEW lead_actions AS
SELECT
  l.id,
  l.name,
  l.status,
  l.lead_type,
  l.source,
  l.closed_reason,
  l.notes,
  l.created_at,
  l.updated_at,
  CASE
    -- New leads need campaign enrollment
    WHEN l.status = 'new' THEN 'enroll_campaign'

    -- Replied leads need triage
    WHEN l.status = 'replied' THEN 'triage_reply'

    -- Engaged leads with pending drafts need review
    WHEN l.status = 'engaged' AND EXISTS (
      SELECT 1 FROM email_drafts ed
      WHERE ed.lead_id = l.id AND ed.status = 'pending'
    ) THEN 'review_draft'

    -- Engaged leads with pending tasks
    WHEN l.status = 'engaged' AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.lead_id = l.id AND t.status = 'pending'
    ) THEN 'complete_task'

    -- Qualified leads need packaging
    WHEN l.status = 'qualified' THEN 'package_deal'

    -- Waiting leads silent for 7+ days need follow-up
    WHEN l.status = 'waiting' AND l.updated_at < NOW() - INTERVAL '7 days' THEN 'follow_up'

    -- Nurture leads due for re-engagement (check tasks)
    WHEN l.status = 'nurture' AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.lead_id = l.id AND t.status = 'pending' AND t.due_date <= CURRENT_DATE
    ) THEN 'nurture_outreach'

    -- No action needed
    ELSE NULL
  END AS next_action,

  -- Count of pending tasks for this lead
  (SELECT COUNT(*) FROM tasks t WHERE t.lead_id = l.id AND t.status = 'pending') AS pending_tasks,

  -- Count of pending drafts for this lead
  (SELECT COUNT(*) FROM email_drafts ed WHERE ed.lead_id = l.id AND ed.status = 'pending') AS pending_drafts,

  -- Most recent activity
  (SELECT MAX(activity_at) FROM activities a WHERE a.lead_id = l.id) AS last_activity_at

FROM leads l;

GRANT SELECT ON lead_actions TO authenticated;

-- Recreate people_view without company_type
CREATE VIEW people_view AS
SELECT
  c.id,
  c.name,
  c.title,
  c.email,
  c.phone,
  c.status,
  c.is_decision_maker,
  c.source,
  c.created_at,
  c.updated_at,
  c.lead_id,
  l.name AS lead_name,
  l.status AS lead_status,
  l.lead_type,
  (SELECT COUNT(*) FROM activities a WHERE a.contact_id = c.id) AS activity_count,
  (SELECT MAX(activity_at) FROM activities a WHERE a.contact_id = c.id) AS last_activity_at,
  (SELECT status FROM buyer_criteria_tracking bct WHERE bct.contact_id = c.id LIMIT 1) AS buyer_criteria_status
FROM contacts c
LEFT JOIN leads l ON l.id = c.lead_id;

GRANT SELECT ON people_view TO authenticated;

-- Recreate inbox_view without company_type
CREATE VIEW inbox_view AS
SELECT
  se.id,
  se.message_id,
  se.subject,
  se.from_address,
  se.from_name,
  se.received_at,
  se.body_preview,
  se.status,
  se.classification,
  se.confidence,
  se.needs_review,
  se.auto_handled,
  se.is_read,
  se.has_attachments,
  c.id AS contact_id,
  c.name AS contact_name,
  c.status AS contact_status,
  l.id AS lead_id,
  l.name AS lead_name,
  l.status AS lead_status,
  l.lead_type,
  p.id AS property_id,
  p.address AS property_address,
  p.property_type,
  d.id AS deal_id,
  d.status AS deal_status,
  ed.id AS draft_id,
  ed.status AS draft_status
FROM synced_emails se
LEFT JOIN contacts c ON c.id = se.matched_contact_id
LEFT JOIN leads l ON l.id = se.matched_lead_id
LEFT JOIN properties p ON p.id = se.matched_property_id
LEFT JOIN deals d ON d.id = se.matched_deal_id
LEFT JOIN email_drafts ed ON ed.source_email_id = se.id AND ed.status = 'pending';

GRANT SELECT ON inbox_view TO authenticated;

-- Recreate deal_pipeline view
CREATE VIEW deal_pipeline AS
SELECT
  d.id,
  d.display_id,
  d.status,
  d.asking_price,
  d.noi,
  d.cap_rate,
  d.motivation,
  d.timeline,
  d.decision_maker_confirmed,
  d.rent_roll_status,
  d.operating_statement_status,
  d.created_at,
  d.updated_at,
  l.id AS lead_id,
  l.name AS lead_name,
  l.status AS lead_status,
  l.lead_type,
  c.id AS contact_id,
  c.name AS contact_name,
  c.email AS contact_email,
  p.id AS property_id,
  p.address AS property_address,
  p.property_type,
  p.building_size_sqft
FROM deals d
LEFT JOIN leads l ON l.id = d.lead_id
LEFT JOIN contacts c ON c.id = d.contact_id
LEFT JOIN properties p ON p.id = d.property_id;

GRANT SELECT ON deal_pipeline TO authenticated;

-- ============================================================================
-- INDEXES for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_lead_type ON leads(lead_type);
CREATE INDEX IF NOT EXISTS idx_leads_closed_reason ON leads(closed_reason) WHERE closed_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_deals_lost_reason ON deals(lost_reason) WHERE lost_reason IS NOT NULL;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================

COMMENT ON COLUMN leads.status IS 'Pipeline status: new→contacted→replied→engaged→waiting→qualified→handed_off | nurture | closed';
COMMENT ON COLUMN leads.lead_type IS 'Relationship type: seller (get deals from), buyer (give deals to), buyer_seller, broker, other';
COMMENT ON COLUMN leads.closed_reason IS 'Why closed: dnc, not_interested, has_broker, wrong_contact, bad_data, duplicate';

COMMENT ON COLUMN deals.status IS 'Deal status: new→gathering→qualified→packaging→handed_off | lost';
COMMENT ON COLUMN deals.lost_reason IS 'Why lost: not_interested, price_unrealistic, timing, went_with_broker, ghosted, other';

COMMENT ON VIEW lead_actions IS 'AI query interface - returns leads with computed next_action field';
