-- Orchestrator heartbeat table for tracking running status
-- Migration: 00010_orchestrator_heartbeat.sql

-- ============================================================================
-- Orchestrator Status
-- Tracks heartbeats from the orchestrator to know if it's running
-- ============================================================================

CREATE TABLE IF NOT EXISTS orchestrator_status (
    id TEXT PRIMARY KEY DEFAULT 'main',
    is_running BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    hostname TEXT,
    pid INTEGER,
    config JSONB,
    loops_enabled JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE orchestrator_status IS 'Tracks orchestrator running status via heartbeats';
COMMENT ON COLUMN orchestrator_status.last_heartbeat IS 'Updated every 30s while running';
COMMENT ON COLUMN orchestrator_status.loops_enabled IS 'Which loops are enabled (send, response)';

-- Insert default row
INSERT INTO orchestrator_status (id, is_running) VALUES ('main', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE orchestrator_status ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access to orchestrator_status" ON orchestrator_status
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can view
CREATE POLICY "Authenticated users can view orchestrator_status" ON orchestrator_status
    FOR SELECT USING (auth.role() = 'authenticated');

-- Grant permissions
GRANT SELECT ON orchestrator_status TO authenticated;
GRANT ALL ON orchestrator_status TO service_role;
