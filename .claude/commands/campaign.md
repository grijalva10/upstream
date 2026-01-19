# /campaign - Campaign Status

Check the status of a drip campaign, including performance metrics.

**Usage:** `/campaign Industrial OC 2026` or `/campaign` (lists all active)

## What to Query

### If No Argument: List All Active Campaigns
```sql
SELECT
  c.id,
  c.name,
  c.status,
  c.created_at,
  s.name AS search_name,
  (SELECT COUNT(*) FROM enrollments e WHERE e.campaign_id = c.id) AS total_enrolled,
  (SELECT COUNT(*) FROM enrollments e WHERE e.campaign_id = c.id AND e.status = 'completed') AS completed,
  (SELECT COUNT(*) FROM enrollments e WHERE e.campaign_id = c.id AND e.status = 'replied') AS replied
FROM campaigns c
LEFT JOIN searches s ON c.search_id = s.id
WHERE c.status IN ('active', 'draft', 'paused')
ORDER BY c.created_at DESC;
```

### If Argument: Find Specific Campaign
```sql
SELECT
  c.id,
  c.name,
  c.status,
  c.created_at,
  c.started_at,
  c.sequence_id,
  s.name AS sequence_name
FROM campaigns c
LEFT JOIN sequences s ON c.sequence_id = s.id
WHERE c.name ILIKE '%{argument}%'
LIMIT 5;
```

### Get Campaign Metrics
```sql
WITH enrollment_stats AS (
  SELECT
    e.campaign_id,
    e.status,
    e.current_step,
    COUNT(*) as count
  FROM enrollments e
  WHERE e.campaign_id = '{campaign_id}'
  GROUP BY e.campaign_id, e.status, e.current_step
)
SELECT * FROM enrollment_stats;
```

### Email Stats by Step
```sql
SELECT
  ss.step_number,
  ss.subject_template,
  COUNT(DISTINCT e.id) AS enrolled_at_step,
  COUNT(DISTINCT se_sent.id) AS emails_sent,
  COUNT(DISTINCT se_reply.id) AS replies_received,
  ROUND(COUNT(DISTINCT se_reply.id)::numeric / NULLIF(COUNT(DISTINCT se_sent.id), 0) * 100, 1) AS reply_rate
FROM sequence_steps ss
JOIN sequences s ON ss.sequence_id = s.id
JOIN campaigns c ON c.sequence_id = s.id
LEFT JOIN enrollments e ON e.campaign_id = c.id AND e.current_step >= ss.step_number
LEFT JOIN synced_emails se_sent ON se_sent.enrollment_id = e.id
  AND se_sent.direction = 'outbound'
  AND se_sent.subject ILIKE '%' || SPLIT_PART(ss.subject_template, '{', 1) || '%'
LEFT JOIN synced_emails se_reply ON se_reply.enrollment_id = e.id
  AND se_reply.direction = 'inbound'
WHERE c.id = '{campaign_id}'
GROUP BY ss.step_number, ss.subject_template
ORDER BY ss.step_number;
```

### Hot Leads from This Campaign
```sql
SELECT
  se.id,
  se.from_email,
  se.from_name,
  se.subject,
  se.classification,
  se.extracted_pricing,
  se.received_at,
  c.name AS contact_name,
  l.name AS lead_name,
  p.address AS property_address
FROM synced_emails se
JOIN enrollments e ON se.enrollment_id = e.id
JOIN contacts c ON e.contact_id = c.id
LEFT JOIN leads l ON c.lead_id = l.id
LEFT JOIN property_leads pl ON l.id = pl.lead_id
LEFT JOIN properties p ON pl.property_id = p.id
WHERE e.campaign_id = '{campaign_id}'
  AND se.classification IN ('hot_interested', 'hot_pricing', 'hot_schedule', 'hot_confirm', 'hot', 'question')
  AND se.direction = 'inbound'
ORDER BY se.received_at DESC;
```

### Bounces
```sql
SELECT
  c.name,
  c.email,
  se.received_at AS bounced_at
FROM synced_emails se
JOIN enrollments e ON se.enrollment_id = e.id
JOIN contacts c ON e.contact_id = c.id
WHERE e.campaign_id = '{campaign_id}'
  AND se.classification = 'bounce'
ORDER BY se.received_at DESC;
```

## Output Format

Create a **React artifact** with:

### 1. Campaign Summary Header
```
Campaign: Industrial OC 2026
Status: Active | Started: Jan 15, 2026 | Sequence: 3-Touch Seller Outreach
```

### 2. Funnel Visualization
```
Enrolled    ████████████████████████████████████████ 312
Step 1      ████████████████████████████████████ 298 (95%)
Step 2      ██████████████████████████ 234 (75%)
Step 3      ████████████████████ 178 (57%)
Replied     ████████ 67 (21%)
Hot Leads   ████ 23 (7%)
```

### 3. Step-by-Step Performance Table
| Step | Subject | Sent | Replied | Reply Rate |
|------|---------|------|---------|------------|
| 1 | Quick question about {property} | 298 | 42 | 14.1% |
| 2 | Following up on {property} | 234 | 18 | 7.7% |
| 3 | Final check on {property} | 178 | 7 | 3.9% |

### 4. Hot Leads List
Cards showing:
- Contact name, lead, property
- Their reply and classification
- Extracted pricing if any
- Quick action: Open /prep

### 5. Issues Panel
- Bounces: N (click to see list)
- Unsubscribes: N
- Stalled: N (stopped responding mid-sequence)

## Key Rules

- Show funnel as both counts and percentages
- Calculate reply rate per step
- Highlight hot leads prominently
- Show bounce rate as warning if > 5%
- Include link to run /prep for each hot lead
- If campaign is paused, show reason
