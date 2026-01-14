# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Upstream Sourcing Engine - AI agents that help find off-market CRE deals. See `PRD.md` for the simple version, `docs/upstream-spec.md` for the detailed IP spec.

## Current Focus

**Full Pipeline Implementation Complete.**

The Upstream pipeline is now fully implemented with 6 agents working together. See `docs/pipeline-integration.md` for the full flow.

For CoStar API reference, the filter mappings in `reference/costar/` may still need validation against real queries.

## Project Structure

```
upstream/
├── .claude/agents/      # Subagent definitions (6 agents)
├── apps/web/            # Next.js UI (placeholder for now)
├── packages/db/         # Supabase schema source files
├── packages/shared/     # Shared types (placeholder)
├── orchestrator/        # Python orchestrator (placeholder)
├── reference/costar/    # CoStar API lookups and payload docs
├── supabase/            # Supabase local dev (migrations, seed, config)
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── PRD.md               # High-level product requirements
└── CLAUDE.md            # This file
```

## Subagents (6 total)

| Agent | Purpose |
|-------|---------|
| `@sourcing-agent` | Analyzes buyer criteria → strategy + CoStar payloads |
| `@response-classifier` | Classifies email replies into 8 categories with confidence scoring |
| `@qualify-agent` | Processes classified responses, generates follow-ups, tracks qualification |
| `@schedule-agent` | Handles call scheduling, time slots, calendar events, call prep |
| `@drip-campaign-exec` | Executes 3-email sequences via Outlook COM with approval queue |
| `@deal-packager` | Creates deal packages from qualified leads, notifies matching clients |

### Pipeline Flow
```
sourcing-agent → drip-campaign-exec → [email sent]
                                          ↓
                     [reply received] → response-classifier
                                          ↓
                     qualify-agent ← [interested/pricing_given]
                           ↓
                     schedule-agent ← [call request detected]
                           ↓
                     deal-packager ← [qualification complete]
```

### Classification Categories (response-classifier)
| Code | Action |
|------|--------|
| `interested` | Continue to qualify |
| `pricing_given` | Extract data, continue to qualify |
| `question` | Answer, continue |
| `referral` | Follow up with new contact |
| `broker_redirect` | Log broker, do not pursue |
| `soft_pass` | Add to nurture (re-engage later) |
| `hard_pass` | Add to DNC forever |
| `bounce` | Add email to exclusions forever |

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

### Schema Overview (34 tables)

**Core Entities:**
| Table | Purpose |
|-------|---------|
| `properties` | CRE assets from CoStar (address, type, size, class) |
| `companies` | Owner organizations = leads (status: new→contacted→qualified→handed_off) |
| `contacts` | People at companies who receive outreach |
| `property_loans` | Loan/distress data (maturity, LTV, DSCR, payment status) |
| `property_companies` | Junction: property ↔ company (owner/manager/lender) |

**Clients & Sourcing:**
| Table | Purpose |
|-------|---------|
| `clients` | Buyers/investors we source deals for |
| `client_criteria` | Search profiles with criteria JSON + generated queries |
| `markets` | CoStar market reference (id, name, state) |
| `sourcing_strategies` | Predefined query strategies (hold_period, financial_distress, etc.) |
| `extraction_lists` | Results of CoStar queries (linked to client_criteria) |
| `list_properties` | Junction: extraction_list ↔ property |

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
clients → client_criteria (1:many)
client_criteria → extraction_lists (1:many)
extraction_lists → properties (via list_properties)
properties ←→ companies (via property_companies)
companies → contacts (1:many)
properties → property_loans (1:many)
contacts → sequence_subscriptions → sequences
activities → contacts, companies, properties
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

Full pipeline from buyer criteria to DB:

```
1. sourcing-agent → generates payloads + strategy
   Input: Buyer criteria (natural language)
   Output: output/queries/{buyer}_payloads.json

2. run_extraction.py → orchestrates extraction
   - Creates client record (if new)
   - Creates client_criteria (stores queries)
   - Creates extraction_lists (one per query)
   - Runs CoStar extraction
   - Saves to DB with proper linking

3. Properties linked via:
   client → client_criteria → extraction_lists → list_properties → properties
```

### Running the Pipeline

```bash
# Generate queries for a buyer
# (invoke sourcing-agent with buyer criteria)

# Run extraction from generated payloads
python scripts/run_extraction.py output/queries/TestCo_Capital_payloads.json

# Options:
#   --max-properties 100    # Limit properties per query
#   --include-parcel        # Fetch loan data (slower)
#   --query-index 0         # Run only first query
#   --dry-run               # Set up DB records only
```

## Development Approach

1. Work through pipeline stages one at a time
2. Validate each stage works before moving on
3. Add infrastructure (Supabase, UI) only when needed
4. Subagents evolve as we learn what works

## Commands

```bash
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
