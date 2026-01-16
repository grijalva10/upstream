-- Migration: Consolidated Data Model
-- Eliminates duplicate tables and establishes single sources of truth
-- SAFE: Renames deprecated tables instead of dropping (no data loss)

-- =============================================================================
-- PART 1: CREATE ENUM TYPES
-- =============================================================================

-- Contact type enum
DO $$ BEGIN
    CREATE TYPE contact_type_enum AS ENUM (
        'seller',   -- Property owner we're sourcing from
        'buyer',    -- Investor looking to buy
        'broker',   -- Broker/agent relationship
        'team',     -- Internal team member (Brian, etc.)
        'other'     -- Catch-all
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Company type enum
DO $$ BEGIN
    CREATE TYPE company_type_enum AS ENUM (
        'owner',    -- Property owner organization
        'buyer',    -- Buyer/investor organization
        'broker',   -- Brokerage firm
        'other'     -- Catch-all
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Email classification enum (THE canonical list)
DO $$ BEGIN
    CREATE TYPE email_classification_enum AS ENUM (
        -- HOT (seller interested)
        'hot_interested',      -- Shows interest, wants to engage
        'hot_pricing',         -- Provided pricing/deal info
        'hot_schedule',        -- Wants to schedule a call
        'hot_confirm',         -- Confirming a proposed meeting time

        -- QUALIFICATION (info exchange)
        'question',            -- Asking about the deal
        'info_request',        -- Wants documents sent
        'doc_promised',        -- Said they will send documents
        'doc_received',        -- Sent documents/attachments

        -- BUYER (inbound interest)
        'buyer_inquiry',       -- Wants to buy, not sell
        'buyer_criteria_update', -- Adding to buy criteria

        -- REDIRECT (not the right person)
        'referral',            -- Redirected to another person
        'broker',              -- Redirected to broker
        'wrong_contact',       -- Stale/incorrect contact
        'ooo',                 -- Out of office

        -- CLOSED (end of conversation)
        'soft_pass',           -- Not now, maybe later
        'hard_pass',           -- Do not contact ever
        'bounce',              -- Delivery failure

        -- OTHER
        'general_update',      -- General correspondence
        'unclear'              -- Cannot determine intent
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Email status enum
DO $$ BEGIN
    CREATE TYPE email_status_enum AS ENUM (
        'new',       -- Just synced, not yet processed
        'reviewed',  -- Human has seen it
        'actioned'   -- Action has been taken
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- PART 2: EXTEND CONTACTS TABLE
-- =============================================================================

-- Add contact_type column
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS contact_type TEXT DEFAULT 'seller';

-- Add source column if not exists
ALTER TABLE contacts
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'costar';

COMMENT ON COLUMN contacts.contact_type IS 'Primary type: seller, buyer, broker, team, other';
COMMENT ON COLUMN contacts.source IS 'How contact was added: costar, manual, referral, inbound';

-- Backfill contact_type from existing is_buyer/is_seller flags
UPDATE contacts SET contact_type = 'buyer' WHERE is_buyer = true AND contact_type = 'seller';
UPDATE contacts SET contact_type = 'broker' WHERE title ILIKE '%broker%' AND contact_type = 'seller';

-- =============================================================================
-- PART 3: EXTEND COMPANIES TABLE
-- =============================================================================

-- Add company_type column (handle existing integer column by dropping and recreating)
DO $$
BEGIN
    -- Check if column exists and is wrong type (integer instead of text)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies'
          AND column_name = 'company_type'
          AND data_type = 'integer'
    ) THEN
        ALTER TABLE companies DROP COLUMN company_type;
    END IF;
END $$;

ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS company_type TEXT DEFAULT 'owner';

COMMENT ON COLUMN companies.company_type IS 'Primary type: owner, buyer, broker, other';

-- Backfill company_type from existing is_buyer/is_seller flags
UPDATE companies SET company_type = 'buyer' WHERE is_buyer = true AND company_type = 'owner';

-- =============================================================================
-- PART 4: EXTEND SYNCED_EMAILS TABLE (Consolidate from inbox_messages)
-- =============================================================================

-- Add columns that exist in inbox_messages but not synced_emails
ALTER TABLE synced_emails
    ADD COLUMN IF NOT EXISTS matched_property_id UUID REFERENCES properties(id),
    ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id),
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_handled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS action_taken TEXT,
    ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS classification_reasoning TEXT;

-- Add constraint for status
ALTER TABLE synced_emails DROP CONSTRAINT IF EXISTS synced_emails_status_check;
ALTER TABLE synced_emails ADD CONSTRAINT synced_emails_status_check
    CHECK (status IN ('new', 'reviewed', 'actioned'));

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_synced_emails_status ON synced_emails(status);
CREATE INDEX IF NOT EXISTS idx_synced_emails_needs_review ON synced_emails(needs_review) WHERE needs_review = true;
CREATE INDEX IF NOT EXISTS idx_synced_emails_auto_handled ON synced_emails(auto_handled) WHERE auto_handled = true;
CREATE INDEX IF NOT EXISTS idx_synced_emails_property ON synced_emails(matched_property_id) WHERE matched_property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_synced_emails_enrollment ON synced_emails(enrollment_id) WHERE enrollment_id IS NOT NULL;

COMMENT ON COLUMN synced_emails.matched_property_id IS 'Property this email relates to';
COMMENT ON COLUMN synced_emails.enrollment_id IS 'Campaign enrollment if from outbound sequence';
COMMENT ON COLUMN synced_emails.status IS 'Review status: new, reviewed, actioned';
COMMENT ON COLUMN synced_emails.needs_review IS 'True if low confidence or unknown contact';
COMMENT ON COLUMN synced_emails.auto_handled IS 'True if AI took autonomous action';
COMMENT ON COLUMN synced_emails.action_taken IS 'Description of what action was taken';
COMMENT ON COLUMN synced_emails.action_taken_at IS 'When the action was taken';

-- =============================================================================
-- PART 5: EXTEND DEALS TABLE (Consolidate from qualification_data)
-- =============================================================================

-- Add qualification fields from qualification_data
ALTER TABLE deals
    ADD COLUMN IF NOT EXISTS price_per_sf NUMERIC,
    ADD COLUMN IF NOT EXISTS seller_priorities TEXT,
    ADD COLUMN IF NOT EXISTS rent_roll_status TEXT DEFAULT 'not_requested',
    ADD COLUMN IF NOT EXISTS operating_statement_status TEXT DEFAULT 'not_requested',
    ADD COLUMN IF NOT EXISTS rent_roll_data JSONB,
    ADD COLUMN IF NOT EXISTS operating_statement_data JSONB,
    ADD COLUMN IF NOT EXISTS last_response_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS follow_up_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ghosted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_follow_up_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS email_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS packaged_at TIMESTAMPTZ;

-- Add constraints for document status
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_rent_roll_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_rent_roll_status_check
    CHECK (rent_roll_status IN ('not_requested', 'requested', 'promised', 'received', 'not_available'));

ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_operating_statement_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_operating_statement_status_check
    CHECK (operating_statement_status IN ('not_requested', 'requested', 'promised', 'received', 'not_available'));

-- Update deals status constraint to match our consolidated statuses
ALTER TABLE deals DROP CONSTRAINT IF EXISTS deals_status_check;
ALTER TABLE deals ADD CONSTRAINT deals_status_check
    CHECK (status IN ('new', 'engaging', 'qualified', 'docs_received', 'packaged', 'handed_off', 'lost', 'qualifying'));

COMMENT ON COLUMN deals.rent_roll_status IS 'Document collection status for rent roll';
COMMENT ON COLUMN deals.operating_statement_status IS 'Document collection status for T12/operating statement';
COMMENT ON COLUMN deals.follow_up_count IS 'Number of follow-ups sent';
COMMENT ON COLUMN deals.ghosted_at IS 'When contact was marked as ghosted';

-- =============================================================================
-- PART 6: EXTEND CALLS TABLE (Consolidate from scheduled_calls)
-- =============================================================================

-- Add columns from scheduled_calls that don't exist in calls
ALTER TABLE calls
    ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
    ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id),
    ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS prep_url TEXT,
    ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES synced_emails(id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calls_company ON calls(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_property ON calls(property_id) WHERE property_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_calls_source_email ON calls(source_email_id) WHERE source_email_id IS NOT NULL;

COMMENT ON COLUMN calls.company_id IS 'Company for this call';
COMMENT ON COLUMN calls.property_id IS 'Property being discussed';
COMMENT ON COLUMN calls.calendar_event_id IS 'Outlook calendar entry ID';
COMMENT ON COLUMN calls.phone IS 'Phone number to call';
COMMENT ON COLUMN calls.source_email_id IS 'Email that triggered this call scheduling';

-- =============================================================================
-- PART 7: EXTEND TASKS TABLE
-- =============================================================================

-- Add deal_id to tasks
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS deal_id UUID REFERENCES deals(id);

CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id) WHERE deal_id IS NOT NULL;

COMMENT ON COLUMN tasks.deal_id IS 'Deal this task relates to';

-- =============================================================================
-- PART 8: EXTEND EMAIL_DRAFTS TABLE
-- =============================================================================

-- Ensure source_email_id exists and has proper reference
ALTER TABLE email_drafts
    ADD COLUMN IF NOT EXISTS source_email_id UUID REFERENCES synced_emails(id);

CREATE INDEX IF NOT EXISTS idx_email_drafts_source_email ON email_drafts(source_email_id) WHERE source_email_id IS NOT NULL;

COMMENT ON COLUMN email_drafts.source_email_id IS 'The inbound email this draft is replying to';

-- =============================================================================
-- PART 9: MIGRATE DATA FROM DEPRECATED TABLES
-- =============================================================================

-- Migrate inbox_messages → synced_emails (only if inbox_messages table still exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inbox_messages' AND table_schema = 'public') THEN
        INSERT INTO synced_emails (
            id,
            outlook_entry_id,
            outlook_conversation_id,
            direction,
            from_email,
            from_name,
            to_emails,
            subject,
            body_text,
            body_html,
            received_at,
            matched_contact_id,
            matched_property_id,
            enrollment_id,
            classification,
            classification_confidence,
            classification_reasoning,
            status,
            created_at
        )
        SELECT
            im.id,
            COALESCE(im.outlook_id, 'migrated_' || im.id::text),
            im.thread_id,
            'inbound',
            im.from_email,
            im.from_name,
            ARRAY[im.to_email],
            im.subject,
            im.body_text,
            im.body_html,
            im.received_at,
            im.contact_id,
            im.property_id,
            im.enrollment_id,
            im.classification,
            im.classification_confidence,
            im.classification_reasoning,
            COALESCE(im.status, 'new'),
            im.created_at
        FROM inbox_messages im
        WHERE NOT EXISTS (
            SELECT 1 FROM synced_emails se
            WHERE se.outlook_entry_id = im.outlook_id
               OR se.id = im.id
        )
        ON CONFLICT (outlook_entry_id) DO NOTHING;
    END IF;
END $$;

-- Migrate qualification_data → deals (only if qualification_data table still exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qualification_data' AND table_schema = 'public') THEN
        INSERT INTO deals (
            property_id,
            company_id,
            status,
            asking_price,
            noi,
            cap_rate,
            price_per_sf,
            motivation,
            timeline,
            decision_maker_confirmed,
            rent_roll_status,
            operating_statement_status,
            rent_roll_data,
            operating_statement_data,
            last_response_at,
            follow_up_count,
            ghosted_at,
            last_follow_up_at,
            email_count,
            qualified_at,
            created_at,
            updated_at
        )
        SELECT
            qd.property_id,
            qd.company_id,
            CASE
                WHEN qd.status = 'ready_to_package' THEN 'packaged'
                WHEN qd.status = 'docs_received' THEN 'docs_received'
                WHEN qd.status = 'qualified' THEN 'qualified'
                WHEN qd.status = 'engaging' THEN 'engaging'
                ELSE 'new'
            END,
            qd.asking_price,
            qd.noi,
            qd.cap_rate,
            qd.price_per_sf,
            qd.motivation,
            qd.timeline,
            qd.decision_maker_confirmed,
            COALESCE(qd.rent_roll_status, 'not_requested'),
            COALESCE(qd.operating_statement_status, 'not_requested'),
            qd.rent_roll_data,
            qd.operating_statement_data,
            qd.last_response_at,
            COALESCE(qd.follow_up_count, 0),
            qd.ghosted_at,
            qd.last_follow_up_at,
            COALESCE(qd.email_count, 0),
            qd.qualified_at,
            qd.created_at,
            qd.updated_at
        FROM qualification_data qd
        WHERE NOT EXISTS (
            SELECT 1 FROM deals d
            WHERE d.property_id = qd.property_id
              AND d.company_id = qd.company_id
        )
        AND qd.property_id IS NOT NULL;
    END IF;
END $$;

-- Migrate scheduled_calls → calls (only if scheduled_calls table still exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scheduled_calls' AND table_schema = 'public') THEN
        INSERT INTO calls (
            contact_id,
            company_id,
            property_id,
            scheduled_at,
            duration_minutes,
            calendar_event_id,
            phone,
            notes_md,
            prep_url,
            status,
            source_email_id,
            created_at,
            updated_at
        )
        SELECT
            sc.contact_id,
            sc.company_id,
            sc.property_id,
            sc.scheduled_at,
            COALESCE(sc.duration_minutes, 30),
            sc.calendar_event_id,
            sc.phone,
            sc.notes,
            sc.prep_url,
            COALESCE(sc.status, 'scheduled'),
            sc.source_email_id,
            sc.created_at,
            sc.updated_at
        FROM scheduled_calls sc
        WHERE NOT EXISTS (
            SELECT 1 FROM calls c
            WHERE c.contact_id = sc.contact_id
              AND c.scheduled_at = sc.scheduled_at
        );
    END IF;
END $$;

-- Migrate clients → contacts (as buyers) - only if clients table still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clients' AND table_schema = 'public') THEN
        INSERT INTO contacts (
            name,
            email,
            phone,
            contact_type,
            source,
            status,
            created_at,
            updated_at
        )
        SELECT
            cl.name,
            cl.email,
            cl.phone,
            'buyer',
            'manual',
            CASE WHEN cl.status = 'active' THEN 'active' ELSE 'active' END,
            cl.created_at,
            cl.updated_at
        FROM clients cl
        WHERE cl.email IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM contacts c WHERE c.email = cl.email
        )
        ON CONFLICT (email) DO UPDATE SET
            contact_type = 'buyer',
            is_buyer = true;

        -- Update is_buyer flag for migrated clients
        UPDATE contacts SET is_buyer = true
        WHERE email IN (SELECT email FROM clients WHERE email IS NOT NULL);
    END IF;
END $$;

-- Migrate client_criteria → searches - only if client_criteria table still exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'client_criteria' AND table_schema = 'public') THEN
        INSERT INTO searches (
            name,
            source,
            criteria_json,
            payloads_json,
            strategy_summary,
            status,
            total_properties,
            total_contacts,
            created_at,
            updated_at
        )
        SELECT
            cc.name,
            'manual',
            cc.criteria_json,
            cc.queries_json,
            cc.strategy_summary,
            CASE
                WHEN cc.status = 'active' THEN 'ready'
                WHEN cc.status = 'draft' THEN 'pending_queries'
                ELSE 'pending_queries'
            END,
            COALESCE(cc.total_properties, 0),
            COALESCE(cc.total_contacts, 0),
            cc.created_at,
            cc.updated_at
        FROM client_criteria cc
        WHERE NOT EXISTS (
            SELECT 1 FROM searches s
            WHERE s.name = cc.name
              AND s.criteria_json = cc.criteria_json
        );
    END IF;
END $$;

-- =============================================================================
-- PART 10: RENAME DEPRECATED TABLES (NOT DROP - preserves data)
-- =============================================================================

-- Rename deprecated tables so they're not used but data is preserved
ALTER TABLE IF EXISTS inbox_messages RENAME TO _deprecated_inbox_messages;
ALTER TABLE IF EXISTS scheduled_calls RENAME TO _deprecated_scheduled_calls;
ALTER TABLE IF EXISTS qualification_data RENAME TO _deprecated_qualification_data;
ALTER TABLE IF EXISTS clients RENAME TO _deprecated_clients;
ALTER TABLE IF EXISTS client_criteria RENAME TO _deprecated_client_criteria;

-- Add comments explaining deprecation (only if tables exist)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_deprecated_inbox_messages' AND table_schema = 'public') THEN
        COMMENT ON TABLE _deprecated_inbox_messages IS 'DEPRECATED: Use synced_emails instead. Data migrated on 2026-01-16.';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_deprecated_scheduled_calls' AND table_schema = 'public') THEN
        COMMENT ON TABLE _deprecated_scheduled_calls IS 'DEPRECATED: Use calls instead. Data migrated on 2026-01-16.';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_deprecated_qualification_data' AND table_schema = 'public') THEN
        COMMENT ON TABLE _deprecated_qualification_data IS 'DEPRECATED: Use deals instead. Data migrated on 2026-01-16.';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_deprecated_clients' AND table_schema = 'public') THEN
        COMMENT ON TABLE _deprecated_clients IS 'DEPRECATED: Use contacts with contact_type=buyer instead. Data migrated on 2026-01-16.';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_deprecated_client_criteria' AND table_schema = 'public') THEN
        COMMENT ON TABLE _deprecated_client_criteria IS 'DEPRECATED: Use searches instead. Data migrated on 2026-01-16.';
    END IF;
END $$;

-- =============================================================================
-- PART 11: UPDATE/CREATE VIEWS
-- =============================================================================

-- Drop old views that reference deprecated tables
DROP VIEW IF EXISTS approval_queue;
DROP VIEW IF EXISTS qualification_pipeline;
DROP VIEW IF EXISTS pending_doc_follow_ups;
DROP VIEW IF EXISTS potential_ghosts;
DROP VIEW IF EXISTS qualification_readiness;

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
    se.matched_company_id,
    se.matched_property_id,
    se.enrollment_id,

    -- Contact info
    c.name AS contact_name,
    c.contact_type,
    c.title AS contact_title,
    c.phone AS contact_phone,

    -- Company info
    co.name AS company_name,
    co.status AS company_status,

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
LEFT JOIN companies co ON se.matched_company_id = co.id
LEFT JOIN properties p ON se.matched_property_id = p.id
LEFT JOIN deals d ON d.property_id = p.id AND d.company_id = co.id
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
    co.name AS company_name,
    p.address AS property_address,
    NULL::float AS confidence
FROM email_drafts ed
LEFT JOIN contacts c ON ed.contact_id = c.id
LEFT JOIN companies co ON ed.company_id = co.id
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
    co.name AS company_name,
    NULL AS property_address,
    se.classification_confidence AS confidence
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN companies co ON se.matched_company_id = co.id
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
    d.company_id,
    d.contact_id,

    -- Property info
    p.address AS property_address,
    p.property_name,
    p.property_type,
    p.building_size_sqft,

    -- Company info
    co.name AS company_name,
    co.status AS company_status,

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
LEFT JOIN companies co ON d.company_id = co.id
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.status NOT IN ('handed_off', 'lost')
ORDER BY d.last_response_at DESC NULLS LAST;

COMMENT ON VIEW deal_pipeline IS 'Pipeline view of active deals with qualification progress';

-- Pending document follow-ups view
CREATE OR REPLACE VIEW pending_doc_follow_ups AS
SELECT
    d.id AS deal_id,
    d.display_id,
    d.company_id,
    d.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    co.name AS company_name,
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
JOIN companies co ON d.company_id = co.id
JOIN contacts c ON d.contact_id = c.id OR c.company_id = co.id
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
    d.company_id,
    d.property_id,
    c.name AS contact_name,
    c.email AS contact_email,
    co.name AS company_name,
    d.last_response_at,
    d.follow_up_count,
    d.asking_price,
    d.noi
FROM deals d
JOIN companies co ON d.company_id = co.id
JOIN contacts c ON d.contact_id = c.id OR c.company_id = co.id
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

    -- Company info
    co.id AS company_id,
    co.name AS company_name,
    co.status AS company_status,
    co.company_type,

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
LEFT JOIN companies co ON c.company_id = co.id
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
    co.name AS company_name,
    NULL::uuid AS deal_id,
    1 AS priority
FROM email_drafts ed
LEFT JOIN contacts c ON ed.contact_id = c.id
LEFT JOIN companies co ON ed.company_id = co.id
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
    co.name AS company_name,
    NULL::uuid AS deal_id,
    2 AS priority
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN companies co ON se.matched_company_id = co.id
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
    co.name AS company_name,
    ca.deal_id,
    3 AS priority
FROM calls ca
LEFT JOIN contacts c ON ca.contact_id = c.id
LEFT JOIN deals d ON ca.deal_id = d.id
LEFT JOIN companies co ON d.company_id = co.id
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
    co.name AS company_name,
    t.deal_id,
    4 AS priority
FROM tasks t
LEFT JOIN contacts c ON t.contact_id = c.id
LEFT JOIN companies co ON t.company_id = co.id
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
    co.name AS company_name,
    d.id AS deal_id,
    5 AS priority
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN companies co ON se.matched_company_id = co.id
LEFT JOIN deals d ON d.company_id = co.id
WHERE se.classification IN ('hot_interested', 'hot_pricing', 'hot_schedule', 'hot_confirm')
  AND se.received_at > NOW() - INTERVAL '24 hours'
  AND se.status != 'actioned'

ORDER BY priority, due_at;

COMMENT ON VIEW today_view IS 'Everything that needs attention today - approvals, reviews, calls, tasks, hot leads';

-- =============================================================================
-- PART 12: RLS POLICIES FOR NEW COLUMNS
-- =============================================================================

-- Views inherit RLS from underlying tables, no additional policies needed

-- =============================================================================
-- PART 13: HELPER FUNCTIONS
-- =============================================================================

-- Function to get classification group
CREATE OR REPLACE FUNCTION get_classification_group(classification TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE
        WHEN classification IN ('hot_interested', 'hot_pricing', 'hot_schedule', 'hot_confirm') THEN 'hot'
        WHEN classification IN ('question', 'info_request', 'doc_promised', 'doc_received') THEN 'qualification'
        WHEN classification IN ('buyer_inquiry', 'buyer_criteria_update') THEN 'buyer'
        WHEN classification IN ('referral', 'broker', 'wrong_contact', 'ooo') THEN 'redirect'
        WHEN classification IN ('soft_pass', 'hard_pass', 'bounce') THEN 'closed'
        ELSE 'other'
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_classification_group IS 'Returns the group (hot, qualification, buyer, redirect, closed, other) for a classification';

-- =============================================================================
-- DONE
-- =============================================================================

-- Summary of changes:
-- 1. Created enum types for contact_type, company_type, email_classification, email_status
-- 2. Extended contacts with contact_type column
-- 3. Extended companies with company_type column
-- 4. Extended synced_emails with inbox_messages columns (matched_property_id, enrollment_id, status, needs_review, auto_handled, action_taken)
-- 5. Extended deals with qualification_data columns (document status, follow-up tracking, ghosted_at)
-- 6. Extended calls with scheduled_calls columns (company_id, property_id, calendar_event_id, phone, source_email_id)
-- 7. Extended tasks with deal_id
-- 8. Extended email_drafts with source_email_id
-- 9. Migrated data from deprecated tables
-- 10. Renamed deprecated tables to _deprecated_* (data preserved)
-- 11. Created views: inbox_view, approval_queue, deal_pipeline, pending_doc_follow_ups, potential_ghosts, people_view, today_view
-- 12. Created helper function get_classification_group
