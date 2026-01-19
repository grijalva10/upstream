# /pipeline - Pipeline Snapshot

Quick view of the deal pipeline with funnel counts and active deals.

## What to Query

### 1. Funnel Counts
```sql
SELECT
  status,
  COUNT(*) as count
FROM deals
WHERE status NOT IN ('handed_off', 'lost')
GROUP BY status
ORDER BY
  CASE status
    WHEN 'new' THEN 1
    WHEN 'engaging' THEN 2
    WHEN 'qualifying' THEN 3
    WHEN 'qualified' THEN 4
    WHEN 'docs_received' THEN 5
    WHEN 'packaged' THEN 6
  END;
```

### 2. Active Deals with Details
```sql
SELECT
  d.id,
  d.display_id,
  d.status,
  d.asking_price,
  d.noi,
  d.cap_rate,
  d.last_response_at,
  d.follow_up_count,
  d.created_at,
  p.address AS property_address,
  p.property_type,
  p.building_size_sqft,
  l.name AS lead_name,
  c.name AS contact_name,
  c.phone AS contact_phone,
  -- Calculate days since last response
  EXTRACT(DAY FROM NOW() - d.last_response_at)::int AS days_since_response,
  -- Qualification progress
  (CASE WHEN d.asking_price IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN d.noi IS NOT NULL THEN 1 ELSE 0 END +
   CASE WHEN d.cap_rate IS NOT NULL THEN 1 ELSE 0 END) AS pricing_fields
FROM deals d
LEFT JOIN properties p ON d.property_id = p.id
LEFT JOIN leads l ON d.lead_id = l.id
LEFT JOIN contacts c ON d.contact_id = c.id
WHERE d.status NOT IN ('handed_off', 'lost')
ORDER BY d.last_response_at DESC NULLS LAST;
```

### 3. Stalled Deals (5+ days no response)
```sql
SELECT * FROM potential_ghosts;
```

### 4. Deals Close to Qualified
```sql
SELECT
  d.id,
  d.display_id,
  p.address,
  l.name AS lead_name,
  d.asking_price,
  d.noi,
  d.cap_rate,
  d.rent_roll_status,
  d.operating_statement_status
FROM deals d
LEFT JOIN properties p ON d.property_id = p.id
LEFT JOIN leads l ON d.lead_id = l.id
WHERE d.status IN ('engaging', 'qualifying')
  AND (
    -- Has 2 of 3 pricing fields
    (CASE WHEN d.asking_price IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN d.noi IS NOT NULL THEN 1 ELSE 0 END +
     CASE WHEN d.cap_rate IS NOT NULL THEN 1 ELSE 0 END) >= 2
    OR
    -- Has at least one document
    d.rent_roll_status = 'received'
    OR d.operating_statement_status = 'received'
  );
```

## Output Format

Create a **React artifact** with:

### 1. Funnel Visualization (horizontal bar chart)
```
New        ████████████████████ 45
Engaging   ████████████ 28
Qualifying ████████ 18
Qualified  ████ 9
Packaged   ██ 4
```

### 2. Summary Stats
- Total active deals: N
- Stalled (5+ days): N (highlight in red)
- Close to qualified: N (highlight in green)

### 3. Active Deals Table
| Deal ID | Property | Lead | Status | Days Idle | Pricing | Docs |
|---------|----------|------|--------|-----------|---------|------|
| UP-123 | 123 Main St | ABC LLC | Engaging | 3 | 2/3 | RR pending |

Features:
- Sort by days idle (highlight 5+ in red)
- Show pricing progress (X/3 filled)
- Show doc status icons
- Click to open /prep for that deal

### 4. Attention Items
- **Stalled deals** (5+ days): Show list with "Nudge" action
- **Close to qualified**: Show list with "Push to finish" action

## Key Rules

- Red highlight for deals with no response in 5+ days
- Green highlight for deals that just need one more thing to qualify
- Calculate days since last response
- Show pricing progress as fraction (e.g., "2/3 pricing fields")
- Show doc status with simple icons (pending, received, etc.)
- Make deal IDs clickable to run /prep
