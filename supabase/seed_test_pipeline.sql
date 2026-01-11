-- Test data for Upstream pipeline integration testing
-- Run after 00006_upstream_schema.sql migration
-- This seed tests the NEW pipeline tables created in Phase 1

-- =============================================================================
-- TEST CLIENT (Buyer)
-- =============================================================================

INSERT INTO clients (id, name, company_name, email, phone, status, notes)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Test Buyer',
    'TestCo Capital',
    'buyer@testco.com',
    '555-100-0001',
    'active',
    'Test buyer for pipeline integration testing'
) ON CONFLICT (id) DO NOTHING;

-- Client Criteria
INSERT INTO client_criteria (id, client_id, name, criteria_json, queries_json, status, strategy_summary)
VALUES (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'Phoenix Industrial Value-Add',
    '{
        "capital": "$15-25M",
        "capital_min": 15000000,
        "capital_max": 25000000,
        "property_types": ["Industrial"],
        "markets": ["Phoenix", "AZ"],
        "size_min": 30000,
        "size_max": 75000,
        "year_built_max": 2000,
        "building_class": ["B", "C"],
        "exchangeType": "1031"
    }',
    '[{"name": "Long Hold Industrial", "strategy": "hold_period", "payload": {}}]',
    'active',
    'Targeting value-add industrial in Phoenix metro for 1031 exchange'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST MARKET
-- =============================================================================

INSERT INTO markets (id, name, state)
VALUES (9999, 'Phoenix-Test', 'AZ')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST PROPERTY
-- =============================================================================

INSERT INTO properties (id, address, property_name, property_type, building_size_sqft, lot_size_acres, year_built, building_class, percent_leased, market_id)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '1234 Industrial Way, Phoenix, AZ 85001',
    'Phoenix Industrial Center',
    'Industrial',
    45000,
    2.5,
    1995,
    'B',
    92.5,
    9999
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST COMPANY (Seller)
-- =============================================================================

INSERT INTO companies (id, name, status, has_broker, qualification_status, notes)
VALUES (
    '55555555-5555-5555-5555-555555555555',
    'Test Seller Properties LLC',
    'new',
    false,
    'new',
    'Test seller company for pipeline integration testing'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST CONTACT (Owner)
-- =============================================================================

INSERT INTO contacts (id, company_id, name, title, email, phone, status)
VALUES (
    '66666666-6666-6666-6666-666666666666',
    '55555555-5555-5555-5555-555555555555',
    'John Smith',
    'Managing Partner',
    'john.smith@testseller.com',
    '555-200-0001',
    'active'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- TEST PROPERTY_COMPANIES JUNCTION
-- =============================================================================

INSERT INTO property_companies (property_id, company_id, relationship)
VALUES (
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    'owner'
) ON CONFLICT (property_id, company_id) DO NOTHING;

-- =============================================================================
-- PIPELINE-SPECIFIC TEST DATA
-- =============================================================================

-- TEST TASK
INSERT INTO tasks (id, type, company_id, contact_id, property_id, title, description, due_date, status)
VALUES (
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    'call_reminder',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    'Call John Smith re: 1234 Industrial Way',
    'Follow up on pricing - owner gave asking price but missing NOI',
    CURRENT_DATE + 1,
    'pending'
) ON CONFLICT (id) DO NOTHING;

-- TEST QUALIFICATION DATA (Fully qualified deal)
INSERT INTO qualification_data (
    id, company_id, property_id,
    asking_price, noi, cap_rate, price_per_sf,
    motivation, timeline, seller_priorities,
    has_operating_statements, has_rent_roll,
    decision_maker_confirmed, decision_maker_name, decision_maker_title,
    status, email_count, qualified_at
)
VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    21900000,
    1195000,
    0.0546,
    486.67,
    'Estate planning - principal retiring',
    '90 days to close preferred',
    'Clean close, minimal due diligence disruption',
    true,
    true,
    true,
    'John Smith',
    'Managing Partner',
    'qualified',
    5,
    NOW() - INTERVAL '2 days'
) ON CONFLICT (id) DO NOTHING;

-- TEST EMAIL DRAFT
INSERT INTO email_drafts (
    id, to_email, to_name, subject, body,
    company_id, contact_id, property_id,
    draft_type, status, generated_by
)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    'john.smith@testseller.com',
    'John Smith',
    'Re: 1234 Industrial Way - buyer inquiry',
    E'John -\n\nThanks for getting back to me. A few quick questions to see if this\ncould be a fit:\n\n1. Do you have a sense of pricing or value you''d need to consider a sale?\n2. What''s driving your interest - any particular timeline or situation?\n\nHappy to jump on a call if easier. What works for your schedule?\n\nJeff Grijalva | Lee & Associates | Newport Beach, CA | (949) 939-2654',
    '55555555-5555-5555-5555-555555555555',
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    'qualification',
    'pending',
    'qualify-agent'
) ON CONFLICT (id) DO NOTHING;

-- TEST EMAIL EXCLUSION
INSERT INTO email_exclusions (id, email, reason, bounce_type)
VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    'bounced@invalid.com',
    'bounce',
    'hard'
) ON CONFLICT (id) DO NOTHING;

-- TEST DEAL PACKAGE
INSERT INTO deal_packages (
    id, company_id, property_id, qualification_data_id,
    package_json, status
)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '55555555-5555-5555-5555-555555555555',
    '44444444-4444-4444-4444-444444444444',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '{
        "deal_id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "property": {
            "address": "1234 Industrial Way, Phoenix, AZ 85001",
            "type": "Industrial",
            "size_sqft": 45000,
            "lot_acres": 2.5,
            "year_built": 1995,
            "class": "B"
        },
        "financials": {
            "asking_price": 21900000,
            "noi": 1195000,
            "cap_rate": 0.0546,
            "price_per_sf": 486.67
        },
        "seller": {
            "company": "Test Seller Properties LLC",
            "motivation": "Estate planning - principal retiring",
            "timeline": "90 days to close preferred",
            "decision_maker": "John Smith (confirmed)"
        },
        "deal_thesis": "Long-term hold owner exiting after 15+ years as part of estate planning. Principal is retiring and wants a clean close within 90 days. Property is 92.5% leased with stable industrial tenants. Seller prioritizes certainty of close over maximizing price.",
        "status": "ready"
    }',
    'ready'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

SELECT 'Phase 1 Tables Verification' AS test_section;

SELECT 'tasks' AS table_name, COUNT(*) AS count FROM tasks
UNION ALL
SELECT 'qualification_data', COUNT(*) FROM qualification_data
UNION ALL
SELECT 'email_template_variants', COUNT(*) FROM email_template_variants
UNION ALL
SELECT 'email_exclusions', COUNT(*) FROM email_exclusions
UNION ALL
SELECT 'deal_packages', COUNT(*) FROM deal_packages
UNION ALL
SELECT 'email_drafts', COUNT(*) FROM email_drafts;

-- Verify the approval_queue view works
SELECT 'Approval Queue View' AS test_section;
SELECT * FROM approval_queue LIMIT 5;

-- Verify the qualification_pipeline view works
SELECT 'Qualification Pipeline View' AS test_section;
SELECT company_name, property_address, status, pricing_fields_filled, pipeline_status
FROM qualification_pipeline
LIMIT 5;
