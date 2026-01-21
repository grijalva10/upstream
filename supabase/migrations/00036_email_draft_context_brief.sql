-- Add context_brief column to email_drafts
-- Pre-generated context summary for human review

ALTER TABLE email_drafts
ADD COLUMN IF NOT EXISTS context_brief TEXT;

COMMENT ON COLUMN email_drafts.context_brief IS 'AI-generated context summary for human review: thread summary, property info, lead status, why this needs attention';
