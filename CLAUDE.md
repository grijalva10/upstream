# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

**Upstream** is the sourcing engine that feeds **Lee 1031 X** (a deal distribution platform) with off-market CRE deals.

**The full picture:**
- **Lee 1031 X** - Brokers submit buyer criteria for 1031 exchange clients, deals get matched to them via progressive disclosure (teaser → CA → details → LOI → seller contact)
- **Upstream** (this repo) - Finds motivated sellers via CoStar queries + email campaigns, qualifies them through calls, packages deals for handoff

**Key insight:** Leads are bidirectional. The same entity can be a buyer, seller, or both. Campaigns generate intel beyond just yes/no:
- "Won't sell my industrial, but I'll sell my office in PHX" → new opportunity
- "Won't sell, but I'm looking to buy" → new buyer criteria captured

See `docs/VISION.md` for the full architecture and bidirectional flows.

## Current Focus

**Full Pipeline Implementation Complete.**

The Upstream pipeline is now fully implemented with 6 agents working together. See `docs/pipeline-integration.md` for the full flow.

For CoStar API reference, the filter mappings in `reference/costar/` may still need validation against real queries.

## Project Structure

```
upstream/
├── .claude/agents/      # Subagent definitions (6 agents)
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

## Subagents (5 total)

| Agent | Purpose |
|-------|---------|
| `@sourcing-agent` | Analyzes buyer criteria → strategy + CoStar payloads |
| `@qualify-agent` | Processes classified responses, generates follow-ups, tracks qualification |
| `@schedule-agent` | Handles call scheduling, time slots, calendar events, call prep |
| `@drip-campaign-exec` | Executes 3-email sequences via Outlook COM with approval queue |
| `@deal-packager` | Creates deal packages from qualified leads, notifies matching clients |

### Pipeline Flow
```
sourcing-agent → drip-campaign-exec → [email sent]
                                          ↓
                     [reply received] → process-replies job (classifies + acts)
                                          ↓
                     qualify-agent ← [hot lead detected]
                           ↓
                     schedule-agent ← [call request detected]
                           ↓
                     deal-packager ← [qualification complete]
```

### Classification Categories (process-replies job)
| Code | Action |
|------|--------|
| `hot` | Interested, gave pricing, wants call → create draft reply, update deal |
| `question` | Asking about deal/buyer → create draft answer |
| `pass` | Not interested, wrong person, has broker → update status, add to DNC if requested |
| `bounce` | Delivery failure → add to exclusions |
| `other` | OOO, newsletters, unclear → no action |

## Slash Commands

Operator commands in `.claude/commands/` for common workflows:

| Command | Purpose | Usage |
|---------|---------|-------|
| `/prep` | Generate call prep sheet with contact, property, loan, and deal context | `/prep John Smith` |
| `/triage` | Daily inbox review - pending drafts, hot leads, low confidence items | `/triage` |
| `/source` | Convert natural language to CoStar search and run extraction | `/source industrial OC, loan maturing 2026` |
| `/pipeline` | Pipeline snapshot - funnel counts, active deals, stalled deals | `/pipeline` |
| `/campaign` | Campaign status with metrics, reply rates, hot leads | `/campaign Industrial OC 2026` |

Each command contains:
- SQL queries to gather relevant data
- Output format specification (markdown or React artifact)
- Key rules for presentation

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

### Schema Overview

See `docs/SCHEMA.md` for the full table reference.

### Key Relationships
```
searches → search_properties → properties (via search_properties junction)
properties ←→ leads (via property_leads)
leads → contacts (1:many)
properties → property_loans (1:many)
campaigns → enrollments → contacts
activities → contacts, leads, properties
searches → campaigns (1:many)
```

### Lead Status (Single Source of Truth)

```
new → contacted → replied → engaged → waiting → qualified → handed_off
                                         ↘ nurture (soft pass, revisit later)
                                         ↘ closed (dead, see closed_reason)
```

| Status | Definition | AI Action |
|--------|------------|-----------|
| `new` | Identified, no outreach yet | Enroll in campaign |
| `contacted` | Email sent, waiting for reply | Wait |
| `replied` | Got response, needs triage | Triage & route |
| `engaged` | Two-way conversation active | Draft responses, gather info |
| `waiting` | Ball in their court | Monitor, follow up if silent 7+ days |
| `qualified` | Has pricing + motivation + timeline | Package deal |
| `handed_off` | Sent to Lee 1031 X | Done |
| `nurture` | "Not now, maybe later" | Schedule future outreach |
| `closed` | Dead (see `closed_reason`) | Nothing |

**closed_reason values:** `dnc`, `not_interested`, `has_broker`, `wrong_contact`, `bad_data`, `duplicate`

### Lead Type (Relationship)

| Type | Definition | Example |
|------|------------|---------|
| `seller` | We want to GET a deal from them | Owner with property to sell |
| `buyer` | We want to GIVE deals to them | Investor with capital |
| `buyer_seller` | Bidirectional | Owner selling one, buying another |
| `broker` | Middleman | Lee & Associates |
| `other` | Vendor, lender, etc. | Title company |

### Deal Status

```
new → gathering → qualified → packaging → handed_off
                     ↘ lost (see lost_reason)
```

**lost_reason values:** `not_interested`, `price_unrealistic`, `timing`, `went_with_broker`, `ghosted`, `other`

### Other Status Flows
- **Contact**: `active` | `invalid` | `bounced` | `dnc` | `unsubscribed`
- **Search**: `new` → `queries_ready` → `extracting` → `extracted` → `campaign_active` → `complete`
- **Task**: `pending` → `in_progress` → `completed` | `snoozed` | `cancelled`
- **Email Draft**: `pending` → `approved` → `sent` | `rejected`

### AI Query Interface: lead_actions VIEW

AI agents should query the `lead_actions` view to determine next action:

```sql
SELECT * FROM lead_actions WHERE next_action IS NOT NULL ORDER BY updated_at DESC;
```

Returns leads with computed `next_action`: `enroll_campaign`, `triage_reply`, `review_draft`, `complete_task`, `package_deal`, `follow_up`, `nurture_outreach`

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
   - Saves properties, leads, contacts
   - Links via search_properties junction

4. Properties linked via:
   searches → search_properties → properties → leads → contacts
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

### Email Safety (ACTIVE)
**ALL outbound emails MUST be sent to the test address: `grijalva10@gmail.com`**

Until this rule is removed:
- NEVER approve, send, or queue emails to any other address
- If creating email drafts, override `to_email` to the test address
- If you see real recipient addresses in drafts/queue, STOP and warn the user
- This applies to: campaign emails, AI-generated drafts, manual replies, all email types

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

### Schema Documentation
**When creating or deleting database tables, update `docs/SCHEMA.md`.**

This keeps the schema documentation in sync with the actual database.
