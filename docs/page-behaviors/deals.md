# Deals Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Overview

The Deals page is the qualification pipeline for active opportunities. A "deal" is created when a seller shows interest (hot response) and tracks the qualification process from initial interest through document collection to handoff.

---

## 2. Deal States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `new` | Just created from hot lead | Blue "New" badge | `engaging`, `lost` |
| `engaging` | Active conversation, gathering info | Green "Engaging" badge | `qualifying`, `lost` |
| `qualifying` | Collecting pricing + docs | Yellow "Qualifying" badge | `qualified`, `docs_received`, `lost` |
| `docs_received` | All documents received | Purple "Docs Ready" badge | `qualified` |
| `qualified` | Ready for packaging | Orange "Qualified" badge | `packaged`, `lost` |
| `packaged` | Deal package created | Teal "Packaged" badge | `handed_off` |
| `handed_off` | Sent to buyer | Gray "Handed Off" badge | — |
| `lost` | Deal fell through | Red "Lost" badge | — |

---

## 3. Qualification Checklist

A deal is "qualified" when it has:

| Requirement | Field(s) | Status Tracking |
|-------------|----------|-----------------|
| **Pricing (2 of 3)** | `asking_price`, `noi`, `cap_rate` | Pricing fields filled count |
| **Rent Roll** | `rent_roll_status` | not_requested → requested → promised → received |
| **Operating Statement** | `operating_statement_status` | not_requested → requested → promised → received |
| **Motivation** | `motivation` | Free text (optional but valuable) |
| **Timeline** | `timeline` | Free text (optional but valuable) |
| **Decision Maker** | `decision_maker_confirmed` | Boolean flag |

---

## 4. Document Status Flow

```
not_requested → requested → promised → received
                    ↓           ↓
                    └── not_available (terminal)
```

| Status | Description | Next Action |
|--------|-------------|-------------|
| `not_requested` | Haven't asked yet | Include in next email |
| `requested` | Asked but no response | Follow up in 3 days |
| `promised` | Seller said they'll send | Follow up in 3 days |
| `received` | Document in hand | Review and extract data |
| `not_available` | Seller doesn't have it | Note in deal, proceed |

---

## 5. Human Actions

### List Page (/deals)

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **View pipeline** | Default view | Shows Kanban-style board | — |
| **View as list** | Toggle | Shows table view | URL param `?view=list` |
| **Filter by status** | Status filter | Filters deals | URL param |
| **Search** | Search box | Search by property/contact | Query param |
| **Select deal** | Click card/row | Shows detail panel | URL param `?id=[uuid]` |
| **Create deal** | "New Deal" button | Opens create dialog | — |
| **Drag to status** | Kanban drag | Changes deal status | Updates `deals.status` |

### Detail Panel

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Edit pricing** | Inline edit | Updates pricing fields | Updates `deals.asking_price`, etc. |
| **Update doc status** | Dropdown | Changes document status | Updates `rent_roll_status`, etc. |
| **Mark decision maker** | Toggle | Confirms decision maker | Updates `decision_maker_confirmed` |
| **Add motivation** | Text edit | Records seller motivation | Updates `deals.motivation` |
| **Add timeline** | Text edit | Records seller timeline | Updates `deals.timeline` |
| **Request docs** | "Request Docs" button | Opens compose with template | Updates doc status to `requested` |
| **Mark qualified** | "Mark Qualified" button | Advances status | Updates `deals.status`, `qualified_at` |
| **Package deal** | "Package" button | Creates deal package | Creates `deal_packages` record |
| **Mark lost** | "Lost" button | Opens lost reason dialog | Updates `deals.status`, records reason |
| **View emails** | Emails tab | Shows conversation history | — |
| **View property** | Property link | Navigate to property | — |
| **View contact** | Contact link | Navigate to contact | — |
| **Schedule call** | "Call" button | Opens scheduler | Creates `calls` record |

### Kanban Board Actions

| Action | Trigger | What It Does |
|--------|---------|--------------|
| **Drag deal** | Mouse drag | Move between columns |
| **Expand column** | Column click | Shows all deals in column |
| **Filter column** | Column filter | Filters within column |
| **Sort column** | Column sort | Sort by date, priority, etc. |

---

## 6. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Create deal** | `hot_interested`/`hot_pricing` | Disabled | Active | Creates `deals` record |
| **Extract pricing** | Pricing mentioned in email | Active | Active | Updates `extracted_pricing`, deal fields |
| **Update doc status** | `doc_promised`/`doc_received` | Active | Active | Updates doc status fields |
| **Mark ghosted** | No response 10+ days, 2+ follow-ups | Disabled | Active | Sets `ghosted_at` |
| **Suggest qualification** | All requirements met | Disabled | Active | Creates review task |
| **Auto-package** | Deal qualified | Disabled | Active (with approval) | Creates `deal_packages` |
| **Match to buyers** | Deal packaged | Disabled | Active | Links to matching searches |
| **Generate follow-up** | Stalled deal | Disabled | Active | Creates `email_drafts` |

---

## 7. View Modes

### Kanban Board (Default)

| Column | Shows | Count |
|--------|-------|-------|
| New | status = 'new' | Yes |
| Engaging | status = 'engaging' | Yes |
| Qualifying | status = 'qualifying' | Yes |
| Qualified | status = 'qualified' | Yes |
| Packaged | status = 'packaged' | Yes |
| Handed Off | status = 'handed_off' | No |

### List View

| Column | Sortable | Default Sort |
|--------|----------|--------------|
| Property | Yes | — |
| Company | Yes | — |
| Contact | Yes | — |
| Status | Yes | — |
| Asking Price | Yes | — |
| Cap Rate | Yes | — |
| Last Activity | Yes | DESC |
| Created | Yes | — |

---

## 8. Database Tables

### Core Tables

| Table | Role |
|-------|------|
| `deals` | Main deal records with qualification data |
| `properties` | Linked property |
| `companies` | Linked seller company |
| `contacts` | Linked seller contact |
| `synced_emails` | Conversation history |
| `deal_packages` | Packaged deal documents |
| `calls` | Scheduled/completed calls |
| `tasks` | Deal-related tasks |

### Deals Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `display_id` | TEXT | Human-readable ID (DEAL-001) |
| `property_id` | UUID | Linked property |
| `company_id` | UUID | Linked seller company |
| `contact_id` | UUID | Primary contact |
| `status` | TEXT | Pipeline status |
| `asking_price` | NUMERIC | Seller's asking price |
| `noi` | NUMERIC | Net Operating Income |
| `cap_rate` | DECIMAL | Cap rate (%) |
| `price_per_sf` | NUMERIC | Price per square foot |
| `motivation` | TEXT | Why they're selling |
| `timeline` | TEXT | When they want to close |
| `decision_maker_confirmed` | BOOLEAN | Confirmed DM |
| `rent_roll_status` | TEXT | Document status |
| `operating_statement_status` | TEXT | Document status |
| `rent_roll_data` | JSONB | Extracted rent roll data |
| `operating_statement_data` | JSONB | Extracted T12 data |
| `email_count` | INTEGER | Emails exchanged |
| `follow_up_count` | INTEGER | Follow-ups sent |
| `last_response_at` | TIMESTAMPTZ | Last seller response |
| `ghosted_at` | TIMESTAMPTZ | When marked ghosted |
| `qualified_at` | TIMESTAMPTZ | When qualified |
| `packaged_at` | TIMESTAMPTZ | When packaged |
| `created_at` | TIMESTAMPTZ | Created |
| `updated_at` | TIMESTAMPTZ | Last update |

---

## 9. Processes

### Deal Creation Process

```
1. Hot response detected in inbox (hot_interested, hot_pricing)
2. Initial Mode: User clicks "Create Deal"
   Eventual Mode: AI creates deal automatically
3. Deal record created with:
   - property_id from matched property
   - company_id from contact's company
   - contact_id from email sender
   - status = 'new'
   - display_id = next sequence (DEAL-001, etc.)
4. If pricing extracted:
   - Populate asking_price, noi, cap_rate
5. Creates initial activity linking source email
```

### Qualification Process

```
1. User engages with seller via email/call
2. Each response:
   a. AI extracts pricing if mentioned
   b. AI updates document status if mentioned
   c. Updates last_response_at
3. User or AI updates:
   - Pricing fields (goal: 2 of 3)
   - Document statuses (goal: both received)
   - Motivation, timeline (optional)
4. When checklist complete:
   - System shows "Ready to Qualify" indicator
   - User clicks "Mark Qualified"
   - Sets qualified_at, status = 'qualified'
```

### Document Request Process

```
1. User clicks "Request Docs"
2. Compose opens with template:
   - If rent_roll_status != 'received': Mentions rent roll
   - If op_statement_status != 'received': Mentions T12
3. User sends email
4. System updates:
   - rent_roll_status → 'requested'
   - operating_statement_status → 'requested'
5. Creates doc_follow_up task for 3 days out
```

### Ghost Detection Process (Eventual Mode)

```
1. Daily job checks for potential ghosts:
   - status IN ('new', 'engaging', 'qualifying')
   - ghosted_at IS NULL
   - last_response_at < NOW() - 10 days
   - follow_up_count >= 2
2. For each potential ghost:
   a. Create human_review task
   b. Title: "No response from {contact} - mark as ghost?"
3. User reviews:
   - If ghost: Mark ghosted, move to lost
   - If still interested: Reset follow_up_count, continue
```

### Packaging Process

```
1. Deal status = 'qualified'
2. User clicks "Package Deal"
3. deal-packager agent runs:
   a. Gathers property data
   b. Compiles pricing info
   c. Includes document excerpts
   d. Generates deal summary
   e. Creates PDF package
4. Creates deal_packages record
5. Updates deal status → 'packaged'
6. Matches to buyer criteria (searches)
7. Notifies matching buyers
```

### Handoff Process

```
1. Deal status = 'packaged'
2. User selects buyer(s) for handoff
3. Generates handoff email with:
   - Deal package attachment
   - Key highlights
   - Contact info
4. On send:
   - Updates status → 'handed_off'
   - Links to buyer contact
   - Creates activity record
```

---

## 10. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `deals/page.tsx` | Main page with view toggle |
| `deals-kanban.tsx` | `_components/` | Kanban board view |
| `deal-card.tsx` | `_components/` | Card for Kanban |
| `deals-table.tsx` | `_components/` | List view table |
| `deal-detail.tsx` | `_components/` | Right panel detail |
| `qualification-checklist.tsx` | `_components/` | Progress tracker |
| `doc-status-dropdown.tsx` | `_components/` | Document status selector |
| `pricing-editor.tsx` | `_components/` | Inline pricing editor |
| `lost-reason-dialog.tsx` | `_components/` | Lost deal form |
| `package-button.tsx` | `_components/` | Package deal trigger |

---

## 11. Metrics Display

| Metric | Source | Display |
|--------|--------|---------|
| **Total Active** | status NOT IN (handed_off, lost) | Header stat |
| **This Week** | created_at > 7 days ago | Header stat |
| **Qualified** | status = 'qualified' | Header stat |
| **Conversion Rate** | qualified / total | Header stat |
| **Avg Time to Qualify** | AVG(qualified_at - created_at) | Header stat |

---

## 12. Pipeline Health Indicators

| Indicator | Threshold | Display |
|-----------|-----------|---------|
| **Stalled deals** | No activity 5+ days | Yellow warning |
| **Ghosted candidates** | 10+ days, 2+ follow-ups | Red warning |
| **Ready to package** | Qualified but not packaged | Blue indicator |
| **Missing docs** | Qualified without all docs | Yellow indicator |

---

## 13. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | Extract pricing, user creates deals |
| **Phase 2** | Assisted | AI creates deals, user confirms |
| **Phase 3** | Semi-autonomous | AI qualifies, human reviews before package |
| **Phase 4** | Autonomous | Full pipeline with approval checkpoints |

### Phase 1 → 2 Criteria
- Pricing extraction accuracy > 95%
- User comfortable with AI deal creation

### Phase 2 → 3 Criteria
- Deal creation accuracy > 95%
- Document status tracking works

### Phase 3 → 4 Criteria
- Qualification decisions match human 95%+
- Buyer matching is accurate
- User opts in per deal type

---

## 14. Edge Cases

| Scenario | Handling |
|----------|----------|
| Multiple properties same seller | Create separate deals, link via company |
| Seller has broker | Note broker, continue with principal |
| Price changes mid-conversation | Update fields, keep history in activity |
| Duplicate deal | Warn on creation, offer to view existing |
| Ghosted then revived | Clear ghosted_at, resume workflow |
| All docs "not available" | Allow qualification with explanation |
| Lost deal revived | Allow status change back from 'lost' |
| Pricing in non-USD | Convert and note original |

---

## 15. Integration Points

| System | Integration |
|--------|-------------|
| **Inbox** | Deal creation from hot leads, email history |
| **People** | Linked contacts and companies |
| **Tasks** | review_deal, doc_follow_up tasks |
| **Calls** | Scheduled calls linked to deals |
| **Campaigns** | Original outreach that started deal |
| **Searches** | Buyer matching on package |
| **Data pages** | Property details |

---

## 16. Database Views

### deal_pipeline View

Provides the main pipeline view with computed fields:
- `pricing_fields_filled` (0-3)
- `pipeline_status` (Ready for Handoff, Ready to Package, etc.)

### pending_doc_follow_ups View

Deals needing document follow-up:
- Documents requested/promised
- 3+ days since last follow-up
- Less than 3 follow-ups sent

### potential_ghosts View

Deals that may have gone cold:
- 10+ days since response
- 2+ follow-ups sent
- Not yet marked ghosted
