-- Add unique constraint on property_id for property_loans upsert
-- This allows one loan record per property (we'll update if new data arrives)

-- First, delete any duplicates keeping the most recent
DELETE FROM property_loans a
USING property_loans b
WHERE a.property_id = b.property_id
  AND a.created_at < b.created_at;

-- Now add the unique constraint
ALTER TABLE property_loans
ADD CONSTRAINT property_loans_property_id_key UNIQUE (property_id);
