# /prep - Call Prep Sheet

Generate a call prep sheet for a contact or lead. Pass the name as an argument.

**Usage:** `/prep John Smith` or `/prep ABC Properties LLC`

## What to Query

### 1. Find the Contact/Lead
```sql
-- First try to find by contact name
SELECT
  c.id, c.name, c.email, c.phone, c.title,
  c.contact_type, c.is_decision_maker,
  c.lead_id, c.last_contacted_at,
  l.name AS lead_name, l.status AS lead_status
FROM contacts c
LEFT JOIN leads l ON c.lead_id = l.id
WHERE c.name ILIKE '%{argument}%' OR c.email ILIKE '%{argument}%'
LIMIT 5;

-- Or by lead name
SELECT id, name, status
FROM leads
WHERE name ILIKE '%{argument}%'
LIMIT 5;
```

### 2. Get Full Contact + Lead Details
```sql
SELECT
  c.id AS contact_id,
  c.name AS contact_name,
  c.email,
  c.phone,
  c.title,
  c.contact_type,
  c.is_decision_maker,
  l.id AS lead_id,
  l.name AS lead_name,
  l.status AS lead_status,
  l.has_broker,
  l.broker_contact
FROM contacts c
JOIN leads l ON c.lead_id = l.id
WHERE c.id = '{contact_id}';
```

### 3. Get Properties for this Lead
```sql
SELECT
  p.id,
  p.address,
  p.property_name,
  p.property_type,
  p.building_size_sqft,
  p.land_size_acres,
  p.year_built,
  p.building_class,
  p.percent_leased,
  pl.relationship_type
FROM properties p
JOIN property_leads pl ON p.id = pl.property_id
WHERE pl.lead_id = '{lead_id}';
```

### 4. Get Loan Data
```sql
SELECT
  pln.property_id,
  pln.lender_name,
  pln.loan_amount,
  pln.origination_date,
  pln.maturity_date,
  pln.interest_rate,
  pln.interest_rate_type,
  pln.ltv_current,
  pln.dscr_current,
  pln.special_servicing_status,
  pln.watchlist_status,
  pln.payment_status,
  pln.is_balloon
FROM property_loans pln
JOIN property_leads pl ON pln.property_id = pl.property_id
WHERE pl.lead_id = '{lead_id}';
```

### 5. Get Deal Status
```sql
SELECT
  d.id,
  d.display_id,
  d.status,
  d.asking_price,
  d.noi,
  d.cap_rate,
  d.motivation,
  d.timeline,
  d.decision_maker_confirmed,
  d.rent_roll_status,
  d.operating_statement_status,
  d.created_at,
  d.qualified_at
FROM deals d
WHERE d.lead_id = '{lead_id}'
ORDER BY d.created_at DESC
LIMIT 1;
```

### 6. Get Recent Emails (last 5)
```sql
SELECT
  se.id,
  se.direction,
  se.from_email,
  se.subject,
  se.body_text,
  se.classification,
  se.extracted_pricing,
  se.received_at,
  se.sent_at
FROM synced_emails se
WHERE se.matched_lead_id = '{lead_id}'
   OR se.matched_contact_id = '{contact_id}'
ORDER BY COALESCE(se.received_at, se.sent_at) DESC
LIMIT 5;
```

## Output Format

Create a **markdown artifact** with this structure:

```markdown
# Call Prep: {Contact Name}

## Contact Info
- **Name:** {name}
- **Title:** {title}
- **Phone:** {phone} (clickable)
- **Email:** {email}
- **Lead:** {lead_name}
- **Role:** {contact_type} | Decision Maker: {yes/no}

## Property Details
| Field | Value |
|-------|-------|
| Address | {address} |
| Type | {property_type} |
| Size | {building_size_sqft} SF |
| Year Built | {year_built} |
| Class | {building_class} |
| Occupancy | {percent_leased}% |

## Loan Pressure Signals
| Signal | Status |
|--------|--------|
| Maturity Date | {date} ({N months away}) |
| LTV | {ltv}% |
| DSCR | {dscr}x |
| Special Servicing | {yes/no} |
| Watchlist | {yes/no} |
| Payment Status | {status} |

## Deal Status
- **Stage:** {status}
- **Asking Price:** ${asking_price}
- **NOI:** ${noi}
- **Cap Rate:** {cap_rate}%
- **Motivation:** {motivation}
- **Timeline:** {timeline}
- **Docs:** Rent Roll ({status}), T12 ({status})

## Recent Conversation
{Summarize last 5 emails - who said what}

## Talking Points
Based on their situation, suggest:
1. {Point based on loan maturity or distress signals}
2. {Point based on their stated motivation/timeline}
3. {Point based on property characteristics}
4. {Point to advance the deal to next stage}
```

## Key Rules

- Format phone as clickable `tel:` link
- Calculate months until loan maturity
- Highlight red flags (high LTV, low DSCR, special servicing)
- Summarize email thread, don't dump raw text
- Suggest relevant talking points based on their specific situation
- If no deal exists yet, note "No deal record - this may be initial outreach"
