# packages/db

Supabase schema, migrations, and generated types.

## Files

- `schema.sql` - Table definitions (26 tables)
- `seed.sql` - Sourcing strategies, markets, agent definitions, sample templates
- `types.ts` - TypeScript types matching schema
- `migrations/` - Schema changes over time (future)

## Table Overview

### Core Entities
- `properties` - CRE assets sourced from CoStar
- `companies` - Owner organizations (leads)
- `contacts` - People at companies
- `property_loans` - Loan data for distress sourcing
- `property_companies` - Property-company relationships

### Sourcing
- `sourcing_strategies` - Predefined CoStar query strategies
- `extraction_lists` - Results of CoStar queries
- `list_properties` - Junction table for extraction lists
- `markets` - CoStar market reference data

### Outreach (CRM)
- `email_templates` - Reusable email templates
- `sequences` - Drip campaigns
- `sequence_steps` - Steps within sequences
- `sequence_subscriptions` - Contacts enrolled in sequences
- `activities` - All touchpoints (emails, calls, notes)
- `dnc_entries` - Do Not Contact list

### Agent Automation
- `agent_definitions` - Registry of Claude Code agents
- `agent_executions` - Logs of agent runs
- `agent_tasks` - Work queue for agents
- `agent_execution_context` - Links executions to entities
- `agent_workflows` - Multi-step pipelines
- `agent_workflow_steps` - Steps in workflows
- `agent_workflow_runs` - Workflow execution instances
- `agent_workflow_step_runs` - Individual step executions

### Supporting
- `users` - System users
- `email_sync_state` - Outlook sync tracking
- `synced_emails` - Raw emails from Outlook
- `settings` - Configuration key-value store
- `email_events` - Open/click tracking

## Usage

Apply schema to Supabase:
```bash
psql -h <host> -U postgres -d postgres -f schema.sql
psql -h <host> -U postgres -d postgres -f seed.sql
```

## Type Generation

The `types.ts` file is manually maintained to match `schema.sql`. After schema changes, update types accordingly.
