-- Migration: Agent metrics and extraction list management
-- Adds metrics column to agent_executions, enables upsert on extraction_lists

-- =============================================================================
-- AGENT EXECUTIONS: Add metrics column
-- =============================================================================

-- Add metrics JSONB column for structured agent-specific metrics
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS metrics JSONB;

-- Add trigger (from client_criteria_id reference)
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS trigger_entity_type TEXT;
ALTER TABLE agent_executions ADD COLUMN IF NOT EXISTS trigger_entity_id UUID;

COMMENT ON COLUMN agent_executions.metrics IS 'Agent-specific metrics. Structure varies by agent type.';
COMMENT ON COLUMN agent_executions.trigger_entity_type IS 'Entity that triggered execution (client_criteria, contact, etc.)';
COMMENT ON COLUMN agent_executions.trigger_entity_id IS 'UUID of trigger entity';

-- =============================================================================
-- EXTRACTION LISTS: Enable upsert by adding unique constraint
-- =============================================================================

-- Add status to track sample vs final extractions
ALTER TABLE extraction_lists ADD COLUMN IF NOT EXISTS status TEXT
    DEFAULT 'active' CHECK (status IN ('sample', 'active', 'superseded'));

-- Add unique constraint for upsert (one active list per criteria + query_index)
-- First drop if exists (idempotent)
DROP INDEX IF EXISTS idx_extraction_lists_criteria_query;
CREATE UNIQUE INDEX idx_extraction_lists_criteria_query
    ON extraction_lists(client_criteria_id, query_index)
    WHERE status = 'active';

-- =============================================================================
-- SOURCING STRATEGIES: Seed with default strategies
-- =============================================================================

-- Insert default strategies (if not exists)
INSERT INTO sourcing_strategies (name, category, description, filter_template, is_active)
VALUES
    -- Hold Period Plays
    ('Institutional Long Hold', 'hold_period',
     'Institutional owners (REITs, pension funds, insurance) past typical 5-8 year hold period. Properties acquired 5+ years ago with professional ownership ready to exit.',
     '{"LastSoldDate": {"Maximum": "5_YEARS_AGO"}, "OwnerTypes": [1,2,7,8,10,11,13,15,19,21], "Building": {"PercentLeased": {"Minimum": "80"}}}',
     true),

    ('Private Long Hold', 'hold_period',
     'Individual and trust owners who have held 10+ years. Often estate planning or retirement triggers. More negotiable on price.',
     '{"LastSoldDate": {"Maximum": "10_YEARS_AGO"}, "OwnerTypes": [3,17,18,20]}',
     true),

    ('PE Fund Exit Window', 'hold_period',
     'Private equity and investment managers at end of typical 5-7 year fund cycle. Must return capital to LPs.',
     '{"LastSoldDate": {"Minimum": "7_YEARS_AGO", "Maximum": "5_YEARS_AGO"}, "OwnerTypes": [11,21]}',
     true),

    ('REIT Capital Recycling', 'hold_period',
     'REITs shedding non-core assets to redeploy capital. Often smaller assets that no longer fit strategy.',
     '{"LastSoldDate": {"Maximum": "5_YEARS_AGO"}, "OwnerTypes": [2,19]}',
     true),

    -- Financial Distress Plays
    ('Loan Maturity Wall', 'financial_distress',
     'Properties with loans maturing in next 12-24 months facing refinance pressure in higher rate environment.',
     '{"Loan": {"HasLoan": true, "MaturityDate": {"Minimum": "NOW", "Maximum": "24_MONTHS"}, "InterestRateTypes": [1], "InterestRate": {"Maximum": "5"}}}',
     true),

    ('CMBS Watchlist', 'financial_distress',
     'CMBS loans on watchlist status - early warning of financial stress. Owners motivated to sell before special servicing.',
     '{"Loan": {"HasLoan": true, "WatchlistStatuses": [1]}}',
     true),

    ('CMBS Special Servicing', 'financial_distress',
     'Properties in active special servicing - distressed but not yet foreclosed. High motivation, complex process.',
     '{"Loan": {"HasLoan": true, "SpecialServicingStatuses": [1]}}',
     true),

    ('High LTV Stress', 'financial_distress',
     'Overleveraged properties with LTV > 70%. Refinancing difficult, may need to sell to pay down debt.',
     '{"Loan": {"HasLoan": true, "LtvCurrent": {"Minimum": "70"}}}',
     true),

    ('Low DSCR Stress', 'financial_distress',
     'Properties with weak DSCR (< 1.25) indicating cash flow pressure. Negative carry situation.',
     '{"Loan": {"HasLoan": true, "DscrCurrent": {"Minimum": "1.0", "Maximum": "1.25"}}}',
     true),

    ('Payment Delinquent', 'financial_distress',
     'Properties with 30-90 day delinquent loans. Active distress requiring immediate attention.',
     '{"Loan": {"HasLoan": true, "PaymentStatuses": [2,3,4]}}',
     true),

    ('Maturity Default', 'financial_distress',
     'Loans past maturity date that failed to refinance. Very motivated sellers.',
     '{"Loan": {"HasLoan": true, "PaymentStatuses": [5]}}',
     true),

    ('Foreclosure', 'financial_distress',
     'Properties in active foreclosure proceedings. Complex but highly motivated.',
     '{"Loan": {"HasLoan": true, "PaymentStatuses": [6]}}',
     true),

    ('REO Bank Owned', 'financial_distress',
     'Bank-owned properties post-foreclosure. Banks want to dispose quickly.',
     '{"Loan": {"PaymentStatuses": [9]}}',
     true),

    -- Property Distress Plays
    ('High Vacancy', 'property_distress',
     'Properties with 25%+ vacancy creating cash flow pressure. Sellers may lack capital to re-lease.',
     '{"Building": {"PercentLeased": {"Maximum": "75"}}}',
     true),

    ('Moderate Vacancy Value-Add', 'property_distress',
     'Properties with 70-85% occupancy - stabilized enough for financing but with upside and seller motivation.',
     '{"Building": {"PercentLeased": {"Minimum": "70", "Maximum": "85"}}}',
     true),

    ('Deferred Maintenance', 'property_distress',
     'Aging Class B/C assets (25+ years old) likely needing capital. Owners may prefer to sell vs invest.',
     '{"Building": {"YearBuilt": {"Maximum": "25_YEARS_AGO"}, "BuildingClasses": ["B", "C"]}}',
     true),

    ('Owner Occupied Exit', 'property_distress',
     'Owner-occupied properties where owner may do sale-leaseback or is closing/relocating business.',
     '{"IsOwnerOccupied": true}',
     true)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    filter_template = EXCLUDED.filter_template,
    is_active = EXCLUDED.is_active;

-- =============================================================================
-- AGENT METRICS DEFINITIONS (reference table)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_metric_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'ratio', 'duration')),
    description TEXT,
    unit TEXT,  -- 'count', 'percent', 'ms', 'seconds'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(agent_name, metric_name)
);

-- Seed metric definitions for each agent
INSERT INTO agent_metric_definitions (agent_name, metric_name, metric_type, description, unit)
VALUES
    -- Sourcing Agent Metrics
    ('sourcing-agent', 'queries_generated', 'counter', 'Number of CoStar queries generated', 'count'),
    ('sourcing-agent', 'properties_found', 'counter', 'Total properties returned across all queries', 'count'),
    ('sourcing-agent', 'contacts_found', 'counter', 'Contacts with email addresses found', 'count'),
    ('sourcing-agent', 'contact_yield_rate', 'ratio', 'Percentage of properties with contactable owners', 'percent'),
    ('sourcing-agent', 'iterations', 'counter', 'Number of query adjustment iterations', 'count'),
    ('sourcing-agent', 'markets_covered', 'counter', 'Number of distinct markets in queries', 'count'),
    ('sourcing-agent', 'strategies_used', 'counter', 'Number of distinct sourcing strategies applied', 'count'),

    -- Outreach Copy Gen Metrics
    ('outreach-copy-gen', 'emails_generated', 'counter', 'Number of email copies generated', 'count'),
    ('outreach-copy-gen', 'templates_used', 'counter', 'Distinct templates used', 'count'),
    ('outreach-copy-gen', 'personalization_tokens', 'counter', 'Total personalization tokens filled', 'count'),
    ('outreach-copy-gen', 'avg_email_length', 'gauge', 'Average email word count', 'count'),
    ('outreach-copy-gen', 'subject_variants', 'counter', 'Subject line variations created', 'count'),

    -- Drip Campaign Exec Metrics
    ('drip-campaign-exec', 'emails_sent', 'counter', 'Total emails successfully sent', 'count'),
    ('drip-campaign-exec', 'emails_failed', 'counter', 'Emails that failed to send', 'count'),
    ('drip-campaign-exec', 'send_success_rate', 'ratio', 'Percentage of emails sent successfully', 'percent'),
    ('drip-campaign-exec', 'avg_send_time', 'duration', 'Average time to send each email', 'ms'),
    ('drip-campaign-exec', 'batch_duration', 'duration', 'Total time to process batch', 'seconds'),

    -- Response Classifier Metrics
    ('response-classifier', 'responses_classified', 'counter', 'Total responses classified', 'count'),
    ('response-classifier', 'interested_count', 'counter', 'Responses classified as interested', 'count'),
    ('response-classifier', 'not_interested_count', 'counter', 'Responses classified as not interested', 'count'),
    ('response-classifier', 'ooo_count', 'counter', 'Out of office responses', 'count'),
    ('response-classifier', 'bounce_count', 'counter', 'Bounced emails detected', 'count'),
    ('response-classifier', 'avg_confidence', 'gauge', 'Average classification confidence score', 'percent'),
    ('response-classifier', 'manual_review_needed', 'counter', 'Classifications flagged for manual review', 'count'),

    -- Deal Packager Metrics
    ('deal-packager', 'deals_packaged', 'counter', 'Number of deals packaged', 'count'),
    ('deal-packager', 'properties_per_deal', 'gauge', 'Average properties per deal package', 'count'),
    ('deal-packager', 'documents_generated', 'counter', 'Total documents created', 'count'),
    ('deal-packager', 'packaging_duration', 'duration', 'Time to package each deal', 'seconds')

ON CONFLICT (agent_name, metric_name) DO UPDATE SET
    description = EXCLUDED.description,
    metric_type = EXCLUDED.metric_type,
    unit = EXCLUDED.unit;

-- Enable RLS on new table
ALTER TABLE agent_metric_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read agent_metric_definitions"
    ON agent_metric_definitions FOR SELECT
    USING (auth.role() = 'authenticated');

-- =============================================================================
-- VIEWS: Agent performance summary
-- =============================================================================

DROP VIEW IF EXISTS agent_performance_summary;

CREATE VIEW agent_performance_summary
WITH (security_invoker = true) AS
SELECT
    ae.agent_name,
    COUNT(*) AS total_executions,
    COUNT(*) FILTER (WHERE ae.status = 'completed') AS successful_executions,
    COUNT(*) FILTER (WHERE ae.status = 'failed') AS failed_executions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE ae.status = 'completed') / NULLIF(COUNT(*), 0), 1) AS success_rate,
    AVG(ae.duration_ms) AS avg_duration_ms,
    AVG(ae.input_tokens + ae.output_tokens) AS avg_tokens,
    MAX(ae.completed_at) AS last_execution,
    -- Aggregate metrics (example for sourcing-agent)
    AVG((ae.metrics->>'properties_found')::int) AS avg_properties_found,
    AVG((ae.metrics->>'contacts_found')::int) AS avg_contacts_found,
    AVG((ae.metrics->>'contact_yield_rate')::float) AS avg_contact_yield_rate
FROM agent_executions ae
WHERE ae.created_at > NOW() - INTERVAL '30 days'
GROUP BY ae.agent_name;

COMMENT ON VIEW agent_performance_summary IS 'Aggregated agent performance metrics for last 30 days';
