-- Enable RLS on all tables
-- Single-tenant app: authenticated users have full access

-- Enable RLS on all tables
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sourcing_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE extraction_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_execution_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workflow_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE synced_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users have full access (single-tenant app)
-- Read-only reference tables (no auth required for select)
CREATE POLICY "Markets are viewable by everyone" ON markets FOR SELECT USING (true);
CREATE POLICY "Sourcing strategies are viewable by everyone" ON sourcing_strategies FOR SELECT USING (true);

-- All other tables require authentication
CREATE POLICY "Authenticated users have full access" ON properties FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON companies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON property_loans FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON property_companies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON extraction_lists FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON list_properties FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON email_templates FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON sequences FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON sequence_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON sequence_subscriptions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON activities FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON dnc_entries FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_definitions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_executions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_tasks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_execution_context FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_workflows FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_workflow_steps FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_workflow_runs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON agent_workflow_step_runs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON email_sync_state FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON synced_emails FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users have full access" ON email_events FOR ALL USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage reference tables too
CREATE POLICY "Authenticated users can manage markets" ON markets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can manage strategies" ON sourcing_strategies FOR ALL USING (auth.role() = 'authenticated');
