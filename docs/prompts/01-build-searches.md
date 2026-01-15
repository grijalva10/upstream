# Build Searches Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → Campaigns → Pipeline → Calls → Dashboard

We're building **Searches** - the page where users create and manage property searches.

## What Searches Does

1. User pastes buyer criteria JSON (from lee-1031-x or manual)
2. Sourcing agent generates strategy + CoStar payloads
3. CoStar extraction runs → produces properties, companies, contacts
4. User can then create a Campaign from search results

## Database

Run migration first: `supabase/migrations/00017_upstream_v2_schema.sql`

```sql
-- searches table (new)
searches:
  id UUID PRIMARY KEY,
  name TEXT,
  source TEXT, -- 'lee-1031-x', 'manual', 'inbound'
  source_contact_id UUID, -- if inbound (from reply)
  criteria_json JSONB,
  strategy_summary TEXT,
  payloads_json JSONB,
  total_properties INT,
  total_companies INT,
  total_contacts INT,
  status TEXT, -- pending_queries → extracting → ready → campaign_created
  created_at, updated_at

-- search_properties junction (new)
search_properties:
  search_id UUID,
  property_id UUID,
  created_at
```

Note: The old `client_criteria` table still exists. For backward compatibility, you can query both or migrate data later.

## Tasks

### 1. Update Sidebar

Update `apps/web/src/components/sidebar.tsx`:

```typescript
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/searches", icon: Search, label: "Searches" },
  { href: "/campaigns", icon: Mail, label: "Campaigns" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/pipeline", icon: Kanban, label: "Pipeline" },
  { href: "/calls", icon: Phone, label: "Calls" },
  { href: "/data", icon: Database, label: "Data" },
  { href: "/jobs", icon: Layers, label: "Jobs" },
  { href: "/settings", icon: Settings, label: "Settings" },
];
```

### 2. Create Searches List Page

Create `apps/web/src/app/(app)/searches/page.tsx`:

- Fetch all searches from `searches` table
- Display as cards with:
  - Name
  - Source (client name or "Manual")
  - Status badge (pending, extracting, ready, has campaign)
  - Counts (properties, companies, contacts)
  - Created date
  - Actions: View, Create Campaign (if ready)
- "New Search" button opens dialog
- Filter tabs: All, Pending, Ready, Has Campaign

### 3. Create New Search Dialog

Create `apps/web/src/app/(app)/searches/_components/new-search-dialog.tsx`:

- Textarea for pasting criteria JSON
- "Format JSON" button
- Validate JSON structure
- On submit: POST to `/api/searches` which:
  - Creates client if needed
  - Creates client_criteria record with status 'pending_queries'
  - Queues sourcing agent task
- Show success with link to view search

### 4. Create Search Detail Page

Create `apps/web/src/app/(app)/searches/[id]/page.tsx`:

Tabs:
- **Overview**: Criteria summary, status, counts
- **Strategy**: Agent-generated strategy (if available)
- **Results**: Preview of properties/contacts found
- **Campaign**: Link to campaign if created, or "Create Campaign" button

### 5. Create API Routes

`apps/web/src/app/api/searches/route.ts`:
- GET: List all searches
- POST: Create new search (same logic as current `/api/sourcing-agent`)

`apps/web/src/app/api/searches/[id]/route.ts`:
- GET: Get search details with related data

## Existing Patterns

Look at these for reference:
- `apps/web/src/app/(app)/jobs/page.tsx` - Page with tabs
- `apps/web/src/app/(app)/clients/_components/new-criteria-dialog.tsx` - Dialog for JSON input
- `apps/web/src/app/(app)/settings/page.tsx` - Simple list page

## UI Components Available

- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/dialog`
- `@/components/ui/tabs`
- `@/components/ui/textarea`

## Don't

- Don't build the Campaign creation flow yet (that's next step)
- Don't implement the sourcing agent execution (worker handles that)
- Don't delete existing `/clients` page yet (we'll migrate later)

## Verify

After building:
1. Can navigate to /searches from sidebar
2. Can see list of existing searches (from client_criteria)
3. Can create a new search by pasting JSON
4. Can view search detail page with tabs
5. Search shows status progression
