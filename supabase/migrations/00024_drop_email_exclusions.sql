-- Drop unused legacy email_exclusions table
-- The newer `exclusions` table (from migration 17) is used instead

DROP TABLE IF EXISTS email_exclusions;
