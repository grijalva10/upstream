# Upstream Orchestrator

Python service that orchestrates the CRE deal sourcing pipeline.

## What It Does

Two core loops running continuously:

### Outreach Loop
1. Criteria input → `sourcing-agent` generates CoStar payloads (auto)
2. **[CHECKPOINT 1: Extraction]** - Requires 2FA on mobile
3. Campaign scheduling (rules-based, not AI)
4. **[CHECKPOINT 2: Campaign]** - Approve contacts + schedule
5. Pre-scheduled email execution via Outlook COM

### Response Loop
1. `sync_emails.py` syncs inbox every 60s
2. Supabase Realtime triggers instant classification
3. `response-classifier` categorizes replies
4. Auto-route: bounce → exclusions, hard_pass → DNC, soft_pass → nurture
5. Flag interested/pricing for human review

## Checkpoints (Plan Mode → Auto-Accept)

Like Claude Code's plan mode:
- Start in **plan mode**: agent proposes, you approve/feedback
- Goal: reach **auto-accept** once you trust the agents

Checkpoints stored in `checkpoint_settings` table:
```sql
SELECT * FROM checkpoint_settings;
-- checkpoint    | mode
-- sourcing      | auto   (no approval needed)
-- extraction    | plan   (always needs 2FA)
-- campaign      | plan   (starts manual, can enable auto)
-- classification| auto   (always auto)
```

## Structure

```
orchestrator/
├── main.py              # Entry point, polling loop
├── config.py            # Settings, send limits
├── db.py                # Supabase client helpers
│
├── agents/
│   └── runner.py        # Claude CLI headless wrapper
│
├── loops/
│   ├── outreach.py      # Criteria → campaign → send
│   └── response.py      # Classify → route → action
│
└── requirements.txt
```

## Running

```bash
# Install dependencies
pip install -r orchestrator/requirements.txt

# Run continuously
python -m orchestrator.main

# Run once (single poll iteration)
python -m orchestrator.main --once

# Dry run (no actual sends/extractions)
python -m orchestrator.main --dry-run

# Debug logging
python -m orchestrator.main --log-level DEBUG
```

## Configuration

Environment variables or defaults:

| Variable | Default | Description |
|----------|---------|-------------|
| `SUPABASE_URL` | `http://127.0.0.1:55321` | Supabase API URL |
| `SUPABASE_SERVICE_KEY` | (local dev key) | Service role key |
| `DRY_RUN` | `false` | Skip actual sends/extractions |
| `CLAUDE_CODE_PATH` | `claude` | Path to Claude Code CLI |

## Send Limits

Built-in spam prevention:
- **Daily**: 10,000 emails/day
- **Hourly**: 1,000 emails/hour

Checked before each send. Campaign scheduling respects limits.

## Database Migration

Apply the orchestrator tables:
```bash
npx supabase db reset  # Includes all migrations
```

New tables:
- `checkpoint_settings` - Plan/auto mode per checkpoint
- `approval_queue` - Items waiting for approval
- `agent_feedback` - Learnings for reinforcement
- `email_exclusions` - Permanent bounce/opt-out list

## Feedback Injection

Agents learn from feedback. The orchestrator **forces** relevant feedback into every agent prompt:

```python
# Orchestrator injects this automatically
## LEARNINGS FROM PAST RUNS (APPLY THESE)
- "Too narrow, add OC" → Expanded LA to LA+OC (contacts: 89 → 234)
- "Industrial buyers also like flex" → Added flex (yield +15%)
```

Agents can't be lazy - feedback is in the prompt, not optional to query.

## Next Steps

- [ ] Outlook COM integration (send emails)
- [ ] Supabase Realtime subscription (instant response classification)
- [ ] UI endpoints for approval queue
- [ ] Metrics dashboard for agent performance
