# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Upstream Sourcing Engine - AI agents that help find off-market CRE deals. See `PRD.md` for the simple version, `docs/upstream-spec.md` for the detailed IP spec.

## Current Focus

**Stage 1: Get CoStar query building right.**

The filter mappings in `reference/costar/` may be inaccurate. We need to validate by testing real queries.

## Project Structure

```
upstream/
├── .claude/agents/      # Subagent definitions (6 agents)
├── apps/web/            # Next.js UI (placeholder for now)
├── packages/db/         # Supabase schema (placeholder)
├── packages/shared/     # Shared types (placeholder)
├── orchestrator/        # Python orchestrator (placeholder)
├── reference/costar/    # CoStar API lookups and payload docs
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── PRD.md               # High-level product requirements
└── CLAUDE.md            # This file
```

## Subagents

| Agent | Purpose |
|-------|---------|
| `@query-builder` | Translates buyer criteria → CoStar API payload |
| `@prospect-list-gen` | Determines search strategy from criteria |
| `@outreach-copy-gen` | Writes personalized cold emails |
| `@drip-campaign-exec` | Sends emails via Outlook COM |
| `@response-classifier` | Classifies email replies |
| `@deal-packager` | Creates deal packages for distribution |

## CoStar API Reference

**Endpoint:** `POST https://product.costar.com/bff2/property/search/placards`

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

## Local Requirements

These MUST run on the operator's machine:
1. **costar-extract** - Requires 2FA via mobile phone
2. **Outlook COM** - Email sending via Microsoft Outlook

## Development Approach

1. Work through pipeline stages one at a time
2. Validate each stage works before moving on
3. Add infrastructure (Supabase, UI) only when needed
4. Subagents evolve as we learn what works

## Commands

None yet. Add as we build.
