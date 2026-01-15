-- CoStar lookup tables for agent service caching
-- Stores all reference data needed for query generation

CREATE TABLE costar_lookups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lookup_type TEXT NOT NULL UNIQUE,
    data JSONB NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_costar_lookups_type ON costar_lookups(lookup_type);

COMMENT ON TABLE costar_lookups IS 'CoStar API lookup tables for agent query generation';
COMMENT ON COLUMN costar_lookups.lookup_type IS 'Type of lookup: markets, property_types, owner_types, etc.';
COMMENT ON COLUMN costar_lookups.data IS 'Full lookup data as JSON';
