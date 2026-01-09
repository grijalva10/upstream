# orchestrator/src

Source code for the Python orchestrator.

## Subfolders

### agents/
Thin wrappers that invoke Claude Code subagents via CLI.
Each file corresponds to a `.claude/agents/*.md` definition.

### integrations/
External system connectors:
- `supabase_client.py` - Database operations
- `costar_extract.py` - Wrapper for existing costar-extract tool
- `outlook_com.py` - Microsoft Outlook COM automation

### pipeline/
Business logic for running campaigns:
- Campaign state machine
- Decision handling
- Error recovery

## Entry Point
`main.py` - Starts the polling loop, coordinates everything.
