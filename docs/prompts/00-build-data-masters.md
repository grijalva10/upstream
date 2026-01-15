# Build Data (Masters) Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → Campaigns → Pipeline → Calls → Dashboard

We're building **Data** - the master views for all contacts, companies, and properties.

## What Data Page Does

A unified view of all extracted data with a left sidebar for navigation:
- `/data/contacts` - All contacts across all searches
- `/data/companies` - All companies (property owners)
- `/data/properties` - All properties extracted

This is a CRM-style view for browsing/searching the database.

## Database Tables

Run migration first: `supabase/migrations/00017_upstream_v2_schema.sql`

```sql
-- contacts (updated with buyer/seller flags)
contacts: id, company_id, first_name, last_name, title, email, phone,
          status, is_buyer, is_seller, is_decision_maker, created_at

-- companies (updated with buyer/seller flags)
companies: id, name, status, address, city, state, zip, phone, website,
           notes, is_buyer, is_seller, created_at

-- properties
properties: id, costar_id, address, city, state, zip, property_type, building_class,
            sqft, year_built, units, floors, latitude, longitude, created_at

-- Status values:
-- contacts.status: active, dnc, bounced, bad_contact
-- companies.status: new, contacted, engaged, qualified, dnc
```

## Tasks

### 1. Create Data Layout

Create `apps/web/src/app/(app)/data/layout.tsx`:

```tsx
// Layout with left sidebar for sub-navigation
export default function DataLayout({ children }) {
  return (
    <div className="flex h-full">
      <aside className="w-48 border-r p-4">
        <h2 className="font-semibold mb-4">Data</h2>
        <nav className="space-y-1">
          <Link href="/data/contacts">Contacts</Link>
          <Link href="/data/companies">Companies</Link>
          <Link href="/data/properties">Properties</Link>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

### 2. Create Contacts Page

Create `apps/web/src/app/(app)/data/contacts/page.tsx`:

- Table with columns: Name, Company, Email, Phone, Status
- Status badges: active (green), dnc (red), bounced (orange), bad_contact (gray)
- Search box (filter by name/email)
- Filter by status
- Pagination (20 per page)
- Click row → contact detail (future)

### 3. Create Companies Page

Create `apps/web/src/app/(app)/data/companies/page.tsx`:

- Table with columns: Name, Location (city, state), Status, Properties Count, Contacts Count
- Status badges: new, contacted, engaged, qualified, dnc
- Search box
- Filter by status
- Pagination
- Click row → company detail (future)

### 4. Create Properties Page

Create `apps/web/src/app/(app)/data/properties/page.tsx`:

- Table with columns: Address, City/State, Type, Class, SqFt, Year Built
- Property type badges (Industrial, Office, Retail, etc.)
- Class badges (A, B, C)
- Search box (address)
- Filter by type, class
- Pagination

### 5. Create API Routes

`apps/web/src/app/api/data/contacts/route.ts`:
```typescript
// GET with pagination, search, filters
// Query params: page, limit, search, status
```

`apps/web/src/app/api/data/companies/route.ts`:
```typescript
// GET with pagination, search, filters
// Include property_count and contact_count
```

`apps/web/src/app/api/data/properties/route.ts`:
```typescript
// GET with pagination, search, filters
// Query params: page, limit, search, property_type, building_class
```

### 6. Default Route

Create `apps/web/src/app/(app)/data/page.tsx`:
- Redirect to `/data/contacts` or show overview stats

## Existing Patterns

Look at:
- `apps/web/src/app/(app)/jobs/page.tsx` - Table with pagination
- `apps/web/src/app/(app)/jobs/_components/jobs-data-table.tsx` - Data table pattern

## UI Components

- Use existing table patterns (see jobs page)
- Badge component for status
- Input for search
- Select for filters
- Pagination controls

## Don't

- Don't implement detail views yet (click → detail page)
- Don't implement edit/delete yet
- Don't add bulk actions yet

## Verify

After building:
1. `/data` shows left sidebar with Contacts, Companies, Properties links
2. Each page shows table with data from database
3. Search filters the table
4. Status filters work
5. Pagination works (next/prev, rows per page)
