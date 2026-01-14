# Plan: Remove Web App, Pivot to Claude Canvas

## Summary
Remove the Next.js web application and update documentation to reflect the new architecture using Claude Canvas (terminal TUI) + Python orchestrator.

## New Architecture
- **Claude Code** - Operator interface (CLI)
- **Claude Canvas** - Terminal TUI for pipeline visibility, inbox, approvals
- **Python Orchestrator** - Background processing and automation
- **Supabase** - Database (unchanged)

## Changes

### 1. Delete Web App (apps/web/)
Delete the entire `apps/web/` directory containing:
- Next.js dashboard pages
- API routes
- shadcn/ui components
- Supabase client utilities

### 2. Delete packages/shared/
Empty placeholder directory, no longer needed.

### 3. Update package.json
Remove web-related script:
```diff
- "dev:web": "npm run dev --prefix apps/web",
```

### 4. Update CLAUDE.md
**Project Structure** - Replace:
```
├── apps/web/            # Next.js UI (placeholder for now)
├── packages/shared/     # Shared types (placeholder)
```
With:
```
├── canvas/              # Claude Canvas TUI plugins
```

Add Canvas section explaining:
- `canvas/canvas/` - Base TUI toolkit (calendar, document, flight)
- `canvas/custom/` - Upstream-specific canvases (pipeline, inbox, approvals)
- Reference to `.claude/plugins.json` for plugin registration

### 5. Update PRD.md
**What's Built** - Remove:
```
- [ ] UI for decisions
```

**In The Cloud** - Update:
```diff
- Next.js UI (eventually, so I can check from phone)
+ Canvas TUI (terminal interface via Claude Code)
```

## Files to Modify
| File | Action |
|------|--------|
| `apps/web/**` | DELETE |
| `packages/shared/**` | DELETE |
| `package.json` | Remove `dev:web` script |
| `CLAUDE.md` | Update project structure, add canvas section |
| `PRD.md` | Remove UI reference, update cloud section |

## Files to Keep
- `packages/db/` - Schema files still useful for reference
- `canvas/` - New TUI system (already exists)
- `orchestrator/` - Python background processing
- All other existing directories

## Verification
1. Run `npx supabase start` - confirm DB still works
2. Confirm `canvas/` directory structure intact
3. Review updated docs for accuracy
