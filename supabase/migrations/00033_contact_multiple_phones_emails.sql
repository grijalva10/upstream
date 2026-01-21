-- Migration: Support multiple phones and emails per contact with types
-- Keep `email` as primary (used for upserts/unique constraint)
-- Use JSONB for structured phone/email data

-- Add phones as JSONB array: [{"number": "310-555-1234", "type": "cell"}, {"number": "310-555-5678", "type": "office"}]
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS phones jsonb DEFAULT '[]';

-- Add secondary emails as JSONB array: [{"email": "alt@example.com", "type": "personal"}]
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS secondary_emails jsonb DEFAULT '[]';

-- Migrate existing phone data to phones array (default to 'office' type since CoStar typically provides office numbers)
UPDATE contacts
SET phones = jsonb_build_array(jsonb_build_object('number', phone, 'type', 'office'))
WHERE phone IS NOT NULL AND phone != '' AND (phones IS NULL OR phones = '[]'::jsonb);

-- Add comments explaining the schema
COMMENT ON COLUMN contacts.email IS 'Primary email - used for deduplication and upserts';
COMMENT ON COLUMN contacts.phone IS 'Legacy primary phone - use phones[] instead';
COMMENT ON COLUMN contacts.phones IS 'All phone numbers as [{number, type}] where type is: cell, office, fax, home, other';
COMMENT ON COLUMN contacts.secondary_emails IS 'Additional emails as [{email, type}] where type is: work, personal, other';
