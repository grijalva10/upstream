-- =============================================================================
-- Function to queue pg-boss jobs from API
-- =============================================================================

-- Function to insert a job into pg-boss queue
CREATE OR REPLACE FUNCTION queue_pgboss_job(
  p_name TEXT,
  p_data JSONB DEFAULT '{}',
  p_options JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_priority INT;
  v_retry_limit INT;
  v_start_after TIMESTAMPTZ;
  v_expire_in INTERVAL;
BEGIN
  -- Check if pgboss schema exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'pgboss') THEN
    RAISE EXCEPTION 'pg-boss schema not initialized. Start the worker first.';
  END IF;

  -- Extract options with defaults
  v_priority := COALESCE((p_options->>'priority')::INT, 0);
  v_retry_limit := COALESCE((p_options->>'retryLimit')::INT, 2);
  v_start_after := COALESCE((p_options->>'startAfter')::TIMESTAMPTZ, NOW());
  v_expire_in := COALESCE((p_options->>'expireIn')::INTERVAL, INTERVAL '15 minutes');

  -- Generate job ID
  v_job_id := gen_random_uuid();

  -- Insert into pg-boss job table
  INSERT INTO pgboss.job (
    id,
    name,
    priority,
    data,
    state,
    retry_limit,
    retry_count,
    retry_delay,
    retry_backoff,
    start_after,
    expire_in,
    created_on,
    keep_until
  ) VALUES (
    v_job_id,
    p_name,
    v_priority,
    p_data,
    'created',
    v_retry_limit,
    0,
    0,
    FALSE,
    v_start_after,
    v_expire_in,
    NOW(),
    NOW() + INTERVAL '14 days'
  );

  RETURN v_job_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION queue_pgboss_job TO authenticated, service_role;

COMMENT ON FUNCTION queue_pgboss_job IS 'Queue a job to pg-boss from the API';
