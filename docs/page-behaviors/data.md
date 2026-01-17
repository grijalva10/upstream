# Data Pages Behavior Spec

> **Mode:** Read-heavy with occasional edits

---

## 1. Overview

The Data section provides master data views for the three core entities: Properties, Companies, and Contacts. These are searchable, filterable tables for exploring and managing the extracted data.

**Routes:**
- `/data/properties` - Property records
- `/data/companies` - Company records
- `/data/contacts` - Contact records

---

## 2. Common Features

All three data pages share these features:

### Table Features

| Feature | Description |
|---------|-------------|
| **Column sorting** | Click header to sort ASC/DESC |
| **Column filtering** | Filter icon opens filter popover |
| **Column visibility** | Toggle columns via settings |
| **Pagination** | Configurable page size (25, 50, 100) |
| **Row selection** | Checkboxes for bulk actions |
| **Quick search** | Global text search |
| **Export** | CSV/Excel export |
| **Saved views** | Save filter/sort configurations |

### URL Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `search` | Linked search ID | `?search=uuid` |
| `company` | Linked company ID | `?company=uuid` |
| `contact` | Linked contact ID | `?contact=uuid` |
| `q` | Text search query | `?q=industrial` |
| `page` | Page number | `?page=2` |
| `limit` | Page size | `?limit=50` |
| `sort` | Sort column | `?sort=created_at` |
| `order` | Sort direction | `?order=desc` |

---

## 3. Properties Page (/data/properties)

### Purpose

View and manage CRE property records extracted from CoStar. Used for:
- Reviewing search results
- Finding property details
- Linking properties to deals

### Columns

| Column | Type | Sortable | Filterable | Default Visible |
|--------|------|----------|------------|-----------------|
| Address | Text | Yes | Yes | Yes |
| Property Name | Text | Yes | Yes | Yes |
| Property Type | Enum | Yes | Yes | Yes |
| Building Size | Number | Yes | Yes (range) | Yes |
| Year Built | Number | Yes | Yes (range) | Yes |
| Building Class | Enum | Yes | Yes | Yes |
| Percent Leased | Percent | Yes | Yes (range) | Yes |
| Market | Relation | Yes | Yes | Yes |
| Owner | Relation | Yes | Yes | No |
| First Seen | Date | Yes | Yes (range) | No |
| Last Seen | Date | Yes | Yes (range) | No |
| Created | Date | Yes | Yes (range) | No |

### Property Type Options

| Type | Icon |
|------|------|
| Industrial | Factory |
| Office | Building2 |
| Retail | Store |
| Multifamily | Home |
| Land | TreePine |
| Hospitality | Hotel |
| Healthcare | HeartPulse |
| Special Purpose | Star |

### Building Class Options

| Class | Description |
|-------|-------------|
| A | Premium, newest |
| B | Average |
| C | Older, lower quality |

### Actions

| Action | Trigger | What It Does |
|--------|---------|--------------|
| **View property** | Click row | Opens detail panel |
| **View owner** | Click owner link | Navigate to company |
| **View in search** | Filter button | Shows originating search |
| **Create deal** | "Create Deal" button | Opens deal creation |
| **Export** | "Export" button | Downloads filtered data |

### Detail Panel

| Section | Contents |
|---------|----------|
| **Header** | Address, property name, type badge |
| **Key Metrics** | Size, year built, class, occupancy |
| **Location** | Market, full address, map |
| **Ownership** | Owner company, contacts |
| **Loan Data** | Maturity, LTV, DSCR, status |
| **Activity** | Related deals, emails, calls |
| **History** | First/last seen, update log |

### Database Queries

```sql
-- Basic list query
SELECT p.*, m.name as market_name,
       c.name as owner_name
FROM properties p
LEFT JOIN markets m ON p.market_id = m.id
LEFT JOIN property_companies pc ON pc.property_id = p.id AND pc.relationship = 'owner'
LEFT JOIN companies c ON pc.company_id = c.id
ORDER BY p.created_at DESC
LIMIT 25 OFFSET 0;

-- Filter by search
SELECT p.* FROM properties p
JOIN search_properties sp ON sp.property_id = p.id
WHERE sp.search_id = :search_id;
```

---

## 4. Companies Page (/data/companies)

### Purpose

View and manage company (owner/organization) records. Used for:
- Tracking lead status
- Viewing property portfolios
- Managing outreach status

### Columns

| Column | Type | Sortable | Filterable | Default Visible |
|--------|------|----------|------------|-----------------|
| Name | Text | Yes | Yes | Yes |
| Status | Enum | Yes | Yes | Yes |
| Type | Enum | Yes | Yes | Yes |
| Properties | Count | Yes | Yes (range) | Yes |
| Contacts | Count | Yes | No | Yes |
| Active Deals | Count | Yes | Yes | Yes |
| Last Contacted | Date | Yes | Yes (range) | Yes |
| Source | Enum | Yes | Yes | No |
| Created | Date | Yes | Yes (range) | No |

### Company Types

| Type | Description | Icon |
|------|-------------|------|
| owner | Property owner organization | Building |
| buyer | Buyer/investor organization | TrendingUp |
| broker | Brokerage firm | Users |
| other | Catch-all | HelpCircle |

### Status Flow

```
new → contacted → engaged → qualified → handed_off
          ↓          ↓          ↓
          └──────────┴──────────┴───→ dnc | rejected
```

### Status Colors

| Status | Color | Badge |
|--------|-------|-------|
| new | Gray | Default |
| contacted | Blue | Primary |
| engaged | Green | Success |
| qualified | Purple | Secondary |
| handed_off | Slate | Muted |
| dnc | Red | Destructive |
| rejected | Gray | Outline |

### Actions

| Action | Trigger | What It Does |
|--------|---------|--------------|
| **View company** | Click row | Opens detail panel |
| **View properties** | Properties count link | Navigate to filtered properties |
| **View contacts** | Contacts count link | Navigate to filtered contacts |
| **Change status** | Status dropdown | Updates company status |
| **Add to DNC** | Menu action | Sets status to dnc |
| **Export** | "Export" button | Downloads filtered data |

### Detail Panel

| Section | Contents |
|---------|----------|
| **Header** | Name, status badge, type badge |
| **Summary** | Property count, contact count, deal count |
| **Contacts** | List of people at company |
| **Properties** | Properties owned by company |
| **Deals** | Active and past deals |
| **Activity** | Email, call, note history |
| **Notes** | Company notes |

### Database Queries

```sql
-- List with counts
SELECT c.*,
       (SELECT COUNT(*) FROM property_companies pc WHERE pc.company_id = c.id) as property_count,
       (SELECT COUNT(*) FROM contacts ct WHERE ct.company_id = c.id) as contact_count,
       (SELECT COUNT(*) FROM deals d WHERE d.company_id = c.id AND d.status NOT IN ('lost', 'handed_off')) as active_deal_count
FROM companies c
ORDER BY c.status_changed_at DESC
LIMIT 25 OFFSET 0;
```

---

## 5. Contacts Page (/data/contacts)

### Purpose

View and manage contact (person) records. Used for:
- Finding contact information
- Managing contact status
- Tracking outreach history

### Columns

| Column | Type | Sortable | Filterable | Default Visible |
|--------|------|----------|------------|-----------------|
| Name | Text | Yes | Yes | Yes |
| Email | Text | Yes | Yes | Yes |
| Phone | Text | Yes | No | Yes |
| Title | Text | Yes | Yes | No |
| Company | Relation | Yes | Yes | Yes |
| Type | Enum | Yes | Yes | Yes |
| Status | Enum | Yes | Yes | Yes |
| Last Contacted | Date | Yes | Yes (range) | Yes |
| Source | Enum | Yes | Yes | No |
| Created | Date | Yes | Yes (range) | No |

### Contact Types

(See People page spec for full type list)

| Type | Icon |
|------|------|
| seller | DollarSign |
| buyer | TrendingUp |
| broker | Users |
| tenant | Building2 |
| team | Shield |
| vendor | Package |
| other | HelpCircle |

### Status Colors

| Status | Color |
|--------|-------|
| active | Green |
| dnc | Red |
| bounced | Yellow |
| unsubscribed | Gray |

### Actions

| Action | Trigger | What It Does |
|--------|---------|--------------|
| **View contact** | Click row | Opens detail panel |
| **View company** | Company link | Navigate to company |
| **Send email** | Email icon | Opens compose |
| **Call** | Phone icon | Opens dialer/scheduler |
| **Change status** | Status dropdown | Updates contact status |
| **Change type** | Type dropdown | Updates contact type |
| **Export** | "Export" button | Downloads filtered data |

### Detail Panel

| Section | Contents |
|---------|----------|
| **Header** | Name, type badge, status badge |
| **Contact Info** | Email, phone, title |
| **Company** | Linked company info |
| **Properties** | Properties linked via company |
| **Deals** | Deals involving this contact |
| **Activity** | Email, call, note history |
| **Campaign** | Active sequence enrollments |

### Database Queries

```sql
-- List with company
SELECT ct.*, c.name as company_name, c.status as company_status
FROM contacts ct
LEFT JOIN companies c ON ct.company_id = c.id
ORDER BY ct.last_contacted_at DESC NULLS LAST
LIMIT 25 OFFSET 0;

-- Filter by company
SELECT * FROM contacts WHERE company_id = :company_id;

-- Filter by search (via properties → companies)
SELECT DISTINCT ct.* FROM contacts ct
JOIN companies c ON ct.company_id = c.id
JOIN property_companies pc ON pc.company_id = c.id
JOIN search_properties sp ON sp.property_id = pc.property_id
WHERE sp.search_id = :search_id;
```

---

## 6. Cross-Navigation

### From Properties

| Link | Destination |
|------|-------------|
| Owner company | `/data/companies?id={company_id}` |
| Search | `/searches/{search_id}` |
| Market | Filter by market |
| Create deal | `/deals/new?property={property_id}` |

### From Companies

| Link | Destination |
|------|-------------|
| Properties | `/data/properties?company={company_id}` |
| Contacts | `/data/contacts?company={company_id}` |
| Deals | `/deals?company={company_id}` |
| Activity | Opens activity panel |

### From Contacts

| Link | Destination |
|------|-------------|
| Company | `/data/companies?id={company_id}` |
| Properties | `/data/properties?company={company_id}` |
| Deals | `/deals?contact={contact_id}` |
| Inbox | `/inbox?contact={contact_id}` |

---

## 7. Bulk Actions

### Properties

| Action | What It Does |
|--------|--------------|
| Export selected | Downloads selected rows |
| Add to list | Creates/adds to extraction list |

### Companies

| Action | What It Does |
|--------|--------------|
| Export selected | Downloads selected rows |
| Change status | Bulk status update |
| Add to DNC | Bulk DNC addition |

### Contacts

| Action | What It Does |
|--------|--------------|
| Export selected | Downloads selected rows |
| Change status | Bulk status update |
| Change type | Bulk type update |
| Enroll in campaign | Add to campaign |
| Add to DNC | Bulk DNC addition |

---

## 8. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `data-table.tsx` | `components/data-table/` | Reusable data table |
| `column-header.tsx` | `components/data-table/` | Sortable column header |
| `filter-popover.tsx` | `components/data-table/` | Column filter UI |
| `pagination.tsx` | `components/data-table/` | Page navigation |
| `export-button.tsx` | `components/data-table/` | Export functionality |
| `properties/page.tsx` | `data/properties/` | Properties page |
| `companies/page.tsx` | `data/companies/` | Companies page |
| `contacts/page.tsx` | `data/contacts/` | Contacts page |
| `property-detail.tsx` | `data/properties/_components/` | Property detail panel |
| `company-detail.tsx` | `data/companies/_components/` | Company detail panel |
| `contact-detail.tsx` | `data/contacts/_components/` | Contact detail panel |

---

## 9. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/data/properties` | GET | List properties with filters |
| `/api/data/properties/[id]` | GET | Get property details |
| `/api/data/properties/export` | POST | Export properties |
| `/api/data/companies` | GET | List companies with filters |
| `/api/data/companies/[id]` | GET | Get company details |
| `/api/data/companies/[id]` | PATCH | Update company |
| `/api/data/companies/export` | POST | Export companies |
| `/api/data/contacts` | GET | List contacts with filters |
| `/api/data/contacts/[id]` | GET | Get contact details |
| `/api/data/contacts/[id]` | PATCH | Update contact |
| `/api/data/contacts/export` | POST | Export contacts |

---

## 10. Search Result Linking

When navigating from a search result page:

```
/searches/{id} → View Properties → /data/properties?search={id}
                → View Companies → /data/companies?search={id}
                → View Contacts → /data/contacts?search={id}
```

The data pages filter to show only records linked to that search via:
- `search_properties` junction for properties
- `property_companies` junction for companies
- `contacts` via company for contacts

---

## 11. Performance Considerations

| Strategy | Implementation |
|----------|----------------|
| **Virtual scrolling** | Use for large datasets (1000+ rows) |
| **Server pagination** | Always paginate on server |
| **Index coverage** | Ensure indexes cover common filters |
| **Debounced search** | 300ms debounce on text search |
| **Column memoization** | Memoize column definitions |
| **Lazy detail loading** | Load detail panel data on demand |

---

## 12. Edge Cases

| Scenario | Handling |
|----------|----------|
| No results | Show empty state with suggestion |
| Search returns 10K+ | Show warning, suggest filters |
| Deleted linked record | Show "(deleted)" indicator |
| Stale data | Show refresh button, auto-refresh option |
| Export timeout | Use background job, email result |
| Duplicate records | Show merge suggestion |
| Invalid filter combination | Show validation error |

---

## 13. Integration Points

| System | Integration |
|--------|-------------|
| **Searches** | Linked via search_properties |
| **Deals** | Create deals from properties |
| **Campaigns** | Enroll contacts |
| **Inbox** | View email history |
| **People** | Unified contact view |
| **Export** | CSV/Excel download |
