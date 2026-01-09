# orchestrator

Python service that runs locally and orchestrates the pipeline.

## What It Does
1. Polls Supabase for work (campaigns, pending decisions)
2. Invokes Claude Code subagents via CLI
3. Runs costar-extract (requires 2FA)
4. Sends emails via Outlook COM
5. Writes results back to Supabase
6. Creates decision requests when human input needed

## Structure (Planned)
```
src/
  main.py              # Entry point, polling loop
  agents/              # Wrappers for Claude Code subagents
  integrations/        # costar-extract, Outlook, Supabase
  pipeline/            # Campaign execution logic
```

## Why Python?
- costar-extract is Python
- Outlook COM works well with pywin32
- subprocess for Claude CLI is easy

## When To Build
After subagents are working manually.
This just automates what we can do by hand.

## For Now
Focus on getting subagents right first.
