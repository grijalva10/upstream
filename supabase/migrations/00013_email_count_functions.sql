-- RPC functions for email counts (avoids Supabase's default row limit)

-- Classification counts
CREATE OR REPLACE FUNCTION get_email_classification_counts()
RETURNS TABLE (
  classification TEXT,
  count BIGINT,
  needs_review_count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    classification,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE needs_human_review = true) as needs_review_count
  FROM synced_emails
  GROUP BY classification;
$$;

-- Folder counts
CREATE OR REPLACE FUNCTION get_email_folder_counts()
RETURNS TABLE (
  folder TEXT,
  count BIGINT
)
LANGUAGE SQL
STABLE
AS $$
  SELECT
    source_folder as folder,
    COUNT(*) as count
  FROM synced_emails
  GROUP BY source_folder;
$$;
