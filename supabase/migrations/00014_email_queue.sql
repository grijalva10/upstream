-- pg-boss Email Queue and Worker Infrastructure
-- Migration: 00014_email_queue.sql

-- =============================================================================
-- EMAIL QUEUE (business-level queue for outbound emails)
-- =============================================================================

CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Job classification
    job_type TEXT NOT NULL CHECK (job_type IN (
        'cold_outreach',     -- Initial drip email
        'follow_up',         -- Sequence follow-up
        'manual_reply',      -- Human-written reply (priority)
        'qualification',     -- Qualify-agent generated
        'scheduling'         -- Call scheduling email
    )),
    priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    source TEXT DEFAULT 'script' CHECK (source IN ('script', 'claude', 'user', 'api')),

    -- Email content
    to_email TEXT NOT NULL,
    to_name TEXT,
    subject TEXT NOT NULL,
    body_text TEXT NOT NULL,
    body_html TEXT,

    -- Context references
    sequence_id UUID REFERENCES sequences(id) ON DELETE SET NULL,
    subscription_id UUID REFERENCES sequence_subscriptions(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    in_reply_to_email_id UUID REFERENCES synced_emails(id) ON DELETE SET NULL,

    -- Scheduling (campaign emails use sequence settings, these are overrides or for non-campaign)
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',      -- Waiting to be processed
        'scheduled',    -- Assigned send time, waiting
        'processing',   -- Being sent
        'sent',         -- Successfully sent
        'failed',       -- Failed after max retries
        'cancelled'     -- Manually cancelled
    )),

    -- Retry tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    next_retry_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_by TEXT  -- 'system', 'user', agent name
);

-- Indexes for efficient queue processing
CREATE INDEX IF NOT EXISTS idx_email_queue_pending
    ON email_queue(scheduled_for, priority DESC)
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_email_queue_status
    ON email_queue(status);

CREATE INDEX IF NOT EXISTS idx_email_queue_contact
    ON email_queue(contact_id);

CREATE INDEX IF NOT EXISTS idx_email_queue_sequence
    ON email_queue(sequence_id);

COMMENT ON TABLE email_queue IS 'Outbound email queue with scheduling and rate limiting';

-- =============================================================================
-- SEND RATE TRACKING
-- =============================================================================

CREATE TABLE IF NOT EXISTS send_rate_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period_type TEXT NOT NULL CHECK (period_type IN ('hourly', 'daily')),
    period_start TIMESTAMPTZ NOT NULL,
    rate_limit_group TEXT DEFAULT 'default',
    count INTEGER DEFAULT 0,

    UNIQUE(period_type, period_start, rate_limit_group)
);

CREATE INDEX IF NOT EXISTS idx_send_rate_period
    ON send_rate_tracking(period_type, period_start DESC);

COMMENT ON TABLE send_rate_tracking IS 'Tracks email send counts for rate limiting';

-- =============================================================================
-- WORKER STATUS
-- =============================================================================

CREATE TABLE IF NOT EXISTS worker_status (
    id TEXT PRIMARY KEY DEFAULT 'main',
    is_running BOOLEAN DEFAULT FALSE,
    is_paused BOOLEAN DEFAULT FALSE,
    hostname TEXT,
    pid INTEGER,
    started_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    jobs_processed INTEGER DEFAULT 0,
    jobs_failed INTEGER DEFAULT 0,
    current_job_id UUID,
    config JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE worker_status IS 'pg-boss worker status and metrics';

-- Insert default worker status row
INSERT INTO worker_status (id, is_running, is_paused)
VALUES ('main', false, false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- ADD COLUMNS TO SEQUENCES TABLE FOR CAMPAIGN SETTINGS
-- =============================================================================

-- Send window settings (using existing timezone column)
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS send_window_start TIME DEFAULT '09:00'::TIME;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS send_window_end TIME DEFAULT '17:00'::TIME;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS weekdays_only BOOLEAN DEFAULT TRUE;

-- Email spacing
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS spacing_min_sec INTEGER DEFAULT 30;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS spacing_max_sec INTEGER DEFAULT 90;

-- Humanization
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS humanize_timing BOOLEAN DEFAULT TRUE;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS humanize_variance_min INTEGER DEFAULT -15;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS humanize_variance_max INTEGER DEFAULT 15;
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS simulate_breaks BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN sequences.send_window_start IS 'Daily send window start time';
COMMENT ON COLUMN sequences.send_window_end IS 'Daily send window end time';
COMMENT ON COLUMN sequences.weekdays_only IS 'Only send on weekdays (Mon-Fri)';
COMMENT ON COLUMN sequences.spacing_min_sec IS 'Minimum seconds between campaign emails';
COMMENT ON COLUMN sequences.spacing_max_sec IS 'Maximum seconds between campaign emails';
COMMENT ON COLUMN sequences.humanize_timing IS 'Add random variance to send timing';
COMMENT ON COLUMN sequences.humanize_variance_min IS 'Minutes to shift window start (negative = earlier)';
COMMENT ON COLUMN sequences.humanize_variance_max IS 'Minutes to shift window start (positive = later)';
COMMENT ON COLUMN sequences.simulate_breaks IS 'Add occasional longer pauses between emails';

-- =============================================================================
-- DEFAULT WORKER SETTINGS
-- =============================================================================

-- Insert default worker settings
INSERT INTO settings (key, value) VALUES
    ('worker.rate_limit_hourly', '1000'),
    ('worker.rate_limit_daily', '10000'),
    ('worker.default_timezone', '"America/Los_Angeles"'),
    ('worker.interval_email_sync', '15'),
    ('worker.interval_check_replies', '5'),
    ('worker.interval_queue_process', '30'),
    ('worker.dry_run', 'true'),
    ('worker.debug', 'false'),
    ('worker.paused', 'false')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to check rate limits
CREATE OR REPLACE FUNCTION check_send_rate_limit(
    p_group TEXT DEFAULT 'default',
    p_hourly_limit INTEGER DEFAULT 1000,
    p_daily_limit INTEGER DEFAULT 10000
) RETURNS TABLE(can_send BOOLEAN, hourly_count INTEGER, daily_count INTEGER, hourly_remaining INTEGER, daily_remaining INTEGER, reason TEXT) AS $$
DECLARE
    v_hourly INTEGER;
    v_daily INTEGER;
    v_hour_start TIMESTAMPTZ;
    v_day_start TIMESTAMPTZ;
BEGIN
    v_hour_start := date_trunc('hour', NOW());
    v_day_start := date_trunc('day', NOW());

    -- Get hourly count
    SELECT COALESCE(SUM(srt.count), 0) INTO v_hourly
    FROM send_rate_tracking srt
    WHERE srt.period_type = 'hourly'
      AND srt.period_start = v_hour_start
      AND srt.rate_limit_group = p_group;

    -- Get daily count
    SELECT COALESCE(SUM(srt.count), 0) INTO v_daily
    FROM send_rate_tracking srt
    WHERE srt.period_type = 'daily'
      AND srt.period_start = v_day_start
      AND srt.rate_limit_group = p_group;

    -- Return result
    can_send := TRUE;
    hourly_count := v_hourly;
    daily_count := v_daily;
    hourly_remaining := p_hourly_limit - v_hourly;
    daily_remaining := p_daily_limit - v_daily;
    reason := 'OK';

    IF v_hourly >= p_hourly_limit THEN
        can_send := FALSE;
        reason := format('Hourly limit reached: %s/%s', v_hourly, p_hourly_limit);
    ELSIF v_daily >= p_daily_limit THEN
        can_send := FALSE;
        reason := format('Daily limit reached: %s/%s', v_daily, p_daily_limit);
    END IF;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to increment send count
CREATE OR REPLACE FUNCTION increment_send_count(p_group TEXT DEFAULT 'default')
RETURNS VOID AS $$
BEGIN
    -- Increment hourly
    INSERT INTO send_rate_tracking (period_type, period_start, rate_limit_group, count)
    VALUES ('hourly', date_trunc('hour', NOW()), p_group, 1)
    ON CONFLICT (period_type, period_start, rate_limit_group)
    DO UPDATE SET count = send_rate_tracking.count + 1;

    -- Increment daily
    INSERT INTO send_rate_tracking (period_type, period_start, rate_limit_group, count)
    VALUES ('daily', date_trunc('day', NOW()), p_group, 1)
    ON CONFLICT (period_type, period_start, rate_limit_group)
    DO UPDATE SET count = send_rate_tracking.count + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_queue_stats()
RETURNS TABLE(
    pending_count BIGINT,
    scheduled_count BIGINT,
    processing_count BIGINT,
    sent_today BIGINT,
    failed_today BIGINT,
    hourly_count INTEGER,
    hourly_limit INTEGER,
    daily_count INTEGER,
    daily_limit INTEGER
) AS $$
DECLARE
    v_hourly_limit INTEGER;
    v_daily_limit INTEGER;
    v_rate_check RECORD;
BEGIN
    -- Get limits from settings
    SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'worker.rate_limit_hourly'), 1000) INTO v_hourly_limit;
    SELECT COALESCE((SELECT value::INTEGER FROM settings WHERE key = 'worker.rate_limit_daily'), 10000) INTO v_daily_limit;

    -- Get rate check
    SELECT * INTO v_rate_check FROM check_send_rate_limit('default', v_hourly_limit, v_daily_limit);

    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM email_queue WHERE status = 'pending')::BIGINT,
        (SELECT COUNT(*) FROM email_queue WHERE status = 'scheduled')::BIGINT,
        (SELECT COUNT(*) FROM email_queue WHERE status = 'processing')::BIGINT,
        (SELECT COUNT(*) FROM email_queue WHERE status = 'sent' AND sent_at >= date_trunc('day', NOW()))::BIGINT,
        (SELECT COUNT(*) FROM email_queue WHERE status = 'failed' AND updated_at >= date_trunc('day', NOW()))::BIGINT,
        v_rate_check.hourly_count,
        v_hourly_limit,
        v_rate_check.daily_count,
        v_daily_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_rate_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_status ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to email_queue" ON email_queue
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to send_rate_tracking" ON send_rate_tracking
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to worker_status" ON worker_status
    FOR ALL USING (auth.role() = 'service_role');

-- Authenticated users can view
CREATE POLICY "Authenticated view email_queue" ON email_queue
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated view send_rate_tracking" ON send_rate_tracking
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated view worker_status" ON worker_status
    FOR SELECT USING (auth.role() = 'authenticated');

-- =============================================================================
-- TRIGGER TO UPDATE updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_email_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_queue_updated_at
    BEFORE UPDATE ON email_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_email_queue_updated_at();
