# Scripts

Utility scripts for Upstream CRM operations. All scripts use the local Supabase database at `postgresql://postgres:postgres@127.0.0.1:55322/postgres`.

## Active Scripts

### Email Sync (`sync/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `sync_emails.py` | Sync Outlook emails to DB | `python scripts/sync/sync_emails.py [--folder inbox\|sent] [--limit N] [--full]` |

Requires Outlook running locally. Tracks sync state for incremental syncing.

### CoStar Enrichment (`costar/`)

| Script | Purpose | Usage |
|--------|---------|-------|
| `enrich_properties.py` | Backfill property data from CoStar API | `python scripts/costar/enrich_properties.py [--limit N] [--batch-size N]` |
| `mark_bounces.py` | Mark contacts as bounced from bounce emails | `python scripts/costar/mark_bounces.py` |

Requires CoStar service running (`python integrations/costar/service.py`) with authenticated session.

### Dev Operations (root)

| Script | Purpose | Usage |
|--------|---------|-------|
| `dev.ps1` | Start all dev services (web, worker, CoStar) | `./scripts/dev.ps1` |
| `stop.ps1` | Stop all dev services | `./scripts/stop.ps1` |

## Archived Scripts (`archive/`)

One-time migrations and experiments. Kept for reference:

| Script | What it did |
|--------|-------------|
| `backfill_all_campaigns.py` | Imported contacts/leads/properties from 18 campaign JSON files |
| `backfill_fitch_campaign.py` | Earlier version for single campaign |
| `create_contacts_from_emails.py` | Created contacts from unmatched email addresses |
| `process_bounces.py` | Earlier bounce processing (superseded by mark_bounces.py) |
| `workflow_engine.py` | Agent workflow runner (superseded by pg-boss worker) |
| `capture_agent_run.py` | Agent execution logging |
| `cleanup_inbox.py` | Outlook inbox cleanup rules |
| `scan_inbox.py` | Outlook inbox scanning |

## Training Data Scripts (`training/`)

Scripts used to build classifier training data. Can be deleted once classifier is finalized:

| Script | Purpose |
|--------|---------|
| `export_training_data.py` | Export campaign replies as training data |
| `export_training_data_sql.py` | SQL-based training data export |
| `export_campaign_training_data.py` | Campaign-specific training export |
| `add_bounces_to_training.py` | Add bounce examples to training set |
| `label_qualify_data.py` | Auto-label qualification training data |
| `dedupe_hot_leads.py` | Deduplicate hot leads in training data |
| `show_hot_leads.py` | Display hot leads from training data |

## Prerequisites

- **Supabase**: Must be running (`npx supabase start`)
- **Outlook**: Required for email sync scripts (Windows only, COM automation)
- **CoStar Service**: Required for enrichment scripts (`python integrations/costar/service.py`)
