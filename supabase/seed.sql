-- Upstream Sourcing Engine Seed Data
-- Markets, agents, templates, sequences
-- NOTE: Sourcing strategies are now seeded in migration 00005_agent_metrics.sql

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
