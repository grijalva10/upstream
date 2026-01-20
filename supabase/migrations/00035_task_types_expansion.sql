-- Migration: Expand task types for CRM workflow
-- Adds object linking, new task types, and subject field for email tasks

-- =============================================================================
-- ADD NEW COLUMNS
-- =============================================================================

-- Add object linking columns for polymorphic relationships
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS object_type TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS object_id UUID;

-- Add subject field for email-related tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject TEXT;

-- =============================================================================
-- UPDATE TYPE CONSTRAINT
-- =============================================================================

-- Drop old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;

-- Add new constraint with expanded types
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN (
  'lead',           -- Generic task for a lead
  'incoming_email', -- Auto-created when unread email comes in
  'email_followup', -- Reminder to follow up on email thread
  'deal',           -- Deal close date reminder
  'outgoing_call'   -- Reminder to call a contact
));

-- =============================================================================
-- MIGRATE EXISTING DATA
-- =============================================================================

-- Map old types to new types
UPDATE tasks SET type = 'outgoing_call' WHERE type = 'call_reminder';
UPDATE tasks SET type = 'lead' WHERE type = 'follow_up';
UPDATE tasks SET type = 'deal' WHERE type = 'review_deal';
UPDATE tasks SET type = 'lead' WHERE type = 'call_prep';

-- =============================================================================
-- ADD INDEXES
-- =============================================================================

-- Index for looking up tasks by object
CREATE INDEX IF NOT EXISTS idx_tasks_object
  ON tasks(object_type, object_id)
  WHERE object_type IS NOT NULL;

-- Index for finding incoming_email tasks by thread (for auto-completion)
CREATE INDEX IF NOT EXISTS idx_tasks_incoming_email_thread
  ON tasks(object_id)
  WHERE type = 'incoming_email' AND status IN ('pending', 'snoozed');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON COLUMN tasks.object_type IS 'Type of linked object: emailthread, deal, etc.';
COMMENT ON COLUMN tasks.object_id IS 'ID of the linked object (thread ID, deal ID, etc.)';
COMMENT ON COLUMN tasks.subject IS 'Subject line for email-related tasks';
