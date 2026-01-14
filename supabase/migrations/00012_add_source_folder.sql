-- Add source_folder column to track which Outlook folder emails came from
-- This enables folder-based navigation in the mail UI

ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS source_folder TEXT;

-- Add index for efficient folder filtering
CREATE INDEX IF NOT EXISTS idx_synced_emails_source_folder ON synced_emails(source_folder);

-- Common folder values: 'Inbox', 'Sent Items', 'Archive', 'Drafts', etc.
COMMENT ON COLUMN synced_emails.source_folder IS 'Outlook folder path where email was synced from (e.g., Inbox, Sent Items, Archive)';
