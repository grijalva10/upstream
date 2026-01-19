-- Migration: Rename companies → leads
-- Renames the companies table to leads throughout the schema
-- Also renames property_companies → property_leads
-- Updates all FK columns: company_id → lead_id

-- =============================================================================
-- PART 1: DROP DEPENDENT VIEWS
-- =============================================================================

-- Drop all views that reference companies table
DROP VIEW IF EXISTS inbox_view CASCADE;
DROP VIEW IF EXISTS approval_queue CASCADE;
DROP VIEW IF EXISTS deal_pipeline CASCADE;
DROP VIEW IF EXISTS pending_doc_follow_ups CASCADE;
DROP VIEW IF EXISTS potential_ghosts CASCADE;
DROP VIEW IF EXISTS people_view CASCADE;
DROP VIEW IF EXISTS today_view CASCADE;
DROP VIEW IF EXISTS qualification_readiness CASCADE;

-- =============================================================================
-- PART 2: DROP DEPENDENT TRIGGERS
-- =============================================================================

DROP TRIGGER IF EXISTS update_companies_updated_at ON companies;
DROP TRIGGER IF EXISTS update_companies_status_changed ON companies;

-- =============================================================================
-- PART 3: DROP DEPENDENT INDEXES
-- =============================================================================

DROP INDEX IF EXISTS idx_companies_status;
DROP INDEX IF EXISTS idx_companies_costar_id;
DROP INDEX IF EXISTS idx_property_companies_company;
DROP INDEX IF EXISTS idx_activities_company;
DROP INDEX IF EXISTS idx_calls_company;
DROP INDEX IF EXISTS idx_tasks_company;

-- =============================================================================
-- PART 4: RENAME TABLES
-- =============================================================================

ALTER TABLE IF EXISTS companies RENAME TO leads;
ALTER TABLE IF EXISTS property_companies RENAME TO property_leads;

-- =============================================================================
-- PART 5: RENAME COLUMNS (FK references)
-- =============================================================================

-- contacts.company_id → lead_id
ALTER TABLE contacts RENAME COLUMN company_id TO lead_id;

-- property_leads.company_id → lead_id
ALTER TABLE property_leads RENAME COLUMN company_id TO lead_id;

-- activities.company_id → lead_id
ALTER TABLE activities RENAME COLUMN company_id TO lead_id;

-- synced_emails.matched_company_id → matched_lead_id
ALTER TABLE synced_emails RENAME COLUMN matched_company_id TO matched_lead_id;

-- deals.company_id → lead_id
ALTER TABLE deals RENAME COLUMN company_id TO lead_id;

-- calls.company_id → lead_id (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calls' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE calls RENAME COLUMN company_id TO lead_id;
    END IF;
END $$;

-- tasks.company_id → lead_id
ALTER TABLE tasks RENAME COLUMN company_id TO lead_id;

-- email_drafts.company_id → lead_id
ALTER TABLE email_drafts RENAME COLUMN company_id TO lead_id;

-- buyer_criteria_tracking.company_id → lead_id (if exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'buyer_criteria_tracking' AND column_name = 'company_id'
    ) THEN
        ALTER TABLE buyer_criteria_tracking RENAME COLUMN company_id TO lead_id;
    END IF;
END $$;

-- searches.total_companies → total_leads
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'searches' AND column_name = 'total_companies'
    ) THEN
        ALTER TABLE searches RENAME COLUMN total_companies TO total_leads;
    END IF;
END $$;

-- =============================================================================
-- PART 6: RENAME CONSTRAINTS
-- =============================================================================

-- Rename primary key constraint on leads
ALTER TABLE leads RENAME CONSTRAINT companies_pkey TO leads_pkey;

-- Rename unique constraint on costar_company_id
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'companies_costar_company_id_key'
    ) THEN
        ALTER TABLE leads RENAME CONSTRAINT companies_costar_company_id_key TO leads_costar_company_id_key;
    END IF;
END $$;

-- Rename primary key constraint on property_leads
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'property_companies_pkey'
    ) THEN
        ALTER TABLE property_leads RENAME CONSTRAINT property_companies_pkey TO property_leads_pkey;
    END IF;
END $$;

-- =============================================================================
-- PART 7: RECREATE INDEXES WITH NEW NAMES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_costar_id ON leads(costar_company_id);
CREATE INDEX IF NOT EXISTS idx_property_leads_lead ON property_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead ON tasks(lead_id);

-- Recreate calls index if the column exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calls' AND column_name = 'lead_id'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_calls_lead ON calls(lead_id) WHERE lead_id IS NOT NULL;
    END IF;
END $$;

-- =============================================================================
-- PART 8: RECREATE TRIGGERS
-- =============================================================================

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leads_status_changed BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_status_changed_at();

-- =============================================================================
-- PART 9: RENAME ENUM TYPE (if exists)
-- =============================================================================

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'company_type_enum') THEN
        ALTER TYPE company_type_enum RENAME TO lead_type_enum;
    END IF;
END $$;

-- =============================================================================
-- PART 10: UPDATE COMMENTS
-- =============================================================================

COMMENT ON TABLE leads IS 'Owner organizations - leads in the sourcing pipeline';
COMMENT ON TABLE property_leads IS 'Junction table linking properties to leads (owners/managers/lenders)';
COMMENT ON COLUMN contacts.lead_id IS 'The lead (organization) this contact belongs to';
COMMENT ON COLUMN activities.lead_id IS 'Lead associated with this activity';
COMMENT ON COLUMN synced_emails.matched_lead_id IS 'Lead matched to this email';
COMMENT ON COLUMN deals.lead_id IS 'Lead (seller organization) for this deal';
COMMENT ON COLUMN tasks.lead_id IS 'Lead this task relates to';
COMMENT ON COLUMN email_drafts.lead_id IS 'Lead this draft is for';

-- Update column comment if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calls' AND column_name = 'lead_id'
    ) THEN
        COMMENT ON COLUMN calls.lead_id IS 'Lead for this call';
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'leads' AND column_name = 'company_type'
    ) THEN
        COMMENT ON COLUMN leads.company_type IS 'Primary type: owner, buyer, broker, other';
    END IF;
END $$;

-- =============================================================================
-- PART 11: RECREATE VIEWS WITH UPDATED REFERENCES
-- =============================================================================

-- Inbox view (THE view for inbox UI)
CREATE OR REPLACE VIEW inbox_view AS
SELECT
    se.id,
    se.outlook_entry_id,
    se.outlook_conversation_id,
    se.direction,
    se.from_email,
    se.from_name,
    se.to_emails,
    se.subject,
    se.body_text,
    se.body_html,
    se.received_at,
    se.sent_at,
    se.is_read,
    se.has_attachments,

    -- Classification
    se.classification,
    se.classification_confidence,
    se.classification_reasoning,
    se.classified_at,
    se.classified_by,

    -- Review state
    se.status,
    se.needs_review,
    se.auto_handled,
    se.action_taken,
    se.action_taken_at,

    -- Extracted data
    se.extracted_pricing,
    se.scheduling_state,

    -- Threading
    se.thread_id,
    se.in_reply_to_id,

    -- Linked entities
    se.matched_contact_id,
    se.matched_lead_id,
    se.matched_property_id,
    se.enrollment_id,

    -- Contact info
    c.name AS contact_name,
    c.contact_type,
    c.title AS contact_title,
    c.phone AS contact_phone,

    -- Lead info
    l.name AS lead_name,
    l.status AS lead_status,

    -- Property info
    p.address AS property_address,
    p.property_name,
    p.property_type,

    -- Deal info (if exists)
    d.id AS deal_id,
    d.display_id AS deal_display_id,
    d.status AS deal_status,

    -- Draft info (if exists)
    ed.id AS draft_id,
    ed.subject AS draft_subject,
    ed.body AS draft_body,
    ed.status AS draft_status,

    -- Enrollment info
    e.campaign_id,
    e.current_step AS enrollment_step

FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN leads l ON se.matched_lead_id = l.id
LEFT JOIN properties p ON se.matched_property_id = p.id
LEFT JOIN deals d ON d.property_id = p.id AND d.lead_id = l.id
LEFT JOIN email_drafts ed ON ed.source_email_id = se.id AND ed.status = 'pending'
LEFT JOIN enrollments e ON se.enrollment_id = e.id
WHERE se.direction = 'inbound'
ORDER BY se.received_at DESC;

COMMENT ON VIEW inbox_view IS 'Main inbox view with all related entity data for UI';

-- Approval queue view (pending drafts + low confidence classifications)
CREATE OR REPLACE VIEW approval_queue AS
SELECT
    'email_draft' AS item_type,
    ed.id AS item_id,
    ed.created_at,
    ed.to_email AS target,
    ed.subject AS summary,
    ed.draft_type AS context,
    ed.generated_by,
    ed.body AS content,
    c.name AS contact_name,
    l.name AS lead_name,
    p.address AS property_address,
    NULL::float AS confidence
FROM email_drafts ed
LEFT JOIN contacts c ON ed.contact_id = c.id
LEFT JOIN leads l ON ed.lead_id = l.id
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
    se.body_text AS content,
    c.name AS contact_name,
    l.name AS lead_name,
    NULL AS property_address,
    se.classification_confidence AS confidence
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN leads l ON se.matched_lead_id = l.id
WHERE se.needs_review = true
  AND se.status = 'new'

ORDER BY created_at ASC;

COMMENT ON VIEW approval_queue IS 'Combined view of all items awaiting human approval';

-- Deal pipeline view
CREATE OR REPLACE VIEW deal_pipeline AS
SELECT
    d.id,
    d.display_id,
    d.status,
    d.property_id,
    d.lead_id,
    d.contact_id,

    -- Property info
    p.address AS property_address,
    p.property_name,
    p.property_type,
    p.building_size_sqft,

    -- Lead info
    l.name AS lead_name,
    l.status AS lead_status,

    -- Contact info
    c.name AS contact_name,
    c.email AS contact_email,
    c.phone AS contact_phone,

    -- Qualification data
    d.asking_price,
    d.noi,
    d.cap_rate,
    d.motivation,
    d.timeline,
    d.decision_maker_confirmed,
    d.rent_roll_status,
    d.operating_statement_status,

    -- Tracking
    d.email_count,
    d.follow_up_count,
    d.last_response_at,
    d.ghosted_at,

    -- Dates
    d.created_at,
    d.qualified_at,
    d.packaged_at,

    -- Computed fields
    (CASE WHEN d.asking_price IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN d.noi IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN d.cap_rate IS NOT NULL THEN 1 ELSE 0 END) AS pricing_fields_filled,

    CASE
        WHEN d.status = 'packaged' THEN 'Ready for Handoff'
        WHEN d.status = 'qualified' THEN 'Ready to Package'
        WHEN d.ghosted_at IS NOT NULL THEN 'Ghosted'
        WHEN (CASE WHEN d.asking_price IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN d.noi IS NOT NULL THEN 1 ELSE 0 END +
              CASE WHEN d.cap_rate IS NOT NULL THEN 1 ELSE 0 END) >= 2
             AND d.rent_roll_status = 'received'
             AND d.operating_statement_status = 'received'
        THEN 'Ready to Qualify'
        WHEN d.follow_up_count >= 2 AND d.last_response_at < NOW() - INTERVAL '5 days'
        THEN 'Stalled - Escalate'
        ELSE 'In Progress'
    END AS pipeline_status

FROM deals d
LEFT JOIN properties p ON d.property_id = p.id
LEFT JOIN leads l ON d.lead_id = l.id
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.status NOT IN ('handed_off', 'lost')
ORDER BY d.last_response_at DESC NULLS LAST;

COMMENT ON VIEW deal_pipeline IS 'Pipeline view of active deals with qualification progress';

-- Pending document follow-ups view
CREATE OR REPLACE VIEW pending_doc_follow_ups AS
SELECT
    d.id AS deal_id,
    d.display_id,
    d.lead_id,
    d.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    l.name AS lead_name,
    p.address AS property_address,
    d.asking_price,
    d.noi,
    d.cap_rate,
    d.rent_roll_status,
    d.operating_statement_status,
    d.last_response_at,
    d.last_follow_up_at,
    d.follow_up_count,
    CASE WHEN d.rent_roll_status IN ('requested', 'promised') THEN 'rent_roll' END AS pending_rent_roll,
    CASE WHEN d.operating_statement_status IN ('requested', 'promised') THEN 'operating_statement' END AS pending_op_statement
FROM deals d
JOIN leads l ON d.lead_id = l.id
JOIN contacts c ON d.contact_id = c.id OR c.lead_id = l.id
LEFT JOIN properties p ON d.property_id = p.id
WHERE d.status IN ('new', 'engaging')
  AND d.ghosted_at IS NULL
  AND c.status = 'active'
  AND (d.rent_roll_status IN ('requested', 'promised')
       OR d.operating_statement_status IN ('requested', 'promised'))
  AND (d.last_follow_up_at IS NULL OR d.last_follow_up_at < NOW() - INTERVAL '3 days')
  AND d.follow_up_count < 3;

COMMENT ON VIEW pending_doc_follow_ups IS 'Deals with pending document requests ready for follow-up';

-- Potential ghosts view
CREATE OR REPLACE VIEW potential_ghosts AS
SELECT
    d.id AS deal_id,
    d.display_id,
    d.lead_id,
    d.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    l.name AS lead_name,
    d.last_response_at,
    d.follow_up_count,
    d.asking_price,
    d.noi
FROM deals d
JOIN leads l ON d.lead_id = l.id
JOIN contacts c ON d.contact_id = c.id OR c.lead_id = l.id
WHERE d.status IN ('new', 'engaging')
  AND d.ghosted_at IS NULL
  AND c.status = 'active'
  AND d.last_response_at < NOW() - INTERVAL '10 days'
  AND d.follow_up_count >= 2;

COMMENT ON VIEW potential_ghosts IS 'Deals with contacts who stopped responding - candidates for ghost status';

-- People view (unified contact view with type filtering)
CREATE OR REPLACE VIEW people_view AS
SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.title,
    c.contact_type,
    c.is_buyer,
    c.is_seller,
    c.is_decision_maker,
    c.status,
    c.source,
    c.last_contacted_at,
    c.created_at,

    -- Lead info
    l.id AS lead_id,
    l.name AS lead_name,
    l.status AS lead_status,
    l.company_type AS lead_type,

    -- Buyer criteria (if buyer)
    bct.id AS buyer_criteria_id,
    bct.status AS buyer_criteria_status,
    bct.property_types AS buyer_property_types,
    bct.markets AS buyer_markets,
    bct.price_min AS buyer_price_min,
    bct.price_max AS buyer_price_max,

    -- Stats
    (SELECT COUNT(*) FROM deals d WHERE d.contact_id = c.id) AS deal_count,
    (SELECT COUNT(*) FROM synced_emails se WHERE se.matched_contact_id = c.id) AS email_count,
    (SELECT COUNT(*) FROM calls ca WHERE ca.contact_id = c.id) AS call_count

FROM contacts c
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN buyer_criteria_tracking bct ON bct.contact_id = c.id
ORDER BY c.last_contacted_at DESC NULLS LAST, c.created_at DESC;

COMMENT ON VIEW people_view IS 'Unified people view with all contact types and related data';

-- Today view (what needs attention)
CREATE OR REPLACE VIEW today_view AS
-- Pending approvals (drafts)
SELECT
    'draft' AS item_type,
    ed.id AS item_id,
    ed.created_at AS due_at,
    ed.subject AS title,
    'Email draft pending approval' AS description,
    c.name AS contact_name,
    l.name AS lead_name,
    NULL::uuid AS deal_id,
    1 AS priority
FROM email_drafts ed
LEFT JOIN contacts c ON ed.contact_id = c.id
LEFT JOIN leads l ON ed.lead_id = l.id
WHERE ed.status = 'pending'

UNION ALL

-- Low confidence classifications needing review
SELECT
    'review' AS item_type,
    se.id AS item_id,
    se.received_at AS due_at,
    se.subject AS title,
    'Low confidence classification needs review' AS description,
    c.name AS contact_name,
    l.name AS lead_name,
    NULL::uuid AS deal_id,
    2 AS priority
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN leads l ON se.matched_lead_id = l.id
WHERE se.needs_review = true AND se.status = 'new'

UNION ALL

-- Calls today
SELECT
    'call' AS item_type,
    ca.id AS item_id,
    ca.scheduled_at AS due_at,
    'Call with ' || COALESCE(c.name, 'Unknown') AS title,
    'Scheduled call' AS description,
    c.name AS contact_name,
    l.name AS lead_name,
    ca.deal_id,
    3 AS priority
FROM calls ca
LEFT JOIN contacts c ON ca.contact_id = c.id
LEFT JOIN deals d ON ca.deal_id = d.id
LEFT JOIN leads l ON d.lead_id = l.id
WHERE ca.status = 'scheduled'
  AND ca.scheduled_at::date = CURRENT_DATE

UNION ALL

-- Tasks due today
SELECT
    'task' AS item_type,
    t.id AS item_id,
    (t.due_date || ' ' || COALESCE(t.due_time::text, '09:00'))::timestamptz AS due_at,
    t.title,
    t.description,
    c.name AS contact_name,
    l.name AS lead_name,
    t.deal_id,
    4 AS priority
FROM tasks t
LEFT JOIN contacts c ON t.contact_id = c.id
LEFT JOIN leads l ON t.lead_id = l.id
WHERE t.status = 'pending'
  AND t.due_date <= CURRENT_DATE

UNION ALL

-- Hot leads (recent interested/pricing responses)
SELECT
    'hot_lead' AS item_type,
    se.id AS item_id,
    se.received_at AS due_at,
    se.subject AS title,
    'Hot lead: ' || se.classification AS description,
    c.name AS contact_name,
    l.name AS lead_name,
    d.id AS deal_id,
    5 AS priority
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN leads l ON se.matched_lead_id = l.id
LEFT JOIN deals d ON d.lead_id = l.id
WHERE se.classification IN ('hot_interested', 'hot_pricing', 'hot_schedule', 'hot_confirm')
  AND se.received_at > NOW() - INTERVAL '24 hours'
  AND se.status != 'actioned'

ORDER BY priority, due_at;

COMMENT ON VIEW today_view IS 'Everything that needs attention today - approvals, reviews, calls, tasks, hot leads';

-- =============================================================================
-- DONE
-- =============================================================================

-- Summary of changes:
-- 1. Renamed companies → leads
-- 2. Renamed property_companies → property_leads
-- 3. Renamed all company_id columns to lead_id
-- 4. Renamed synced_emails.matched_company_id to matched_lead_id
-- 5. Renamed searches.total_companies to total_leads
-- 6. Updated all indexes and constraints
-- 7. Updated all triggers
-- 8. Recreated all views with new column names
