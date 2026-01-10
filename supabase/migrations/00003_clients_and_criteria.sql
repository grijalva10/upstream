-- Migration: Add clients and client_criteria tables
-- Connects the sourcing pipeline: client → criteria → queries → extraction → properties

-- =============================================================================
-- CLIENTS (Buyers/Investors we source deals for)
-- =============================================================================

CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
        'active', 'paused', 'churned'
    )),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_name ON clients(name);

COMMENT ON TABLE clients IS 'Buyers/investors we are sourcing deals for';

-- =============================================================================
-- CLIENT CRITERIA (Search profiles for each client)
-- =============================================================================

CREATE TABLE client_criteria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,  -- e.g., "Phoenix Industrial Value-Add"

    -- Human-readable criteria (from sourcing agent input)
    criteria_json JSONB NOT NULL,  -- {capital, property_types, markets, size_range, ...}

    -- Generated queries (from sourcing agent output)
    queries_json JSONB,  -- [{name, strategy, rationale, expected_volume, payload}, ...]

    -- Metadata
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'active', 'paused', 'archived'
    )),
    strategy_summary TEXT,  -- Markdown summary from sourcing agent
    source_file TEXT,  -- Path to generated files (output/queries/...)

    -- Stats (updated after extractions)
    total_properties INTEGER DEFAULT 0,
    total_contacts INTEGER DEFAULT 0,
    last_extracted_at TIMESTAMPTZ,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_client_criteria_client ON client_criteria(client_id);
CREATE INDEX idx_client_criteria_status ON client_criteria(status);

COMMENT ON TABLE client_criteria IS 'Search criteria profiles for clients - stores both input criteria and generated CoStar queries';

-- =============================================================================
-- UPDATE EXTRACTION_LISTS (Add client_criteria link)
-- =============================================================================

ALTER TABLE extraction_lists
ADD COLUMN client_criteria_id UUID REFERENCES client_criteria(id);

ALTER TABLE extraction_lists
ADD COLUMN query_name TEXT;  -- Which query from queries_json was used

ALTER TABLE extraction_lists
ADD COLUMN query_index INTEGER;  -- Index in queries_json array

CREATE INDEX idx_extraction_lists_criteria ON extraction_lists(client_criteria_id);

COMMENT ON COLUMN extraction_lists.client_criteria_id IS 'Links extraction to the client criteria that generated it';
COMMENT ON COLUMN extraction_lists.query_name IS 'Name of the specific query from criteria queries_json';

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_client_criteria_updated_at BEFORE UPDATE ON client_criteria
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================================
-- HELPER VIEW: Client pipeline summary
-- =============================================================================

CREATE VIEW client_pipeline_summary AS
SELECT
    c.id AS client_id,
    c.name AS client_name,
    c.status AS client_status,
    COUNT(DISTINCT cc.id) AS criteria_count,
    COUNT(DISTINCT el.id) AS extraction_count,
    SUM(el.property_count) AS total_properties,
    SUM(el.contact_count) AS total_contacts,
    MAX(el.extracted_at) AS last_extraction
FROM clients c
LEFT JOIN client_criteria cc ON cc.client_id = c.id
LEFT JOIN extraction_lists el ON el.client_criteria_id = cc.id
GROUP BY c.id, c.name, c.status;

COMMENT ON VIEW client_pipeline_summary IS 'Aggregated view of client sourcing pipeline stats';
