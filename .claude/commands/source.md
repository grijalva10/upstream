# /source - Run Sourcing from Natural Language

Convert natural language buyer criteria into CoStar search payloads and run extraction.

**Usage:** `/source industrial OC, loan maturing 2026, under $10M`

## Step 1: Parse the Criteria

Interpret the natural language and map to CoStar filters using `reference/costar/sourcing-strategies.md`.

### Common Criteria Mappings

| Input | CoStar Filter |
|-------|---------------|
| "industrial" | `PropertyTypes: ["Industrial"]` |
| "office" | `PropertyTypes: ["Office"]` |
| "retail" | `PropertyTypes: ["Retail"]` |
| "multifamily" | `PropertyTypes: ["Multifamily"]` |
| "OC" / "Orange County" | `GeographyFilterTypes: 3` + `GeographyGroups: [{"Submarkets": [OC submarkets]}]` |
| "LA" / "Los Angeles" | `GeographyFilterTypes: 3` + `GeographyGroups: [{"Submarkets": [LA submarkets]}]` |
| "loan maturing 2026" | `Loan.HasLoan: true` + `Loan.MaturityDate: {Minimum: "2026-01-01", Maximum: "2026-12-31"}` |
| "under $10M" | `LastSoldPrice: {Maximum: 10000000}` or filter by size as proxy |
| "private owner" | `OwnerTypes: [1,2,4,5,8,9,11,12,14,15,18,19,20,21,23]` |
| "institutional" | `OwnerTypes: [3,6,7,10,13,16,17,22,24,25]` |
| "10+ year hold" | `LastSoldDate: {Maximum: "2016-01-01"}` |
| "distressed" | `Loan.PaymentStatuses: [2,3,4,5,6,8,9]` |
| "special servicing" | `Loan.SpecialServicingStatuses: [1]` |
| "high vacancy" | `Building.PercentLeased: {Maximum: 75}` |

### Build the Payload

Reference `reference/costar/payload-example.json` for structure:

```json
{
  "PageSize": 100,
  "Skip": 0,
  "SortOptions": [{"Field": "Sale.SaleDate", "Order": "Desc"}],
  "Property": {
    "PropertyTypes": ["Industrial"],
    "GeographyFilterTypes": 3,
    "GeographyGroups": [{"Submarkets": [...]}],
    "Loan": {
      "HasLoan": true,
      "MaturityDate": {"Minimum": "2026-01-01", "Maximum": "2026-12-31"}
    }
  }
}
```

## Step 2: Get Count First

Before running full extraction, get the count to confirm scope:

```bash
curl -X POST http://localhost:3002/costar/count \
  -H "Content-Type: application/json" \
  -d '{"payload": <your payload>}'
```

Present to user:
> Found **247 properties** matching: Industrial in OC with loans maturing 2026.
>
> Do you want to proceed with extraction?

## Step 3: Run Extraction (if approved)

```bash
curl -X POST http://localhost:3002/costar/search \
  -H "Content-Type: application/json" \
  -d '{"payload": <your payload>, "maxPages": 10}'
```

This will:
1. Call CoStar API (may require 2FA on first run)
2. Extract properties, companies, contacts
3. Save to database
4. Create a search record

## Step 4: Show Results

After extraction completes:

```sql
-- Get the search that was just created
SELECT
  s.id,
  s.name,
  s.total_properties,
  s.total_contacts,
  s.created_at
FROM searches s
ORDER BY s.created_at DESC
LIMIT 1;

-- Sample properties from this search
SELECT
  p.address,
  p.property_type,
  p.building_size_sqft,
  co.name AS owner_name,
  c.name AS contact_name,
  c.email,
  c.phone,
  pl.maturity_date,
  pl.ltv_current
FROM search_properties sp
JOIN properties p ON sp.property_id = p.id
LEFT JOIN property_companies pc ON p.id = pc.property_id
LEFT JOIN companies co ON pc.company_id = co.id
LEFT JOIN contacts c ON c.company_id = co.id
LEFT JOIN property_loans pl ON p.id = pl.property_id
WHERE sp.search_id = '{search_id}'
LIMIT 10;
```

Present:
> Extracted **247 properties** with **312 contacts**.
>
> Sample records:
> | Address | Type | Size | Owner | Contact | Loan Maturity |
> |---------|------|------|-------|---------|---------------|
> | 123 Main | Industrial | 50,000 SF | ABC LLC | John Smith | Mar 2026 |
> | ... | ... | ... | ... | ... | ... |
>
> Do you want to enroll these contacts in a drip campaign?

## Step 5: Campaign Enrollment (if approved)

If user wants to enroll in campaign:

```sql
-- Create campaign
INSERT INTO campaigns (name, search_id, status)
VALUES ('{criteria description}', '{search_id}', 'draft')
RETURNING id;

-- Show available sequences
SELECT id, name, description FROM sequences WHERE status = 'active';
```

Ask which sequence to use, then:

```sql
-- Create enrollments
INSERT INTO enrollments (campaign_id, contact_id, status)
SELECT
  '{campaign_id}',
  c.id,
  'pending'
FROM contacts c
JOIN companies co ON c.company_id = co.id
JOIN property_companies pc ON co.id = pc.company_id
JOIN search_properties sp ON pc.property_id = sp.property_id
WHERE sp.search_id = '{search_id}'
  AND c.status = 'active'
  AND c.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM email_exclusions ee WHERE ee.email = c.email);
```

## Reference Files

Always consult:
- `reference/costar/sourcing-strategies.md` - Query patterns
- `reference/costar/payload-example.json` - Payload structure
- `reference/costar/owner-types.json` - Owner type IDs

## Key Rules

- ALWAYS show count first and get approval before extraction
- CoStar service runs locally at http://localhost:3002
- Extraction may require 2FA via mobile phone
- Don't enroll contacts that are in email_exclusions
- Create search record to track provenance
