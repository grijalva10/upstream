-- =============================================================================
-- pg-boss Query Functions
-- Allows querying pg-boss jobs from the pgboss schema via RPC
-- =============================================================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_pgboss_jobs(TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS get_pgboss_stats();

-- Function to list pg-boss jobs
CREATE OR REPLACE FUNCTION get_pgboss_jobs(
  p_state TEXT DEFAULT NULL,
  p_name TEXT DEFAULT NULL,
  p_limit INT DEFAULT 100,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  priority INT,
  data JSONB,
  state TEXT,
  retry_limit INT,
  retry_count INT,
  retry_delay INT,
  retry_backoff BOOLEAN,
  start_after TIMESTAMPTZ,
  started_on TIMESTAMPTZ,
  expire_in INTERVAL,
  created_on TIMESTAMPTZ,
  completed_on TIMESTAMPTZ,
  keep_until TIMESTAMPTZ,
  output JSONB,
  dead_letter TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if pgboss schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') THEN
    RETURN;
  END IF;

  RETURN QUERY EXECUTE format(
    'SELECT
      id, name, priority, data, state::TEXT,
      retry_limit, retry_count, retry_delay, retry_backoff,
      start_after, started_on, expire_in, created_on,
      completed_on, keep_until, output, dead_letter
    FROM pgboss.job
    WHERE ($1 IS NULL OR state::TEXT = $1)
      AND ($2 IS NULL OR name = $2)
    ORDER BY created_on DESC
    LIMIT $3 OFFSET $4'
  )
  USING p_state, p_name, p_limit, p_offset;
END;
$$;

-- Function to get pg-boss job counts by state
CREATE OR REPLACE FUNCTION get_pgboss_stats()
RETURNS TABLE (
  total_jobs BIGINT,
  created_count BIGINT,
  retry_count BIGINT,
  active_count BIGINT,
  completed_count BIGINT,
  expired_count BIGINT,
  cancelled_count BIGINT,
  failed_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if pgboss schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') THEN
    RETURN QUERY SELECT 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_jobs,
    COUNT(*) FILTER (WHERE j.state = 'created')::BIGINT as created_count,
    COUNT(*) FILTER (WHERE j.state = 'retry')::BIGINT as retry_count,
    COUNT(*) FILTER (WHERE j.state = 'active')::BIGINT as active_count,
    COUNT(*) FILTER (WHERE j.state = 'completed')::BIGINT as completed_count,
    COUNT(*) FILTER (WHERE j.state = 'expired')::BIGINT as expired_count,
    COUNT(*) FILTER (WHERE j.state = 'cancelled')::BIGINT as cancelled_count,
    COUNT(*) FILTER (WHERE j.state = 'failed')::BIGINT as failed_count
  FROM pgboss.job j;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_pgboss_jobs TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_pgboss_stats TO authenticated, anon;

COMMENT ON FUNCTION get_pgboss_jobs IS 'Query pg-boss jobs with optional filtering by state and name';
COMMENT ON FUNCTION get_pgboss_stats IS 'Get aggregate statistics for pg-boss jobs';
