-- Migration: Add nurture/pass statuses and referral source tracking
-- 1. Add new lead statuses: nurture (warm "not now"), pass (wrong criteria but potential)
-- 2. Add is_referral_source to contacts for network/indirect leads

-- Update leads status constraint to include nurture and pass
ALTER TABLE leads DROP CONSTRAINT IF EXISTS companies_status_check;
ALTER TABLE leads ADD CONSTRAINT companies_status_check CHECK (
  status = ANY (ARRAY[
    'new'::text,
    'contacted'::text,
    'engaged'::text,
    'qualified'::text,
    'handed_off'::text,
    'dnc'::text,
    'rejected'::text,
    'nurture'::text,  -- warm "not now" - revisit later
    'pass'::text      -- wrong criteria but could match future buyer
  ])
);

-- Add is_referral_source to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_referral_source boolean DEFAULT false;

COMMENT ON COLUMN contacts.is_referral_source IS 'True if contact is a network/indirect lead who may know sellers but is not a direct seller themselves';

-- Add comments for new statuses
COMMENT ON TABLE leads IS 'Status values: new, contacted, engaged, qualified, handed_off, dnc, rejected, nurture (warm not-now), pass (wrong criteria)';
