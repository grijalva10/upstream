# Unified Operator Agent Architecture

## Executive Summary

**Yes, a single AI agent with skills can replace most of the UI.**

The current architecture uses 6 specialized agents + a web UI. This can be consolidated into a **single Upstream Operator agent** with skills that provides a chat-first experience. You'd interact with your entire CRE business through conversation.

## Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      WEB UI (Next.js)                       │
│  Searches | Campaigns | Contacts | Properties | Email      │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  API Routes   │  │ Worker Jobs   │  │ claude-cli    │
│  (Next.js)    │  │ (pg-boss)     │  │ (wrapper)     │
└───────┬───────┘  └───────┬───────┘  └───────┬───────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│              6 SPECIALIZED AGENTS                           │
│  sourcing | response-classifier | qualify | schedule        │
│  drip-campaign-exec | deal-packager                         │
└─────────────────────────────────────────────────────────────┘
```

**Problems:**
- Context switching between CLI and web UI
- Agents run in isolation, no shared conversation memory
- UI is mostly just a CRUD layer on top of what agents could do directly
- Can't ask questions about your business—only view pre-built dashboards

## Proposed Architecture: Unified Operator

```
┌─────────────────────────────────────────────────────────────┐
│                 UNIFIED UPSTREAM OPERATOR                   │
│                                                             │
│  SKILLS (invoked via /skill-name):                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ /source  │ │/campaign │ │/schedule │ │/classify │      │
│  │ queries  │ │ drip exec│ │ calls    │ │ replies  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │/qualify  │ │/package  │ │  /xlsx   │ │  /pdf    │      │
│  │ leads    │ │ deals    │ │ exports  │ │ reports  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  MCP SERVERS (always connected):                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Supabase │ │ Outlook  │ │ Calendar │ │ CoStar   │      │
│  │ (data)   │ │ (email)  │ │ (events) │ │(extract) │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                             │
│  CONVERSATION MEMORY (persistent):                         │
│  - Session resume across conversations                      │
│  - Entity context (current deal, contact, search)          │
│  - Business context (portfolio, pipeline state)            │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────────┐
         │       CHAT INTERFACE                │
         │  (Claude Code terminal or web)      │
         └─────────────────────────────────────┘
```

## What You Could Do

### Natural Conversation

```
You: "How's my pipeline looking?"

Operator: Based on your current data:

## Pipeline Status

| Stage | Count | Hot Leads |
|-------|-------|-----------|
| New contacts | 234 | - |
| Reached out | 89 | - |
| Engaged | 12 | 4 |
| Qualified | 3 | 2 |
| Ready to package | 1 | 1 |

The ABC Industrial in Carson is ready—owner confirmed $4.2M asking,
7.2% cap. Want me to package it for your buyers?
```

### Skill-Based Operations

```
You: "/source multi-family, LA basin, $5-20M, value-add plays"

Operator: I'll generate CoStar queries for value-add multifamily in LA.

Sourcing Strategy:
- Focus: 1970s-90s buildings, deferred maintenance
- Markets: Downtown LA, Mid-Wilshire, South Bay, Valley
- Signals: Long-term ownership, estate situations, loan maturity

Generated 4 query payloads targeting ~150 contacts.
Ready to run extraction?
```

### Ask Questions

```
You: "Who haven't I followed up with this week?"

Operator: 7 contacts with no activity since Monday:

| Contact | Company | Last Touch | Status |
|---------|---------|------------|--------|
| John Davis | Davis Properties | Mon 9am - email sent | waiting |
| Sarah Chen | Chen Family Trust | Tue 2pm - pricing received | needs call |
...

Want me to draft follow-ups for any of these?
```

### Document Generation

```
You: "/pdf deal-summary ABC-Industrial"

Operator: Generated deal summary PDF:
- Property overview (Carson industrial, 42k SF)
- Financial summary ($4.2M / 7.2% cap)
- Seller motivation (estate, wants quick close)
- Conversation timeline
- Documents attached: rent roll, T12

Saved to: output/deals/abc-industrial-summary.pdf
```

### Build the App Itself

```
You: "Add a field to track seller motivation level"

Operator: I'll add a motivation_level field. Options:

1. Add to qualification_data table (numeric 1-10)
2. Add to companies table (enum: low/medium/high/urgent)

Which approach? I'd recommend option 2 since motivation
is a property of the seller, not the specific deal.

You: "Option 2"

Operator: Done. Created migration and updated types:
- Added motivation_level enum to companies table
- Updated TypeScript types
- Added to qualify-agent extraction

Want me to backfill existing contacts based on conversation history?
```

## Skills Structure

Following the [Anthropic Skills spec](https://github.com/anthropics/skills):

```
.claude/skills/
├── source/
│   └── SKILL.md           # Sourcing queries from criteria
├── campaign/
│   └── SKILL.md           # Drip campaign execution
├── classify/
│   └── SKILL.md           # Email response classification
├── qualify/
│   └── SKILL.md           # Lead qualification
├── schedule/
│   └── SKILL.md           # Call scheduling
├── package/
│   └── SKILL.md           # Deal packaging
├── xlsx/
│   └── SKILL.md           # Excel exports (from Anthropic)
├── pdf/
│   └── SKILL.md           # PDF generation (from Anthropic)
└── report/
    └── SKILL.md           # Pipeline analytics
```

### Example Skill Definition

```yaml
---
name: source
description: Generate CoStar search queries from buyer criteria. Invoke with /source followed by criteria (JSON or natural language).
---

# Sourcing Skill

When invoked, you generate CoStar API payloads to find motivated sellers.

## Input
Buyer criteria in any format:
- Natural language: "multi-family, LA, $5-20M, value-add"
- JSON: {"property_type": "multifamily", ...}

## Process
1. Parse criteria into structured format
2. Generate 3-5 CoStar API payloads
3. Focus on SELLER MOTIVATION, not perfect property matches
4. Target 50-150 contacts per extraction

## Output
- Strategy summary (why these queries)
- JSON payloads ready for extraction
- Offer to run extraction immediately

## Reference Data
[Inject: markets, owner-types, property-types from reference/costar/]
```

## MCP Server Integration

### Supabase MCP
Already documented in CLAUDE.md. Enables direct SQL queries:
```
You: "Show me all contacts who mentioned pricing in the last week"

Operator: [Uses MCP to query]
SELECT c.*, se.body_preview
FROM contacts c
JOIN synced_emails se ON se.from_address = c.email
WHERE se.classification = 'pricing_given'
AND se.received_at > now() - interval '7 days';
```

### Outlook MCP (to build)
Direct email operations without COM automation:
- Sync inbox/sent
- Send emails
- Read threads
- Manage calendar

### CoStar MCP (to build)
Wrap extraction service:
- Run queries
- Fetch property details
- Get owner info

## Implementation Path

### Phase 1: Consolidate Agents → Skills
1. Convert each agent markdown to skill format
2. Create unified operator skill that coordinates
3. Keep worker jobs for background processing

### Phase 2: Enhance Chat API
1. Add skill invocation (`/skill` routing)
2. Add MCP connections for data access
3. Add session persistence for context
4. Stream responses for better UX

### Phase 3: Add Document Skills
1. Install Anthropic's xlsx, pdf, pptx skills
2. Create custom report skill
3. Add deal-summary PDF generation

### Phase 4: Reduce UI to Essentials
1. Keep: Authentication, settings, approval queues
2. Remove: CRUD pages (use chat instead)
3. Add: Chat-first interface as primary UI

### Phase 5: Self-Modification
1. Enable code editing via chat
2. Migration generation
3. Type updates
4. Test validation

## Technical Requirements

### Claude CLI Features Needed
- **Skill loading**: Load skills from `.claude/skills/` (already supported via agents)
- **MCP integration**: Connect to MCP servers for tools
- **Session resume**: Persist conversation context
- **Streaming**: Real-time output for long operations

### Database Additions
```sql
-- Conversation memory
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    context JSONB,  -- current entity focus
    created_at TIMESTAMPTZ DEFAULT now(),
    last_active_at TIMESTAMPTZ DEFAULT now()
);

-- Message history (optional, for search)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    session_id UUID REFERENCES chat_sessions(id),
    role TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

## Benefits

| Current | Unified Operator |
|---------|------------------|
| Context switch between CLI and web | Single interface |
| Can only view pre-built dashboards | Ask any question |
| Agents run in isolation | Shared conversation context |
| Manual workflow orchestration | Natural language commands |
| Fixed reports | Dynamic document generation |
| Separate dev workflow | Self-modifying with oversight |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Hallucinated data | MCP provides ground truth queries |
| Destructive actions | Confirmation prompts, audit log |
| Complex queries fail | Fallback to simpler queries, show SQL |
| Loss of UI affordances | Keep approval queue UI, add chat shortcuts |
| Session context bloat | Summarization, explicit context reset |

## Relevant Anthropic Skills

From https://github.com/anthropics/skills:

| Skill | Use Case |
|-------|----------|
| **xlsx** | Export pipeline to spreadsheet |
| **pdf** | Deal summaries, property reports |
| **pptx** | Investor presentations |
| **docx** | LOIs, contracts |
| **mcp-builder** | Create custom MCP servers |
| **skill-creator** | Build new skills as needed |

## Conclusion

The unified operator approach is not just possible—it's the natural evolution of what you've already built. The `upstream-operator.md` agent is the seed. Skills formalize the specialized capabilities. MCP servers provide the data layer. The chat interface becomes the primary UI.

You'd go from "CRE deal sourcing app with AI features" to "AI CRE assistant with a supporting app."
