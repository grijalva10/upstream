-- Migration: Security fixes for clients, client_criteria, and functions
-- Fixes Supabase linter errors and warnings

-- =============================================================================
-- FIX: RLS on new tables
-- =============================================================================

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Authenticated users have full access to clients"
    ON clients FOR ALL
    USING (auth.role() = 'authenticated');

-- RLS Policies for client_criteria
CREATE POLICY "Authenticated users have full access to client_criteria"
    ON client_criteria FOR ALL
    USING (auth.role() = 'authenticated');

-- =============================================================================
-- FIX: Security definer view
-- =============================================================================

-- Drop and recreate view without SECURITY DEFINER
DROP VIEW IF EXISTS client_pipeline_summary;

CREATE VIEW client_pipeline_summary
WITH (security_invoker = true) AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.status AS client_status,
    COUNT(DISTINCT cc.id) AS criteria_count,
    COUNT(DISTINCT el.id) AS extraction_count,
    COALESCE(SUM(el.property_count), 0) AS total_properties,
    COALESCE(SUM(el.contact_count), 0) AS total_contacts,
    MAX(el.extracted_at) AS last_extraction
FROM clients c
LEFT JOIN client_criteria cc ON cc.client_id = c.id
LEFT JOIN extraction_lists el ON el.client_criteria_id = cc.id
GROUP BY c.id, c.name, c.status;

COMMENT ON VIEW client_pipeline_summary IS 'Aggregated view of client sourcing pipeline stats';

-- =============================================================================
-- FIX: Function search_path (warnings)
-- =============================================================================

-- Recreate update_updated_at with fixed search_path
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Recreate update_status_changed_at with fixed search_path
CREATE OR REPLACE FUNCTION update_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        NEW.status_changed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$;
