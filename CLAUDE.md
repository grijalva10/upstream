# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Upstream Sourcing Engine - AI agents that help find off-market CRE deals. See `PRD.md` for the simple version, `docs/upstream-spec.md` for the detailed IP spec.

## Current Focus

**Core Pipeline Operational, Qualification Features Pending.**

The sourcing and outreach pipeline is functional with worker jobs handling most automation. Some originally planned agents are implemented as inline worker job logic instead. See `docs/pipeline-integration.md` for the flow.

**What's working:**
- Sourcing: `@sourcing-agent` generates CoStar queries from buyer criteria
- Outreach: `@outreach-copy-gen` creates personalized email sequences
- Email sync: Worker job pulls replies from Outlook
- Classification: Inline in `process-replies` job (simplified 5-category system)
- Auto-operations: Follow-ups and ghost detection run daily

**Not yet implemented:**
- Qualification tracking agent (manual process currently)
- Call scheduling agent (manual process currently)
- Deal packaging agent (manual process currently)

For CoStar API reference, the filter mappings in `reference/costar/` may still need validation against real queries.

## Project Structure

```
upstream/
├── .claude/agents/      # Subagent definitions (2 active + templates)
├── apps/web/            # Next.js UI
├── apps/worker/         # Background job processing (pg-boss)
├── packages/claude-cli/ # Shared TypeScript wrapper for Claude CLI
├── packages/db/         # Supabase schema source files
├── packages/shared/     # Shared types (placeholder)
├── integrations/costar/ # CoStar data extraction service
├── reference/costar/    # CoStar API lookups and payload docs
├── supabase/            # Supabase local dev (migrations, seed, config)
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── PRD.md               # High-level product requirements
└── CLAUDE.md            # This file
```

## Claude CLI Integration

All AI functionality uses the `@upstream/claude-cli` package, a TypeScript wrapper around the Claude CLI:

```typescript
// Batch mode (for worker jobs)
import { runBatch } from '@upstream/claude-cli';

const result = await runBatch({
  prompt: 'Classify this email...',
  maxTurns: 1,
  timeout: 60000,
  cwd: projectRoot,
});

// Simple mode (for quick queries)
import { runSimple } from '@upstream/claude-cli';

const response = await runSimple('What is 2 + 2?');
```

### CLI Flags Reference

| Flag | Purpose |
|------|---------|
| `-p` | Print mode (non-interactive) |
| `--output-format json` | Structured JSON response |
| `--output-format stream-json` | Streaming JSON events |
| `--max-turns N` | Limit agentic loops |
| `--resume <id>` | Continue conversation |
| `--allowedTools "Read,Write"` | Restrict tools |
| `--system-prompt "..."` | Custom system prompt |

## Agents & Worker Jobs

### Active Subagents

| Agent | Purpose |
|-------|---------|
| `@sourcing-agent` | Analyzes buyer criteria → strategy + CoStar payloads |
| `@outreach-copy-gen` | Generates personalized 3-email cold outreach sequences |

### Worker Jobs (pg-boss)

Most automation is handled by scheduled worker jobs in `apps/worker/`:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `email-sync` | Every 5 min | Pull emails from Outlook |
| `process-replies` | Every 2 min | Classify + act on inbound emails |
| `process-queue` | Every 1 min | Dequeue outbound emails |
| `send-email` | On demand | Send via Outlook COM |
| `generate-queries` | On demand | Run sourcing agent |
| `auto-follow-up` | Daily 9 AM | Send follow-ups for pending docs |
| `ghost-detection` | Daily 9:30 AM | Mark unresponsive contacts |

### Pipeline Flow
```
sourcing-agent → outreach-copy-gen → email_queue
                                          ↓
                              process-queue → send-email → [sent]
                                                             ↓
email-sync ← [Outlook sync] ←─────────────────── [replies]
     ↓
process-replies → [classify + act]
     ↓
 ┌───┴───────────────────────────┐
 │ hot/question → email_drafts   │
 │ pass → DNC / status update    │
 │ bounce → email_exclusions     │
 └───────────────────────────────┘
```

### Classification Categories (process-replies job)

The production system uses 5 simplified categories:

| Code | Description | Action |
|------|-------------|--------|
| `hot` | Interested, gave pricing, wants call | Create draft reply, update deal data |
| `question` | Asking about deal/buyer/terms | Create draft answer |
| `pass` | Not interested, wrong person, has broker | Update status, add to DNC if requested |
| `bounce` | Delivery failure | Add to email_exclusions, mark contact bounced |
| `other` | OOO, newsletters, unclear | No action (filtered or logged) |

### Not Yet Implemented

These were planned but are currently manual processes:
- `qualify-agent` - Qualification tracking
- `schedule-agent` - Call scheduling
- `deal-packager` - Deal package creation

## CoStar API Reference

**Endpoint:** `POST https://product.costar.com/bff2/property/search/list-properties`

Key files:
- `reference/costar/filter-mapping-v2.json` - Filter documentation (may have errors)
- `reference/costar/payload-example.json` - Known working payload (ground truth)
- `reference/costar/owner-types.json` - ID lookup tables

**Important:** The original `filter-mapping.json` is INACCURATE. Use `filter-mapping-v2.json` but verify against `payload-example.json`.

### Payload Structure Gotchas
- `Building`, `Land`, `Parking` are NESTED inside `Property`
- Most filters use arrays of IDs, not boolean objects
- Numeric ranges use `{ "Value": 5000, "Code": "[sft_i]" }` format
- Exclusions use integers (1=exclude), not booleans

## Database (Supabase PostgreSQL)

### Local Connection
```
URL:      postgresql://postgres:postgres@127.0.0.1:55322/postgres
API:      http://127.0.0.1:55321
Studio:   http://127.0.0.1:55323
```

### Quick Commands
```bash
npx supabase start          # Start local Supabase
npx supabase stop           # Stop (preserves data)
npx supabase db reset       # Reset and re-seed
npx supabase db diff        # Generate migration from changes
```

### Schema Overview (~30 tables)

**Core Entities:**
| Table | Purpose |
|-------|---------|
| `properties` | CRE assets from CoStar (address, type, size, class) |
| `companies` | Owner organizations = leads (status: new→contacted→qualified→handed_off) |
| `contacts` | People at companies who receive outreach |
| `property_loans` | Loan/distress data (maturity, LTV, DSCR, payment status) |
| `property_companies` | Junction: property ↔ company (owner/manager/lender) |

**Searches & Sourcing:**
| Table | Purpose |
|-------|---------|
| `searches` | Search profiles with criteria JSON + generated payloads (main entity) |
| `search_properties` | Junction: search ↔ property |
| `markets` | CoStar market reference (id, name, state) |
| `sourcing_strategies` | Predefined query strategies (hold_period, financial_distress, etc.) |
| `campaigns` | Email campaigns linked to searches |

**Outreach (CRM):**
| Table | Purpose |
|-------|---------|
| `email_templates` | Reusable email templates with merge tags |
| `sequences` | Drip campaigns (schedule, timezone, stop_on_reply) |
| `sequence_steps` | Steps in a sequence (email/call/task, delay) |
| `sequence_subscriptions` | Contact enrolled in a sequence |
| `activities` | All touchpoints (email_sent, email_received, call, note) |
| `dnc_entries` | Do Not Contact list |

**Agent Automation:**
| Table | Purpose |
|-------|---------|
| `agent_definitions` | Registry of Claude agents (name, model, tools) |
| `agent_executions` | Logs of agent runs (prompt, response, tokens) |
| `agent_tasks` | Work queue for scheduled agent execution |
| `agent_workflows` | Multi-step pipelines chaining agents |
| `agent_workflow_steps` | Steps in a workflow |
| `agent_workflow_runs` | Workflow execution instances |
| `agent_workflow_step_runs` | Step execution within a run |

**Email Sync:**
| Table | Purpose |
|-------|---------|
| `email_sync_state` | Outlook sync cursor (last_sync_at, last_entry_id) |
| `synced_emails` | Raw emails synced from Outlook |

**Qualification Pipeline (new):**
| Table | Purpose |
|-------|---------|
| `tasks` | Call reminders, follow-ups, review tasks |
| `qualification_data` | Tracks pricing, motivation, decision maker per deal |
| `email_template_variants` | A/B testing for email templates |
| `email_exclusions` | Permanent exclusion list (bounces, hard passes) |
| `deal_packages` | Packaged qualified deals for handoff |
| `email_drafts` | Approval queue for agent-generated emails |

**Other:**
| Table | Purpose |
|-------|---------|
| `users` | App users |
| `settings` | Config key-value store |
| `email_events` | Open/click tracking events |

### Key Relationships
```
searches → search_properties → properties (via search_properties junction)
properties ←→ companies (via property_companies)
companies → contacts (1:many)
properties → property_loans (1:many)
contacts → sequence_subscriptions → sequences
activities → contacts, companies, properties
searches → campaigns (1:many)
```

### Key Status Flows
- **Company**: `new` → `contacted` → `engaged` → `qualified` → `handed_off` | `dnc` | `rejected`
- **Contact**: `active` → `dnc` | `bounced` | `unsubscribed`
- **Sequence Subscription**: `active` → `completed` | `replied` | `unsubscribed`

## Local Requirements

These MUST run on the operator's machine:
1. **costar-extract** - Requires 2FA via mobile phone
2. **Outlook COM** - Email sending via Microsoft Outlook

## Extraction Pipeline

Full pipeline from buyer criteria to DB (uses web UI):

```
1. Create Search via web UI or API
   - POST /api/searches with criteria JSON
   - Creates search record with status 'new'

2. Run Sourcing Agent
   - POST /api/searches/[id]/run-agent
   - Generates payloads_json and strategy_summary
   - Updates search status to 'ready'

3. Run Extraction (requires local CoStar service)
   - POST /api/searches/[id]/run-extraction
   - Calls CoStar service (requires 2FA)
   - Saves properties, companies, contacts
   - Links via search_properties junction

4. Properties linked via:
   searches → search_properties → properties → companies → contacts
```

### Running via Web UI

1. Go to `/searches` page
2. Click "New Search" and enter buyer criteria
3. Click "Run Agent" to generate CoStar payloads
4. Click "Run Extraction" (requires CoStar service running locally)
5. View results in the search detail page

### API Endpoints

```bash
# Create a new search
POST /api/searches
{ "name": "Test Search", "criteria_json": {...} }

# Generate payloads (run sourcing agent)
POST /api/searches/[id]/run-agent

# Run extraction (requires CoStar service)
POST /api/searches/[id]/run-extraction
```

## Development Approach

1. Work through pipeline stages one at a time
2. Validate each stage works before moving on
3. Add infrastructure (Supabase, UI) only when needed
4. Subagents evolve as we learn what works

## Commands

```bash
# Development (starts web, worker, and CoStar service)
npm run dev                 # Starts all services via scripts/dev.ps1

# Individual services
npm run dev:web            # Start Next.js web app
npm run dev:worker         # Start pg-boss worker

# Supabase
npx supabase start          # Start local instance
npx supabase stop           # Stop (keeps data)
npx supabase db reset       # Reset DB and apply migrations + seed

# Direct DB access (when Supabase is running)
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
```

## MCP Integration

If using Supabase MCP server, add to Claude settings:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server", "--url", "http://127.0.0.1:55321"]
    }
  }
}
```

This enables Claude to query the database directly via MCP tools.

## User Preferences

- **Outbound emails**: Do NOT include signature - Outlook auto-adds it

## Critical Rules

### Database Protection
**NEVER reset the database without:**
1. Creating a backup first that can be used to restore
2. Explicitly asking the user for permission before resetting

To backup the database:
```bash
pg_dump postgresql://postgres:postgres@127.0.0.1:55322/postgres > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore from backup:
```bash
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres < backup_YYYYMMDD_HHMMSS.sql
```
