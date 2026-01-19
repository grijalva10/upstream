/**
 * Upstream Sourcing Engine Database Types
 * Auto-generated from schema.sql - manual updates may be overwritten
 */

// =============================================================================
// ENUMS
// =============================================================================

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'engaged'
  | 'qualified'
  | 'handed_off'
  | 'dnc'
  | 'rejected';

// Alias for backwards compatibility
export type CompanyStatus = LeadStatus;

export type ContactStatus =
  | 'active'
  | 'dnc'
  | 'bounced'
  | 'unsubscribed';

export type LeadSource =
  | 'costar'
  | 'manual'
  | 'referral';

// Alias for backwards compatibility
export type CompanySource = LeadSource;

export type PropertyRelationship =
  | 'owner'
  | 'manager'
  | 'lender';

export type LoanType =
  | 'acquisition'
  | 'refinance'
  | 'construction'
  | 'conventional'
  | 'bridge'
  | 'cmbs'
  | 'other';

export type InterestRateType =
  | 'fixed'
  | 'variable';

export type PaymentStatus =
  | 'performing'
  | '30_day'
  | '60_day'
  | '90_day'
  | 'maturity_default'
  | 'foreclosure'
  | 'bankrupt'
  | 'reo'
  | 'defeased';

export type ServicingStatus =
  | 'current'
  | 'previous'
  | 'never';

export type SourcingCategory =
  | 'hold_period'
  | 'financial_distress'
  | 'property_distress'
  | 'equity';

export type EmailTemplateCategory =
  | 'cold_outreach'
  | 'follow_up'
  | 'nurture'
  | 'closing';


export type ActivityType =
  | 'email_sent'
  | 'email_received'
  | 'email_opened'
  | 'email_clicked'
  | 'call'
  | 'note'
  | 'meeting'
  | 'status_change';

export type DncReason =
  | 'requested'
  | 'bounced'
  | 'complaint'
  | 'manual';

export type AgentModel =
  | 'sonnet'
  | 'opus'
  | 'haiku';

export type AgentExecutionStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type AgentTaskType =
  | 'build_query'
  | 'import_csv'
  | 'run_sequence_step'
  | 'sync_outlook'
  | 'classify_response'
  | 'enrich_contact'
  | 'write_outreach';

export type AgentTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ContextType =
  | 'property'
  | 'company'
  | 'contact'
  | 'extraction_list';

export type WorkflowTriggerType =
  | 'manual'
  | 'schedule'
  | 'event';

export type WorkflowStepType =
  | 'agent'
  | 'wait_manual'
  | 'condition'
  | 'webhook';

export type WorkflowRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowStepRunStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'skipped';

export type EmailEventType =
  | 'open'
  | 'click';

export type EmailSyncFolder =
  | 'inbox'
  | 'sent';

export type Direction =
  | 'inbound'
  | 'outbound';

export type UserRole =
  | 'admin'
  | 'user';

// =============================================================================
// TABLE TYPES
// =============================================================================

export interface Market {
  id: number;
  name: string;
  state: string | null;
  property_type_ids: number[] | null;
  bounding_box: Record<string, unknown> | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  costar_property_id: string | null;
  address: string;
  property_name: string | null;
  property_type: string | null;
  building_size_sqft: number | null;
  lot_size_acres: number | null;
  year_built: number | null;
  building_class: string | null;
  percent_leased: number | null;
  market_id: number | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  costar_company_id: string | null;
  name: string;
  status: LeadStatus;
  status_changed_at: string;
  source: LeadSource;
  assigned_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Alias for backwards compatibility
export type Company = Lead;

export interface Contact {
  id: string;
  costar_person_id: string | null;
  lead_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
  status_changed_at: string;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyLoan {
  id: string;
  property_id: string;
  costar_loan_id: string | null;
  lender_name: string | null;
  loan_type: LoanType | null;
  original_amount: number | null;
  current_balance: number | null;
  origination_date: string | null;
  maturity_date: string | null;
  interest_rate: number | null;
  interest_rate_type: InterestRateType | null;
  ltv_original: number | null;
  ltv_current: number | null;
  dscr_current: number | null;
  payment_status: PaymentStatus | null;
  is_balloon_maturity: boolean;
  is_modification: boolean;
  special_servicing_status: ServicingStatus | null;
  watchlist_status: ServicingStatus | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyLead {
  property_id: string;
  lead_id: string;
  relationship: PropertyRelationship;
  ownership_pct: number | null;
  first_seen_at: string;
}

// Alias for backwards compatibility
export type PropertyCompany = PropertyLead;

export interface SourcingStrategy {
  id: string;
  name: string;
  category: SourcingCategory;
  description: string | null;
  filter_template: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

export interface ExtractionList {
  id: string;
  sourcing_strategy_id: string | null;
  name: string;
  payload_json: Record<string, unknown> | null;
  source_file: string | null;
  property_count: number;
  contact_count: number;
  extracted_at: string | null;
  agent_execution_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ListProperty {
  extraction_list_id: string;
  property_id: string;
  added_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string | null;
  body_text: string | null;
  category: EmailTemplateCategory | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export interface Activity {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  property_id: string | null;
  activity_type: ActivityType;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  direction: Direction | null;
  email_template_id: string | null;
  metadata: Record<string, unknown> | null;
  activity_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DncEntry {
  id: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  reason: DncReason | null;
  source: string | null;
  added_at: string;
  added_by: string | null;
  notes: string | null;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string | null;
  model: AgentModel;
  tools: string[] | null;
  file_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentExecution {
  id: string;
  agent_definition_id: string | null;
  agent_name: string | null;
  prompt: string | null;
  response: string | null;
  status: AgentExecutionStatus;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  duration_ms: number | null;
  metadata: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AgentTask {
  id: string;
  agent_definition_id: string | null;
  task_type: AgentTaskType;
  priority: number;
  status: AgentTaskStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  agent_execution_id: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentExecutionContext {
  id: string;
  agent_execution_id: string;
  context_type: ContextType;
  context_id: string;
  created_at: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  description: string | null;
  trigger_type: WorkflowTriggerType;
  trigger_config: Record<string, unknown> | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentWorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  step_name: string;
  step_type: WorkflowStepType;
  agent_definition_id: string | null;
  input_mapping: Record<string, unknown> | null;
  output_mapping: Record<string, unknown> | null;
  condition: Record<string, unknown> | null;
  timeout_seconds: number | null;
  on_success: string;
  on_failure: string;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

export interface AgentWorkflowRun {
  id: string;
  workflow_id: string;
  status: WorkflowRunStatus;
  current_step_order: number | null;
  context: Record<string, unknown>;
  trigger_source: string | null;
  error_message: string | null;
  started_at: string | null;
  paused_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentWorkflowStepRun {
  id: string;
  workflow_run_id: string;
  workflow_step_id: string;
  agent_execution_id: string | null;
  agent_task_id: string | null;
  status: WorkflowStepRunStatus;
  input_data: Record<string, unknown> | null;
  output_data: Record<string, unknown> | null;
  error_message: string | null;
  attempt_number: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EmailSyncState {
  id: string;
  folder: EmailSyncFolder;
  last_sync_at: string | null;
  last_entry_id: string | null;
  updated_at: string;
}

export interface SyncedEmail {
  id: string;
  outlook_entry_id: string;
  outlook_conversation_id: string | null;
  direction: Direction;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_read: boolean;
  has_attachments: boolean;
  matched_contact_id: string | null;
  matched_lead_id: string | null;
  linked_activity_id: string | null;
  synced_at: string;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

export interface EmailEvent {
  id: string;
  activity_id: string;
  event_type: EmailEventType;
  url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  occurred_at: string;
  created_at: string;
}

// =============================================================================
// INSERT TYPES (for creating new records)
// =============================================================================

export type PropertyInsert = Omit<Property, 'id' | 'created_at' | 'updated_at' | 'first_seen_at' | 'last_seen_at'>;
export type LeadInsert = Omit<Lead, 'id' | 'created_at' | 'updated_at' | 'status_changed_at'>;
export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'status_changed_at'>;

// Alias for backwards compatibility
export type CompanyInsert = LeadInsert;
export type PropertyLoanInsert = Omit<PropertyLoan, 'id' | 'created_at' | 'updated_at' | 'first_seen_at' | 'last_seen_at'>;
export type ExtractionListInsert = Omit<ExtractionList, 'id' | 'created_at'>;
export type ActivityInsert = Omit<Activity, 'id' | 'created_at' | 'updated_at'>;
export type AgentExecutionInsert = Omit<AgentExecution, 'id' | 'created_at'>;
export type AgentTaskInsert = Omit<AgentTask, 'id' | 'created_at' | 'updated_at'>;
export type AgentWorkflowRunInsert = Omit<AgentWorkflowRun, 'id' | 'created_at' | 'updated_at'>;

// =============================================================================
// DATABASE TYPE (Supabase-compatible)
// =============================================================================

export interface Database {
  public: {
    Tables: {
      markets: { Row: Market; Insert: Omit<Market, 'created_at'>; Update: Partial<Market> };
      users: { Row: User; Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>; Update: Partial<User> };
      properties: { Row: Property; Insert: PropertyInsert; Update: Partial<Property> };
      leads: { Row: Lead; Insert: LeadInsert; Update: Partial<Lead> };
      contacts: { Row: Contact; Insert: ContactInsert; Update: Partial<Contact> };
      property_loans: { Row: PropertyLoan; Insert: PropertyLoanInsert; Update: Partial<PropertyLoan> };
      property_leads: { Row: PropertyLead; Insert: PropertyLead; Update: Partial<PropertyLead> };
      sourcing_strategies: { Row: SourcingStrategy; Insert: Omit<SourcingStrategy, 'id' | 'created_at'>; Update: Partial<SourcingStrategy> };
      extraction_lists: { Row: ExtractionList; Insert: ExtractionListInsert; Update: Partial<ExtractionList> };
      list_properties: { Row: ListProperty; Insert: ListProperty; Update: Partial<ListProperty> };
      email_templates: { Row: EmailTemplate; Insert: Omit<EmailTemplate, 'id' | 'created_at' | 'updated_at'>; Update: Partial<EmailTemplate> };
      activities: { Row: Activity; Insert: ActivityInsert; Update: Partial<Activity> };
      dnc_entries: { Row: DncEntry; Insert: Omit<DncEntry, 'id' | 'added_at'>; Update: Partial<DncEntry> };
      agent_definitions: { Row: AgentDefinition; Insert: Omit<AgentDefinition, 'id' | 'created_at' | 'updated_at'>; Update: Partial<AgentDefinition> };
      agent_executions: { Row: AgentExecution; Insert: AgentExecutionInsert; Update: Partial<AgentExecution> };
      agent_tasks: { Row: AgentTask; Insert: AgentTaskInsert; Update: Partial<AgentTask> };
      agent_execution_context: { Row: AgentExecutionContext; Insert: Omit<AgentExecutionContext, 'id' | 'created_at'>; Update: Partial<AgentExecutionContext> };
      agent_workflows: { Row: AgentWorkflow; Insert: Omit<AgentWorkflow, 'id' | 'created_at' | 'updated_at'>; Update: Partial<AgentWorkflow> };
      agent_workflow_steps: { Row: AgentWorkflowStep; Insert: Omit<AgentWorkflowStep, 'id' | 'created_at' | 'updated_at'>; Update: Partial<AgentWorkflowStep> };
      agent_workflow_runs: { Row: AgentWorkflowRun; Insert: AgentWorkflowRunInsert; Update: Partial<AgentWorkflowRun> };
      agent_workflow_step_runs: { Row: AgentWorkflowStepRun; Insert: Omit<AgentWorkflowStepRun, 'id' | 'created_at'>; Update: Partial<AgentWorkflowStepRun> };
      email_sync_state: { Row: EmailSyncState; Insert: Omit<EmailSyncState, 'id' | 'updated_at'>; Update: Partial<EmailSyncState> };
      synced_emails: { Row: SyncedEmail; Insert: Omit<SyncedEmail, 'id' | 'created_at' | 'synced_at'>; Update: Partial<SyncedEmail> };
      settings: { Row: Setting; Insert: Omit<Setting, 'id' | 'updated_at'>; Update: Partial<Setting> };
      email_events: { Row: EmailEvent; Insert: Omit<EmailEvent, 'id' | 'created_at'>; Update: Partial<EmailEvent> };
    };
  };
}
