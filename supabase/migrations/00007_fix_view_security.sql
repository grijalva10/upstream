-- Migration: Fix SECURITY DEFINER views
-- Changes views to use security_invoker = true for proper RLS enforcement

-- Drop and recreate approval_queue view with security_invoker
DROP VIEW IF EXISTS approval_queue;

CREATE VIEW approval_queue
WITH (security_invoker = true) AS
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

-- Drop and recreate qualification_pipeline view with security_invoker
DROP VIEW IF EXISTS qualification_pipeline;

CREATE VIEW qualification_pipeline
WITH (security_invoker = true) AS
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
