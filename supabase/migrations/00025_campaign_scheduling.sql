-- Campaign scheduling support
-- Migration: 00025_campaign_scheduling.sql

-- Add scheduled start time to campaigns
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ;

COMMENT ON COLUMN campaigns.scheduled_start_at IS 'When the campaign should start sending emails';

-- Add campaign_id to email_queue for tracking
ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;

ALTER TABLE email_queue
ADD COLUMN IF NOT EXISTS enrollment_id UUID REFERENCES enrollments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_email_queue_campaign ON email_queue(campaign_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_enrollment ON email_queue(enrollment_id);

COMMENT ON COLUMN email_queue.campaign_id IS 'Campaign this email belongs to';
COMMENT ON COLUMN email_queue.enrollment_id IS 'Enrollment this email is for';
