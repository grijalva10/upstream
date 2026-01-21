-- Expand draft_type check constraint to include hot_response and question_answer

ALTER TABLE email_drafts DROP CONSTRAINT IF EXISTS email_drafts_draft_type_check;

ALTER TABLE email_drafts ADD CONSTRAINT email_drafts_draft_type_check
CHECK (draft_type = ANY (ARRAY[
  'cold_outreach'::text,
  'follow_up'::text,
  'qualification'::text,
  'scheduling'::text,
  'escalation'::text,
  'hot_response'::text,
  'question_answer'::text
]));
