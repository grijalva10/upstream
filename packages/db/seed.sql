-- Upstream Sourcing Engine Seed Data
-- Sourcing strategies and major US markets

-- =============================================================================
-- SOURCING STRATEGIES
-- =============================================================================

INSERT INTO sourcing_strategies (name, category, description, filter_template, is_active) VALUES

-- Hold Period Plays
('Institutional Hold Maturity', 'hold_period',
 'Institutions average 7.6 year hold period. Target 5-8+ year ownership.',
 '{"Property": {"OwnerTypes": [3,6,7,10,13,16,17,22,24,25], "LastSoldDate": {"Maximum": "{{5_YEARS_AGO}}"}}}',
 TRUE),

('Private Long Hold', 'hold_period',
 'Private owners with 10+ year holds often motivated by estate planning, retirement.',
 '{"Property": {"OwnerTypes": [1,2,4,5,8,9,11,12,14,15,18,19,20,21,23], "LastSoldDate": {"Maximum": "{{10_YEARS_AGO}}"}}}',
 TRUE),

('PE/Fund Exit Window', 'hold_period',
 'PE funds have 7-10 year fund life. Target Investment Managers past hold period.',
 '{"Property": {"OwnerTypes": [16], "LastSoldDate": {"Maximum": "{{7_YEARS_AGO}}"}}}',
 TRUE),

('REIT Capital Recycling', 'hold_period',
 'REITs divesting non-core assets to redeploy capital.',
 '{"Property": {"OwnerTypes": [17,24,25], "LastSoldDate": {"Maximum": "{{5_YEARS_AGO}}"}}}',
 TRUE),

-- Financial Distress Plays
('Loan Maturity Wall', 'financial_distress',
 'Loans maturing in next 12-24 months facing refinance challenges.',
 '{"Property": {"Loan": {"HasLoan": true, "MaturityDate": {"Minimum": "{{NOW}}", "Maximum": "{{24_MONTHS}}"}}}}',
 TRUE),

('CMBS Special Servicing', 'financial_distress',
 'CMBS loans currently in special servicing - highest distress signal.',
 '{"Property": {"Loan": {"HasLoan": true, "SpecialServicingStatuses": [1]}}}',
 TRUE),

('CMBS Watchlist', 'financial_distress',
 'CMBS loans on watchlist - early warning of potential distress.',
 '{"Property": {"Loan": {"HasLoan": true, "WatchlistStatuses": [1]}}}',
 TRUE),

('Modified Loan', 'financial_distress',
 'Previously modified loans indicate past trouble, may still be fragile.',
 '{"Property": {"Loan": {"HasLoan": true, "IsModification": true}}}',
 TRUE),

('Rate Shock Risk', 'financial_distress',
 'Low fixed rate loans maturing into higher rate environment.',
 '{"Property": {"Loan": {"HasLoan": true, "InterestRateTypes": [1], "InterestRate": {"Maximum": "5"}, "MaturityDate": {"Maximum": "{{24_MONTHS}}"}}}}',
 TRUE),

('High LTV Stress', 'financial_distress',
 'Overleveraged properties with LTV > 70%, limited refinance options.',
 '{"Property": {"Loan": {"HasLoan": true, "LtvCurrent": {"Minimum": "70"}}}}',
 TRUE),

('Low DSCR Stress', 'financial_distress',
 'Properties with weak cash flow coverage (DSCR < 1.2).',
 '{"Property": {"Loan": {"HasLoan": true, "DscrCurrent": {"Maximum": "1.2"}}}}',
 TRUE),

('Balloon Maturity', 'financial_distress',
 'Loans with large balloon payment due soon.',
 '{"Property": {"Loan": {"HasLoan": true, "IsBalloonMaturity": true, "MaturityDate": {"Maximum": "{{24_MONTHS}}"}}}}',
 TRUE),

('Delinquent Loans', 'financial_distress',
 'Loans 30-90+ days delinquent.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [2,3,4]}}}',
 TRUE),

('Maturity Default', 'financial_distress',
 'Loans that failed to refinance at maturity.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [5]}}}',
 TRUE),

('In Foreclosure', 'financial_distress',
 'Active foreclosure proceedings.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [6]}}}',
 TRUE),

('Bankrupt', 'financial_distress',
 'Owner in bankruptcy proceedings.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [8]}}}',
 TRUE),

('REO', 'financial_distress',
 'Bank-owned real estate, lender motivated to sell.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [9]}}}',
 TRUE),

('All Distressed', 'financial_distress',
 'Any distress signal - broad search for motivated sellers.',
 '{"Property": {"Loan": {"HasLoan": true, "PaymentStatuses": [2,3,4,5,6,8,9]}}}',
 TRUE),

-- Property Distress Plays
('High Vacancy', 'property_distress',
 'Properties with less than 75% leased, cash flow pressure.',
 '{"Property": {"Building": {"PercentLeased": {"Maximum": "75"}}}}',
 TRUE),

('Deferred Maintenance', 'property_distress',
 'Older Class B/C buildings likely needing capital investment.',
 '{"Property": {"Building": {"BuiltEventDate": {"Maximum": {"Year": "2000"}}, "BuildingClasses": ["B", "C"]}}}',
 TRUE),

('Owner-Occupied Exit', 'property_distress',
 'Owner-occupied properties, potential sale-leaseback candidates.',
 '{"Property": {"IsOwnerOccupied": true}}',
 TRUE),

-- Equity Plays
('Appreciation Play', 'equity',
 'Properties bought 5-10 years ago at low basis, significant appreciation.',
 '{"Property": {"LastSoldDate": {"Minimum": "{{10_YEARS_AGO}}", "Maximum": "{{5_YEARS_AGO}}"}}}',
 TRUE),

('Low Basis Long Hold', 'equity',
 'Properties held 15+ years with maximum unrealized gains.',
 '{"Property": {"LastSoldDate": {"Maximum": "{{15_YEARS_AGO}}"}}}',
 TRUE);

-- =============================================================================
-- MARKETS (Top US CRE Markets)
-- =============================================================================

INSERT INTO markets (id, name, state) VALUES
-- Top 25 Markets
(1805, 'Atlanta', 'GA'),
(159, 'Austin', 'TX'),
(162, 'Baltimore', 'MD'),
(209, 'Boston', 'MA'),
(237, 'Charlotte', 'NC'),
(241, 'Chicago', 'IL'),
(255, 'Cincinnati', 'OH'),
(256, 'Cleveland', 'OH'),
(263, 'Columbus', 'OH'),
(275, 'Dallas/Fort Worth', 'TX'),
(291, 'Denver', 'CO'),
(294, 'Detroit', 'MI'),
(373, 'Houston', 'TX'),
(386, 'Indianapolis', 'IN'),
(403, 'Kansas City', 'MO'),
(424, 'Las Vegas', 'NV'),
(430, 'Los Angeles', 'CA'),
(457, 'Miami', 'FL'),
(463, 'Milwaukee', 'WI'),
(465, 'Minneapolis', 'MN'),
(477, 'Nashville', 'TN'),
(488, 'New Jersey - Central', 'NJ'),
(490, 'New Jersey - Northern', 'NJ'),
(494, 'New York City', 'NY'),
(533, 'Oakland/East Bay', 'CA'),
(553, 'Orange County', 'CA'),
(554, 'Orlando', 'FL'),
(570, 'Philadelphia', 'PA'),
(573, 'Phoenix', 'AZ'),
(582, 'Pittsburgh', 'PA'),
(586, 'Portland', 'OR'),
(608, 'Raleigh/Durham', 'NC'),
(627, 'Richmond', 'VA'),
(636, 'Sacramento', 'CA'),
(646, 'Salt Lake City', 'UT'),
(648, 'San Antonio', 'TX'),
(650, 'San Diego', 'CA'),
(652, 'San Francisco', 'CA'),
(654, 'San Jose', 'CA'),
(661, 'Seattle', 'WA'),
(685, 'St. Louis', 'MO'),
(716, 'Tampa', 'FL'),
(752, 'Washington DC', 'DC'),

-- Additional Important Markets
(141, 'Asheville', 'NC'),
(161, 'Bakersfield', 'CA'),
(183, 'Bellingham', 'WA'),
(185, 'Bend', 'OR'),
(204, 'Boise', 'ID'),
(235, 'Charleston', 'SC'),
(341, 'Fort Myers', 'FL'),
(393, 'Jacksonville', 'FL'),
(468, 'Mobile', 'AL'),
(495, 'New Orleans', 'LA'),
(523, 'Norfolk/VA Beach', 'VA'),
(543, 'Omaha', 'NE'),
(598, 'Providence', 'RI'),
(622, 'Reno', 'NV'),
(639, 'Sarasota', 'FL'),
(658, 'Savannah', 'GA'),
(695, 'Syracuse', 'NY'),
(700, 'Tallahassee', 'FL'),
(718, 'Tucson', 'AZ'),
(722, 'Tulsa', 'OK'),
(757, 'West Palm Beach', 'FL'),
(763, 'Wilmington', 'NC');

-- =============================================================================
-- AGENT DEFINITIONS
-- =============================================================================

INSERT INTO agent_definitions (name, description, model, tools, file_path, is_active) VALUES
('query-builder', 'Translate buyer criteria or sourcing strategies into CoStar API payloads', 'sonnet', ARRAY['Read', 'Grep', 'Glob'], '.claude/agents/query-builder.md', TRUE),
('csv-importer', 'Process CoStar extraction CSV files into database with deduplication', 'sonnet', ARRAY['Read', 'Bash', 'Grep'], '.claude/agents/csv-importer.md', FALSE),
('outreach-writer', 'Generate personalized cold outreach emails based on property/owner context', 'sonnet', ARRAY['Read', 'Grep'], '.claude/agents/outreach-writer.md', FALSE),
('reply-classifier', 'Analyze inbound email replies to classify intent and sentiment', 'haiku', ARRAY['Read'], '.claude/agents/reply-classifier.md', FALSE),
('contact-enricher', 'Enrich contact records with additional data from public sources', 'haiku', ARRAY['WebSearch', 'WebFetch'], '.claude/agents/contact-enricher.md', FALSE),
('status-updater', 'Update company/contact status based on engagement signals', 'haiku', ARRAY['Read'], '.claude/agents/status-updater.md', FALSE);

-- =============================================================================
-- DEFAULT SETTINGS
-- =============================================================================

INSERT INTO settings (key, value) VALUES
('email_tracking_enabled', 'false'),
('default_sequence_timezone', '"America/Los_Angeles"'),
('costar_session_cookie', 'null'),
('lee1031x_integration', '{"enabled": false, "mode": "shared_supabase"}');

-- =============================================================================
-- SAMPLE EMAIL TEMPLATES
-- =============================================================================

INSERT INTO email_templates (name, subject, body_html, body_text, category, is_active) VALUES
('distress_opener',
 'Quick question about {{property.address}}',
 '<p>Hi {{contact.first_name}},</p>
<p>I noticed {{property.address}} has some upcoming loan maturity considerations. We work with investors who specialize in these situations and can offer flexible terms.</p>
<p>Would you have 15 minutes to discuss your plans for the property?</p>
<p>Best,<br>{{user.name}}</p>',
 'Hi {{contact.first_name}},

I noticed {{property.address}} has some upcoming loan maturity considerations. We work with investors who specialize in these situations and can offer flexible terms.

Would you have 15 minutes to discuss your plans for the property?

Best,
{{user.name}}',
 'cold_outreach', TRUE),

('hold_period_opener',
 'Regarding your {{property.type}} at {{property.address}}',
 '<p>Hi {{contact.first_name}},</p>
<p>I see you''ve owned {{property.address}} for several years now. Given where the market is, this could be an opportune time to explore options.</p>
<p>We have buyers actively looking for {{property.type}} assets in {{property.market}} - would you be open to a quick conversation about current valuations?</p>
<p>Best,<br>{{user.name}}</p>',
 'Hi {{contact.first_name}},

I see you''ve owned {{property.address}} for several years now. Given where the market is, this could be an opportune time to explore options.

We have buyers actively looking for {{property.type}} assets in {{property.market}} - would you be open to a quick conversation about current valuations?

Best,
{{user.name}}',
 'cold_outreach', TRUE),

('follow_up_1',
 'Following up - {{property.address}}',
 '<p>Hi {{contact.first_name}},</p>
<p>Just circling back on my previous note about {{property.address}}. Happy to work around your schedule if you''d like to chat.</p>
<p>Best,<br>{{user.name}}</p>',
 'Hi {{contact.first_name}},

Just circling back on my previous note about {{property.address}}. Happy to work around your schedule if you''d like to chat.

Best,
{{user.name}}',
 'follow_up', TRUE),

('follow_up_2',
 'One more try - {{property.address}}',
 '<p>Hi {{contact.first_name}},</p>
<p>I don''t want to be a pest, but wanted to reach out one more time. If you''re not interested in discussing {{property.address}} right now, no worries - just let me know and I''ll take you off my list.</p>
<p>Best,<br>{{user.name}}</p>',
 'Hi {{contact.first_name}},

I don''t want to be a pest, but wanted to reach out one more time. If you''re not interested in discussing {{property.address}} right now, no worries - just let me know and I''ll take you off my list.

Best,
{{user.name}}',
 'follow_up', TRUE);

-- =============================================================================
-- SAMPLE SEQUENCES
-- =============================================================================

INSERT INTO sequences (name, description, status, schedule, timezone, stop_on_reply) VALUES
('Distress Outreach - 3 Touch',
 'Standard 3-email sequence for distressed property owners',
 'active',
 '{"ranges": [{"weekday": 1, "start": "09:00", "end": "17:00"}, {"weekday": 2, "start": "09:00", "end": "17:00"}, {"weekday": 3, "start": "09:00", "end": "17:00"}, {"weekday": 4, "start": "09:00", "end": "17:00"}, {"weekday": 5, "start": "09:00", "end": "17:00"}]}',
 'America/Los_Angeles',
 TRUE);

-- Get the sequence ID for steps
WITH seq AS (SELECT id FROM sequences WHERE name = 'Distress Outreach - 3 Touch')
INSERT INTO sequence_steps (sequence_id, step_order, step_type, delay_seconds, email_template_id, threading)
SELECT
    seq.id,
    step_order,
    'email',
    delay_seconds,
    (SELECT id FROM email_templates WHERE name = template_name),
    threading
FROM seq, (VALUES
    (1, 0, 'distress_opener', 'new_thread'),
    (2, 259200, 'follow_up_1', 'old_thread'),  -- 3 days
    (3, 432000, 'follow_up_2', 'old_thread')   -- 5 days after previous
) AS steps(step_order, delay_seconds, template_name, threading);

-- =============================================================================
-- SAMPLE WORKFLOWS
-- =============================================================================

INSERT INTO agent_workflows (name, description, trigger_type, trigger_config, is_active) VALUES
('distress_sourcing_pipeline',
 'End-to-end workflow: query CoStar, import CSV, enrich contacts, launch sequence',
 'manual',
 '{"required_inputs": ["strategy", "market", "property_type"]}',
 TRUE),

('reply_processing',
 'Classify inbound replies and update contact/company status',
 'event',
 '{"event": "email_received"}',
 TRUE);

-- Get workflow IDs for steps
WITH distress_wf AS (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline'),
     reply_wf AS (SELECT id FROM agent_workflows WHERE name = 'reply_processing')

INSERT INTO agent_workflow_steps (workflow_id, step_order, step_name, step_type, agent_definition_id, input_mapping, output_mapping, on_success, on_failure)
SELECT workflow_id, step_order, step_name, step_type,
       (SELECT id FROM agent_definitions WHERE name = agent_name),
       input_mapping::jsonb, output_mapping::jsonb, on_success, on_failure
FROM (
    -- Distress sourcing steps
    SELECT (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline') as workflow_id,
           1 as step_order, 'Build CoStar Query' as step_name, 'agent' as step_type,
           'query-builder' as agent_name,
           '{"prompt": "Build query for {{trigger.strategy}} in {{trigger.market}} for {{trigger.property_type}}"}' as input_mapping,
           '{"payload": "$.response"}' as output_mapping,
           'next' as on_success, 'abort' as on_failure
    UNION ALL
    SELECT (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline'),
           2, 'Manual CSV Export', 'wait_manual', NULL,
           '{"message": "Export CSV from CoStar using the payload above"}', '{}', 'next', 'abort'
    UNION ALL
    SELECT (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline'),
           3, 'Import CSV', 'agent', 'csv-importer',
           '{"file": "{{context.csv_path}}"}', '{"extraction_id": "$.extraction_id", "new_contacts": "$.new_contacts"}', 'next', 'abort'
    UNION ALL
    SELECT (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline'),
           4, 'Enrich Contacts', 'agent', 'contact-enricher',
           '{"contacts": "{{context.new_contacts}}"}', '{}', 'next', 'skip'
    UNION ALL
    SELECT (SELECT id FROM agent_workflows WHERE name = 'distress_sourcing_pipeline'),
           5, 'Write Outreach', 'agent', 'outreach-writer',
           '{"contacts": "{{context.new_contacts}}", "template": "distress_opener"}', '{}', 'complete', 'abort'
    UNION ALL
    -- Reply processing steps
    SELECT (SELECT id FROM agent_workflows WHERE name = 'reply_processing'),
           1, 'Classify Reply', 'agent', 'reply-classifier',
           '{"email": "{{trigger.email}}"}', '{"intent": "$.classification", "sentiment": "$.sentiment"}', 'next', 'abort'
    UNION ALL
    SELECT (SELECT id FROM agent_workflows WHERE name = 'reply_processing'),
           2, 'Update Status', 'agent', 'status-updater',
           '{"contact": "{{context.contact}}", "intent": "{{context.intent}}"}', '{}', 'complete', 'abort'
) AS workflow_steps;
