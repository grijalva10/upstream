-- Add send settings to campaigns (migrating from sequences)
-- These columns were previously only on the legacy sequences table

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS weekdays_only BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS spacing_min_sec INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS spacing_max_sec INTEGER DEFAULT 90,
ADD COLUMN IF NOT EXISTS humanize_timing BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS humanize_variance_min INTEGER DEFAULT -15,
ADD COLUMN IF NOT EXISTS humanize_variance_max INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS simulate_breaks BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN campaigns.weekdays_only IS 'Only send on weekdays (Mon-Fri)';
COMMENT ON COLUMN campaigns.spacing_min_sec IS 'Minimum seconds between campaign emails';
COMMENT ON COLUMN campaigns.spacing_max_sec IS 'Maximum seconds between campaign emails';
COMMENT ON COLUMN campaigns.humanize_timing IS 'Add random variance to send timing';
COMMENT ON COLUMN campaigns.humanize_variance_min IS 'Minutes to shift window start (negative = earlier)';
COMMENT ON COLUMN campaigns.humanize_variance_max IS 'Minutes to shift window start (positive = later)';
COMMENT ON COLUMN campaigns.simulate_breaks IS 'Add occasional longer pauses between emails';
