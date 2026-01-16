-- Test Contact Reset
-- Run this to reset the test company/contact back to initial state for re-testing

-- Reset company status back to 'new'
UPDATE companies
SET status = 'new', updated_at = NOW()
WHERE name = 'Test Company (Jeff)';

-- Reset contact status back to 'active'
UPDATE contacts
SET status = 'active', updated_at = NOW()
WHERE email = 'grijalva10@gmail.com'
  AND company_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

-- Clear any synced emails matched to this contact
UPDATE synced_emails
SET
  matched_contact_id = NULL,
  matched_company_id = NULL,
  classification = NULL,
  classification_confidence = NULL,
  classified_at = NULL,
  classified_by = NULL,
  needs_human_review = false
WHERE matched_contact_id = 'ffffffff-1111-2222-3333-444444444444';

-- Clear enrollments for this contact
DELETE FROM enrollments
WHERE contact_id = 'ffffffff-1111-2222-3333-444444444444';

-- Clear email queue for this contact
DELETE FROM email_queue
WHERE contact_id = 'ffffffff-1111-2222-3333-444444444444';

-- Verify reset
SELECT
  c.name as company_name,
  c.status as company_status,
  ct.name as contact_name,
  ct.email as contact_email,
  ct.status as contact_status
FROM companies c
JOIN contacts ct ON ct.company_id = c.id
WHERE c.name = 'Test Company (Jeff)';
