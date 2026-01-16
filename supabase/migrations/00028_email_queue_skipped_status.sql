-- Add 'skipped' status to email_queue for emails disabled by type
-- Migration: 00028_email_queue_skipped_status.sql

-- Drop the existing constraint
ALTER TABLE email_queue DROP CONSTRAINT IF EXISTS email_queue_status_check;

-- Add the new constraint with 'skipped' status
ALTER TABLE email_queue ADD CONSTRAINT email_queue_status_check
    CHECK (status IN (
        'pending',      -- Waiting to be processed
        'scheduled',    -- Assigned send time, waiting
        'processing',   -- Being sent
        'sent',         -- Successfully sent
        'failed',       -- Failed after max retries
        'cancelled',    -- Manually cancelled
        'skipped'       -- Skipped due to email type being disabled
    ));

COMMENT ON COLUMN email_queue.status IS 'Email status: pending, scheduled, processing, sent, failed, cancelled, skipped';
