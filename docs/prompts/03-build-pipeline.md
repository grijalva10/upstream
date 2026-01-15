# Build Pipeline Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → Campaigns → **Pipeline** → Calls → Dashboard

We're building **Pipeline** - Kanban-style deal tracking through qualification stages.

## What Pipeline Does

1. Deals are created when someone replies "interested" or provides pricing
2. Deals move through stages: Qualifying → Qualified → Packaged → Handed Off → Closed
3. Each deal tracks qualification requirements (price, NOI, motivation, timeline, decision maker)
4. Packaged deals can be sent to lee-1031-x or handed to Brian directly

## Database

The migration `supabase/migrations/00017_upstream_v2_schema.sql` creates:

```sql
-- deals (seller opportunities being qualified)
deals:
  id UUID PRIMARY KEY,
  display_id TEXT UNIQUE, -- DEAL-000001 (auto-generated)

  -- Related entities
  property_id UUID REFERENCES properties(id),
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  search_id UUID REFERENCES searches(id),
  enrollment_id UUID REFERENCES enrollments(id),

  -- Status: qualifying → qualified → packaged → handed_off → closed → lost
  status TEXT DEFAULT 'qualifying',

  -- Qualification fields
  asking_price NUMERIC,
  noi NUMERIC,
  cap_rate NUMERIC,
  motivation TEXT, -- why selling
  timeline TEXT, -- when want to close
  decision_maker_confirmed BOOLEAN DEFAULT FALSE,
  price_realistic BOOLEAN,

  -- Documents
  rent_roll_url TEXT,
  operating_statement_url TEXT,
  other_docs JSONB, -- array of {name, url}

  -- Loan info
  loan_amount NUMERIC,
  loan_maturity DATE,
  loan_rate NUMERIC,
  lender_name TEXT,

  -- Package fields (for lee-1031-x export)
  investment_summary TEXT,
  investment_highlights JSONB, -- array of bullets
  admin_notes TEXT,

  -- Handoff tracking
  handed_off_to TEXT, -- 'brian' or 'lee-1031-x'
  handed_off_at TIMESTAMPTZ,
  lee_1031_x_deal_id TEXT,

  created_at, updated_at

-- deal_activity (timeline)
deal_activity:
  id UUID PRIMARY KEY,
  deal_id UUID REFERENCES deals(id),
  activity_type TEXT, -- email_sent, email_received, call_scheduled, call_completed, doc_received, status_change, note_added, handed_off
  description TEXT,
  metadata JSONB,
  created_at, created_by
```

## Tasks

### 1. Create Pipeline Kanban Page

Create `apps/web/src/app/(app)/pipeline/page.tsx`:

Kanban board with columns:
- **Qualifying** (default) - Working to get required info
- **Qualified** - Has all requirements met
- **Packaged** - Deal summary created
- **Handed Off** - Sent to Brian or lee-1031-x
- **Closed** - Deal completed
- **Lost** - Deal fell through

Each column shows:
- Column header with count
- Deal cards (draggable between columns)

Deal card shows:
- Display ID (DEAL-000001)
- Property address
- Company/Contact name
- Asking price (if known)
- Qualification progress indicator
- Days in stage
- Click → opens detail

Top bar:
- Search deals by property/company
- Filter by source search
- "New Deal" button (manual entry)

### 2. Create Deal Detail Page

Create `apps/web/src/app/(app)/pipeline/[id]/page.tsx`:

**Header:**
- Display ID + Status badge
- Property: Address, Type, SqFt, Class
- Contact: Name, Company, Email, Phone
- Quick actions: Schedule Call, Send Email, Add Note

**Two-column layout:**

Left column (60%):

**Qualification Card:**
Checklist with status indicators:
- [ ] Asking Price: $_____ (input or "Unknown")
- [ ] NOI: $_____ (input or "Unknown")
- [ ] Cap Rate: ___% (calculated or input)
- [ ] Motivation: _____ (dropdown + text)
- [ ] Timeline: _____ (dropdown)
- [ ] Decision Maker: [ ] Confirmed

Progress bar showing completion (0-6 items)

**Documents Card:**
- Rent Roll: Upload or URL input
- Operating Statement: Upload or URL input
- Other docs: Add more button
- Each shows upload date and download link

**Loan Info Card:**
- Loan Amount
- Maturity Date
- Interest Rate
- Lender Name

**Package Preview Card:** (only when qualified)
- Investment Summary (AI-generated or manual)
- Investment Highlights (bullet points)
- Admin Notes
- "Generate Package" button
- "Export to lee-1031-x" button

Right column (40%):

**Activity Timeline:**
- Chronological list of all events
- Email sent/received
- Call scheduled/completed
- Document uploaded
- Note added
- Status changes
- Each entry shows timestamp, type icon, description

**Add Note Form:**
- Textarea
- "Add Note" button

### 3. Create Deal Card Component

Create `apps/web/src/app/(app)/pipeline/_components/deal-card.tsx`:

```tsx
// Card content:
// - Display ID badge
// - Property address (truncated)
// - Company name
// - Price badge (if known): "$1.2M" or "TBD"
// - Qualification progress: "4/6" with mini progress bar
// - Days in stage: "5d"
// - Activity indicator (dot if recent activity)
```

### 4. Create API Routes

`apps/web/src/app/api/deals/route.ts`:
- GET: List deals with filters (status, search_id)
- POST: Create new deal

`apps/web/src/app/api/deals/[id]/route.ts`:
- GET: Deal details with property, contact, company
- PATCH: Update deal fields

`apps/web/src/app/api/deals/[id]/activity/route.ts`:
- GET: List activities for deal
- POST: Add activity/note

`apps/web/src/app/api/deals/[id]/status/route.ts`:
- PATCH: Change deal status (for drag-drop)

`apps/web/src/app/api/deals/[id]/package/route.ts`:
- POST: Generate deal package (calls AI to create summary)

### 5. Qualification Requirements

A deal is "Qualified" when it has:
1. Asking Price (or "will consider offers")
2. NOI (or rent roll to calculate)
3. Motivation (why selling)
4. Timeline (when want to close)
5. Decision Maker confirmed

Cap Rate can be calculated: Cap Rate = NOI / Price

### 6. Deal Package Structure

When packaging for lee-1031-x:

```json
{
  "display_id": "DEAL-000001",
  "property": {
    "address": "123 Industrial Way",
    "city": "Phoenix",
    "state": "AZ",
    "type": "Industrial",
    "sqft": 50000,
    "year_built": 2005
  },
  "seller": {
    "company": "ABC Holdings LLC",
    "contact": "John Smith",
    "email": "john@abc.com",
    "phone": "555-1234"
  },
  "pricing": {
    "asking_price": 5000000,
    "noi": 400000,
    "cap_rate": 8.0
  },
  "motivation": "Estate planning - owner retiring",
  "timeline": "90-120 days",
  "loan": {
    "amount": 3000000,
    "maturity": "2025-06-01",
    "rate": 4.5,
    "lender": "Wells Fargo"
  },
  "investment_summary": "AI-generated narrative...",
  "investment_highlights": [
    "Single tenant NNN lease",
    "7 years remaining on lease",
    "Below market rent with escalations"
  ],
  "documents": {
    "rent_roll_url": "...",
    "operating_statement_url": "..."
  }
}
```

## Existing Patterns

Look at:
- `apps/web/src/app/(app)/jobs/page.tsx` - Data tables
- No existing Kanban - you may need dnd-kit for drag-drop
- `apps/web/src/components/ui/card.tsx` - Card component

## UI Components

- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/input`
- `@/components/ui/textarea`
- `@/components/ui/select`
- `@/components/ui/checkbox`
- `@/components/ui/progress`
- Consider `@dnd-kit/core` for drag-drop (install if needed)

## Don't

- Don't implement actual lee-1031-x API integration yet
- Don't implement document upload storage yet (just URL inputs)
- Don't implement email sending from this page (just link to compose)

## Verify

After building:
1. Can navigate to /pipeline from sidebar
2. See Kanban board with deal columns
3. Can drag deal between columns
4. Can click deal card to open detail
5. Can update qualification fields
6. Can see activity timeline
7. Can add notes
8. Qualification progress updates as fields are filled
9. "Qualified" badge appears when all requirements met
