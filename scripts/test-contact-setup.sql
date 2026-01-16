-- Test Contact Setup for Reply Flow Testing
-- Run this to create/reset a test company and contact for grijalva10@gmail.com

-- First, clean up any existing test data
DELETE FROM email_queue WHERE contact_id IN (
  SELECT id FROM contacts WHERE email = 'grijalva10@gmail.com' AND company_id IN (
    SELECT id FROM companies WHERE name = 'Test Company (Jeff)'
  )
);

DELETE FROM enrollments WHERE contact_id IN (
  SELECT id FROM contacts WHERE email = 'grijalva10@gmail.com' AND company_id IN (
    SELECT id FROM companies WHERE name = 'Test Company (Jeff)'
  )
);

DELETE FROM synced_emails WHERE matched_contact_id IN (
  SELECT id FROM contacts WHERE email = 'grijalva10@gmail.com' AND company_id IN (
    SELECT id FROM companies WHERE name = 'Test Company (Jeff)'
  )
);

DELETE FROM contacts WHERE email = 'grijalva10@gmail.com' AND company_id IN (
  SELECT id FROM companies WHERE name = 'Test Company (Jeff)'
);

DELETE FROM companies WHERE name = 'Test Company (Jeff)';

-- Create test company
INSERT INTO companies (id, name, status, created_at)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'Test Company (Jeff)',
  'new',
  NOW()
);

-- Create test contact
INSERT INTO contacts (id, company_id, name, email, status, created_at)
VALUES (
  'ffffffff-1111-2222-3333-444444444444',
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'Jeff Grijalva (Test)',
  'grijalva10@gmail.com',
  'active',
  NOW()
);

-- Verify
SELECT
  c.name as company_name,
  c.status as company_status,
  ct.name as contact_name,
  ct.email as contact_email,
  ct.status as contact_status
FROM companies c
JOIN contacts ct ON ct.company_id = c.id
WHERE c.name = 'Test Company (Jeff)';
