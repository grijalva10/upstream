-- Remove legacy sequence system (replaced by campaigns/enrollments)

-- Step 1: Drop foreign key columns from email_queue
ALTER TABLE email_queue DROP COLUMN IF EXISTS sequence_id;
ALTER TABLE email_queue DROP COLUMN IF EXISTS subscription_id;

-- Step 2: Drop foreign key column from activities
ALTER TABLE activities DROP COLUMN IF EXISTS sequence_subscription_id;

-- Step 3: Drop legacy tables (order matters due to FK constraints)
DROP TABLE IF EXISTS sequence_subscriptions;
DROP TABLE IF EXISTS sequence_steps;
DROP TABLE IF EXISTS sequences;
