-- Backfill contact_type for existing contacts
-- Run this migration to set contact_type correctly based on known data sources

-- 1. Mark all Lee & Associates employees as 'team'
UPDATE contacts
SET contact_type = 'team',
    updated_at = now()
WHERE email ILIKE '%@lee-associates.com'
  AND (contact_type IS NULL OR contact_type != 'team');

-- 2. Mark CoStar-sourced contacts as 'seller' (these are property owners we're reaching out to)
UPDATE contacts
SET contact_type = 'seller',
    updated_at = now()
WHERE source = 'costar'
  AND (contact_type IS NULL OR contact_type = 'other');

-- 3. Mark anyone who sent buyer_inquiry or buyer_criteria_update as 'buyer'
UPDATE contacts c
SET contact_type = 'buyer',
    is_buyer = true,
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM synced_emails se
  WHERE se.matched_contact_id = c.id
  AND se.classification IN ('buyer_inquiry', 'buyer_criteria_update')
)
AND (c.contact_type IS NULL OR c.contact_type NOT IN ('team', 'buyer'));

-- 4. Set default contact_type for anything still NULL
-- Default to 'seller' since most contacts in a CRE sourcing tool are property owners
UPDATE contacts
SET contact_type = 'seller',
    updated_at = now()
WHERE contact_type IS NULL;

-- Log the results
DO $$
DECLARE
  team_count INTEGER;
  seller_count INTEGER;
  buyer_count INTEGER;
  other_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO team_count FROM contacts WHERE contact_type = 'team';
  SELECT COUNT(*) INTO seller_count FROM contacts WHERE contact_type = 'seller';
  SELECT COUNT(*) INTO buyer_count FROM contacts WHERE contact_type = 'buyer';
  SELECT COUNT(*) INTO other_count FROM contacts WHERE contact_type = 'other';

  RAISE NOTICE 'Contact type backfill complete:';
  RAISE NOTICE '  Team: %', team_count;
  RAISE NOTICE '  Seller: %', seller_count;
  RAISE NOTICE '  Buyer: %', buyer_count;
  RAISE NOTICE '  Other: %', other_count;
END $$;
