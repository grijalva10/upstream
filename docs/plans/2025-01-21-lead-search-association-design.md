# Lead-Search Association Design

**Date:** 2025-01-21
**Status:** Approved

## Problem

When a lead says "I don't want to sell, but I'm looking for X," we need to capture their buyer criteria. Currently there's no way to associate a search (buyer criteria) with a lead.

## Solution

Link searches to leads so we can:
1. Create searches representing a buyer's criteria
2. View a lead's searches from their detail page
3. Run campaigns targeting sellers on behalf of that buyer

## Database Schema

Add a single column to the `searches` table:

```sql
ALTER TABLE searches
ADD COLUMN source_lead_id UUID REFERENCES leads(id);
```

This mirrors the existing `source_contact_id` pattern. A search represents one buyer's criteria - if multiple buyers have similar criteria, they get separate searches.

## Search Form Updates

Update the existing search creation/edit form to include a lead selector.

**New field: "Source Lead"** (optional)
- Combobox with search/autocomplete
- Shows existing leads filtered by typed text
- "Create new lead" option at bottom when no match found
- Creating new lead: name only, sets `lead_type: 'buyer'`

**Field placement:** Near the top, before criteria fields ("Who is this search for?" then "What are they looking for?")

**Behavior:**
- If editing existing search, shows currently linked lead
- Can clear the field (search not linked to any lead)
- New lead created inline is immediately linked

## Lead Detail Page - Searches Card

Add a new card to the left sidebar showing searches linked to this lead.

**Location:** Left sidebar, after existing cards (Contacts, Tasks, Properties, Deals)

**Card content:**
- Header: "Searches" with count badge
- List of searches where `source_lead_id = this lead`
- Each item shows:
  - Search name (linked to `/searches/[id]`)
  - Status badge (e.g., "extracted", "campaign_active")
  - Created date
- Empty state: "No searches yet"
- "+ Add Search" button in header (opens search form with lead pre-filled)

## Implementation Checklist

1. **Migration** - Add `source_lead_id` column to `searches` table

2. **Search form** - Add lead combobox with:
   - Search existing leads
   - Create new lead inline (name only, sets `lead_type: 'buyer'`)

3. **Lead detail page** - Add `SearchesCard` component:
   - Query searches where `source_lead_id = lead.id`
   - Display name, status, date
   - Link to search detail
   - "+ Add Search" opens `/searches/new?leadId={id}`

4. **API updates**:
   - Update search create/update endpoints to accept `source_lead_id`
   - Add endpoint to create lead inline if needed

## Not Included (YAGNI)

- No campaign management from lead page (click through to search)
- No bulk operations
- No search editing from lead page
