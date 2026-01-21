-- Pipeline count functions for dashboard
-- These return accurate counts without hitting Supabase's row limits

-- Lead pipeline counts (excludes handed_off and closed)
CREATE OR REPLACE FUNCTION get_lead_pipeline_counts()
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE SQL
STABLE
AS $$
  SELECT status, COUNT(*)::BIGINT
  FROM leads
  WHERE status NOT IN ('handed_off', 'closed')
  GROUP BY status
  ORDER BY CASE status
    WHEN 'new' THEN 1
    WHEN 'contacted' THEN 2
    WHEN 'replied' THEN 3
    WHEN 'engaged' THEN 4
    WHEN 'waiting' THEN 5
    WHEN 'qualified' THEN 6
    WHEN 'nurture' THEN 7
    ELSE 8
  END;
$$;

-- Deal pipeline counts (excludes handed_off and lost)
CREATE OR REPLACE FUNCTION get_deal_pipeline_counts()
RETURNS TABLE (status TEXT, count BIGINT)
LANGUAGE SQL
STABLE
AS $$
  SELECT status, COUNT(*)::BIGINT
  FROM deals
  WHERE status NOT IN ('handed_off', 'lost')
  GROUP BY status
  ORDER BY CASE status
    WHEN 'new' THEN 1
    WHEN 'gathering' THEN 2
    WHEN 'qualified' THEN 3
    WHEN 'packaging' THEN 4
    ELSE 5
  END;
$$;

COMMENT ON FUNCTION get_lead_pipeline_counts() IS 'Returns lead counts by status for dashboard pipeline';
COMMENT ON FUNCTION get_deal_pipeline_counts() IS 'Returns deal counts by status for dashboard pipeline';
