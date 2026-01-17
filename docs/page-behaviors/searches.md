# Searches Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Search States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `draft` | Created, no criteria yet | "Draft" badge | `pending_queries` |
| `pending_queries` | Criteria added, waiting for agent | "Pending" badge | `generating_queries` |
| `generating_queries` | Sourcing agent running | Spinner + "Generating..." | `pending_extraction`, `failed` |
| `pending_extraction` | Queries ready, waiting for extraction | "Queries Ready" badge | `extracting` |
| `extracting` | CoStar extraction running | Spinner + "Extracting..." | `ready`, `failed` |
| `ready` | Results available | "Ready" badge | `campaign_created` |
| `campaign_created` | Campaign linked to search | "Has Campaign" badge | — |
| `failed` | Agent or extraction failed | Red "Failed" badge | `pending_queries` (retry) |

---

## 2. Search Sources

| Source | Description | How Created |
|--------|-------------|-------------|
| `manual` | User-created search | New Search dialog |
| `lee-1031-x` | Imported from Lee 1031-X system | API integration |
| `inbound` | Created from buyer inquiry email | AI from inbox classification |

---

## 3. Human Actions

### List Page (/searches)

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **View searches** | Navigate to /searches | Shows all searches in table | — |
| **Filter by status** | Dropdown filter | Filters table by status | URL param |
| **Filter by source** | Dropdown filter | Filters table by source | URL param |
| **Create search** | "New Search" button | Opens dialog | — |
| **Submit new search** | Dialog submit | Creates search record | Creates `searches` with status=draft |
| **View search** | Click row or "View" | Navigate to detail page | — |
| **View campaign** | "Campaign" button | Navigate to linked campaign | — |

### Detail Page (/searches/[id])

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Go back** | Back button | Return to list | — |
| **Edit criteria** | Textarea edit | Modify criteria JSON | — (local state) |
| **Format JSON** | Format button | Pretty-print criteria | — (local state) |
| **Run agent** | "Run Sourcing Agent" button | Triggers sourcing agent | Updates status to `generating_queries` |
| **Preview counts** | "Preview" button per query | Shows property count | — |
| **Run extraction** | "Extract" button | Triggers CoStar extraction | Updates status to `extracting` |
| **Set max properties** | Input field | Limits extraction count | — (request param) |
| **Abort extraction** | Abort button | Cancels running extraction | Reverts status |
| **Retry** | "Retry" button (on failed) | Re-runs agent | Updates status to `pending_queries` |
| **View properties** | Properties card click | Navigate to /data/properties?search=id | — |
| **View companies** | Companies card click | Navigate to /data/companies?search=id | — |
| **View contacts** | Contacts card click | Navigate to /data/contacts?search=id | — |
| **Create campaign** | "Create Campaign" button | Opens campaign creation | — (navigates) |
| **Delete search** | Delete button | Removes search | Deletes `searches` + `search_properties` |

---

## 4. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Generate queries** | User clicks "Run Agent" | Active | Active | Updates `payloads_json`, `strategy_summary` |
| **Parse criteria** | Agent execution | Active | Active | Extracts structured data from JSON |
| **Create strategy** | Agent execution | Active | Active | Generates markdown strategy summary |
| **Create search from inbox** | `buyer_inquiry` email | Disabled | Active | Creates `searches` with source=inbound |
| **Update criteria from inbox** | `buyer_criteria_update` email | Disabled | Active | Updates `criteria_json` |
| **Auto-run extraction** | Queries ready | Disabled | Active (with approval) | Runs extraction pipeline |
| **Auto-create campaign** | Extraction complete | Disabled | Active (with approval) | Creates campaign record |

---

## 5. Sourcing Agent Behavior

### Input: Criteria JSON

```json
{
  "broker": { "id": "uuid", "name": "John Smith", "email": "john@example.com" },
  "buyer": {
    "id": "uuid",
    "entityName": "ABC Capital LLC",
    "contact": { "name": "Jane Doe", "email": "jane@abc.com", "phone": "555-1234" }
  },
  "criteria": {
    "propertyTypes": [{ "id": 1, "name": "Industrial" }],
    "markets": [{ "id": 123, "name": "Dallas-Fort Worth" }],
    "strategies": [{ "slug": "hold_period" }, { "slug": "financial_distress" }],
    "priceMin": 2000000,
    "priceMax": 10000000,
    "capRateMin": 6.0,
    "capRateMax": 9.0,
    "deadline": "2026-06-30",
    "notes": "Prefer NNN leases, avoid flood zones"
  }
}
```

### Output: Payloads JSON + Strategy

```json
{
  "queries": [
    {
      "name": "Long-Hold Industrial DFW",
      "rationale": "Targets owners with 10+ year hold periods likely ready to exit",
      "payload": { "0": { /* CoStar API payload */ } }
    },
    {
      "name": "Distressed Industrial DFW",
      "rationale": "Properties with high LTV or payment issues",
      "payload": { "0": { /* CoStar API payload */ } }
    }
  ]
}
```

Plus markdown strategy summary explaining approach.

### Agent Strategies (15+)

| Strategy Slug | Description | CoStar Filters Used |
|---------------|-------------|---------------------|
| `hold_period` | Long-term owners ready to exit | Acquisition date > 7-10 years |
| `financial_distress` | High LTV, payment issues | LTV > 70%, delinquent status |
| `estate_planning` | Elderly owners, succession | Owner age indicators |
| `portfolio_trim` | Large portfolios divesting | Owner with 5+ properties |
| `value_add` | Under-improved properties | Low occupancy, deferred maintenance |
| `lease_rollover` | Major lease expirations | Lease expiry < 2 years |
| `1031_deadline` | Exchange buyers under time pressure | Recent sale + deadline |
| `refinance_wall` | Loans maturing soon | Maturity < 18 months |
| `negative_leverage` | Cap rate < debt cost | Cap rate vs interest rate |
| `vacant_land` | Developable parcels | Land type, zoning |
| `owner_occupied` | Businesses that own their space | Owner-occupied flag |
| `institutional_exit` | Funds at end of lifecycle | Fund ownership indicators |
| `partnership_dissolution` | JV/partnership breakups | Multiple owner entities |
| `tax_burden` | High property tax areas | Tax rate thresholds |
| `regulatory_pressure` | Zoning/compliance issues | Code violations, rezoning |

---

## 6. Extraction Process

### CoStar Service Requirements

- **URL:** `COSTAR_SERVICE_URL` (default: localhost:8765)
- **Authentication:** Requires valid CoStar session with 2FA
- **Endpoints:** `/status`, `/query`, `/count`

### Extraction Flow

```
1. Validate CoStar session is connected
2. Set search status to "extracting"
3. Send payloads to /query endpoint
4. For each returned contact:
   a. Parse and normalize data (prices, sizes, dates)
   b. Deduplicate by property_id, company_id, email
   c. Upsert property record (30+ fields)
   d. Upsert company record (is_seller=true)
   e. Upsert contact record
   f. Create property_companies junction
   g. Create search_properties junction
   h. Upsert loan data if available
5. Update search with result counts
6. Set status to "ready"
```

### Data Normalization

| Field Type | Raw Format | Normalized |
|------------|------------|------------|
| Price | "$9,500,000" | 9500000 |
| Size | "103,440 SF" | 103440 |
| Year | "1998" | 1998 |
| Date | "Jan 15, 2020" | "2020-01-15" |
| Percentage | "6.5%" | 6.5 |

---

## 7. Database Tables

### Core Tables

| Table | Role |
|-------|------|
| `searches` | Search records with criteria and results |
| `search_properties` | Junction: search ↔ properties |
| `properties` | Extracted property records |
| `companies` | Owner/seller companies |
| `contacts` | Contact persons at companies |
| `property_companies` | Junction: property ↔ company (role) |
| `property_loans` | Loan/distress data per property |
| `campaigns` | Linked outreach campaigns |

### Searches Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Search name |
| `source` | TEXT | 'manual', 'lee-1031-x', 'inbound' |
| `source_contact_id` | UUID | If inbound, links to buyer contact |
| `criteria_json` | JSONB | Buyer criteria input |
| `strategy_summary` | TEXT | Agent-generated strategy (markdown) |
| `payloads_json` | JSONB | CoStar query payloads |
| `total_properties` | INT | Result count |
| `total_companies` | INT | Result count |
| `total_contacts` | INT | Result count |
| `status` | TEXT | Current state |
| `created_at` | TIMESTAMPTZ | Created timestamp |
| `updated_at` | TIMESTAMPTZ | Last update |

---

## 8. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `searches/page.tsx` | List page |
| `[id]/page.tsx` | `searches/[id]/page.tsx` | Detail page |
| `page-setup.tsx` | `_components/page-setup.tsx` | Header + "New Search" button |
| `new-search-dialog.tsx` | `_components/new-search-dialog.tsx` | Create dialog |
| `searches-data-table.tsx` | `_components/searches-data-table.tsx` | List table |
| `columns.tsx` | `_components/columns.tsx` | Table column definitions |
| `agent-runner.tsx` | `[id]/_components/agent-runner.tsx` | Criteria editor + run button |
| `criteria-section.tsx` | `[id]/_components/criteria-section.tsx` | Display parsed criteria |
| `strategy-section.tsx` | `[id]/_components/strategy-section.tsx` | Strategy + queries display |
| `results-section.tsx` | `[id]/_components/results-section.tsx` | Result count cards |
| `campaign-section.tsx` | `[id]/_components/campaign-section.tsx` | Linked campaigns |
| `search-header.tsx` | `[id]/_components/search-header.tsx` | Back button + counts |

---

## 9. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/searches` | GET | List all searches (with optional status filter) |
| `/api/searches` | POST | Create new search |
| `/api/searches/[id]` | GET | Get search details |
| `/api/searches/[id]` | PATCH | Retry agent (action=retry) |
| `/api/searches/[id]` | DELETE | Delete search |
| `/api/searches/[id]/run-agent` | POST | Run sourcing agent |
| `/api/searches/[id]/run-extraction` | POST | Run CoStar extraction |
| `/api/searches/[id]/count` | POST | Preview property counts |

---

## 10. Processes

### Create Search Process

```
1. User clicks "New Search"
2. Dialog opens: name (required), source (default: manual)
3. User submits
4. POST /api/searches creates record with status="draft"
5. Redirect to /searches/{id}
6. User adds criteria JSON
7. User clicks "Run Sourcing Agent"
```

### Agent Execution Process

```
1. POST /api/searches/[id]/run-agent with criteria_json
2. Status → "generating_queries"
3. Call AGENT_SERVICE_URL with criteria
4. Agent parses criteria, generates 2-4 CoStar payloads
5. Agent returns JSON payloads + strategy summary
6. Store in payloads_json and strategy_summary
7. Status → "pending_extraction"
8. UI shows queries with Preview/Extract buttons
```

### Extraction Process

```
1. User clicks "Extract" (optionally sets max_properties)
2. POST /api/searches/[id]/run-extraction
3. Validate CoStar session
4. Status → "extracting"
5. Call COSTAR_SERVICE_URL/query with payloads
6. Process response:
   - Deduplicate records
   - Upsert properties, companies, contacts
   - Create junction records
   - Store loan data
7. Update search counts
8. Status → "ready"
9. UI shows result cards
```

### Inbound Search Creation (Eventual Mode)

```
1. Buyer inquiry email arrives in inbox
2. AI classifies as "buyer_inquiry"
3. AI extracts buyer criteria from email
4. AI creates search with source="inbound", source_contact_id set
5. AI generates queries (if criteria sufficient)
6. Human reviews and triggers extraction
```

---

## 11. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | User triggers all actions manually |
| **Phase 2** | Assisted | AI generates queries, user reviews before extraction |
| **Phase 3** | Semi-autonomous | AI creates searches from inbox, user approves extraction |
| **Phase 4** | Autonomous | Full pipeline from inbox → campaign with approval checkpoints |

### Phase 1 → 2 Criteria
- Agent generates valid CoStar payloads 95%+ of time
- Strategy summaries are useful and accurate

### Phase 2 → 3 Criteria
- Buyer criteria extraction from emails is accurate
- User comfortable with AI-created searches

### Phase 3 → 4 Criteria
- End-to-end pipeline works reliably
- User opts in to full automation per source type

---

## 12. Edge Cases

| Scenario | Handling |
|----------|----------|
| Invalid criteria JSON | Show format error, don't run agent |
| Agent service unavailable | Show error, allow retry |
| CoStar session expired | Show "Session expired" error, user re-authenticates |
| Zero results from extraction | Show "No properties found", suggest criteria adjustment |
| Duplicate properties across queries | Deduplicate by property_id |
| Extraction timeout | Allow abort, show partial results if any |
| Failed extraction mid-process | Status → "failed", allow retry, preserve any saved data |
| Inbound criteria insufficient | AI asks follow-up questions via email |
| Campaign already exists | Show existing campaign, don't allow duplicate |

---

## 13. Integration Points

| System | Integration |
|--------|-------------|
| **Inbox** | `buyer_inquiry` → creates search with source=inbound |
| **Campaigns** | Search results feed into campaign contact lists |
| **Data pages** | `/data/properties?search=id` shows linked properties |
| **CoStar service** | Local service handles extraction (requires 2FA) |
| **Agent service** | Runs sourcing agent prompts |

---

## 14. Validation Rules

| Field | Validation |
|-------|------------|
| `name` | Required, max 200 characters |
| `source` | Enum: 'manual', 'lee-1031-x', 'inbound' |
| `criteria_json` | Valid JSON, parsed successfully |
| `max_properties` | Optional, positive integer |
| Status transitions | Must follow valid flow (no skipping states) |
