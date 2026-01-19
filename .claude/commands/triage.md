# /triage - Daily Inbox Review

Daily review of items needing my attention.

## What to Query

### 1. Pending Email Drafts
```sql
SELECT
  ed.id,
  ed.to_email,
  ed.to_name,
  ed.subject,
  ed.body,
  ed.draft_type,
  ed.created_at,
  c.name AS contact_name,
  c.phone AS contact_phone,
  l.name AS lead_name,
  p.address AS property_address,
  p.property_type,
  p.building_size_sqft,
  pln.maturity_date,
  pln.ltv_current,
  pln.dscr_current,
  pln.special_servicing_status,
  se.subject AS original_subject,
  se.body_text AS original_body,
  se.classification
FROM email_drafts ed
LEFT JOIN contacts c ON ed.contact_id = c.id
LEFT JOIN leads l ON ed.lead_id = l.id
LEFT JOIN properties p ON ed.property_id = p.id
LEFT JOIN property_loans pln ON p.id = pln.property_id
LEFT JOIN synced_emails se ON ed.source_email_id = se.id
WHERE ed.status = 'pending'
ORDER BY ed.created_at ASC;
```

### 2. Hot Leads (last 24h)
```sql
SELECT
  se.id,
  se.from_email,
  se.from_name,
  se.subject,
  se.body_text,
  se.classification,
  se.classification_confidence,
  se.extracted_pricing,
  se.received_at,
  c.name AS contact_name,
  c.phone AS contact_phone,
  l.name AS lead_name,
  l.status AS lead_status,
  p.address AS property_address,
  p.property_type,
  p.building_size_sqft,
  pln.maturity_date,
  pln.ltv_current
FROM synced_emails se
LEFT JOIN contacts c ON se.matched_contact_id = c.id
LEFT JOIN leads l ON se.matched_lead_id = l.id
LEFT JOIN properties p ON se.matched_property_id = p.id
LEFT JOIN property_loans pln ON p.id = pln.property_id
WHERE se.classification IN ('hot_interested', 'hot_pricing', 'hot_schedule', 'hot_confirm', 'hot')
  AND se.received_at > NOW() - INTERVAL '24 hours'
  AND se.status != 'actioned'
ORDER BY se.received_at DESC;
```

### 3. Low Confidence Reviews
```sql
SELECT
  se.id,
  se.from_email,
  se.subject,
  se.body_text,
  se.classification,
  se.classification_confidence,
  se.received_at
FROM synced_emails se
WHERE se.needs_review = true
  AND se.status = 'new'
ORDER BY se.received_at ASC
LIMIT 10;
```

## Output Format

Create a **React artifact** with:

1. **Summary Stats** at top:
   - N drafts pending
   - N hot leads
   - N low confidence reviews

2. **Cards for each item** showing:
   - **Email thread**: Original email subject + body preview, draft reply
   - **Property context**: Address, type, size, loan maturity, LTV
   - **Action buttons**: Approve / Edit / Skip

3. **Card styling**:
   - Hot leads: orange/amber accent
   - Drafts: blue accent
   - Low confidence: yellow warning accent

## Key Rules

- Show the ORIGINAL email they sent AND the draft reply together
- Include property/loan context when available
- Extracted pricing (asking, NOI, cap rate) should be highlighted
- Phone numbers should be clickable (tel: link)
- Provide clear approve/edit/skip actions

## After Approval

When I approve a draft:
1. Update `email_drafts.status` to 'approved'
2. The worker will pick it up and send via Outlook

When I edit:
1. Save the edited version
2. Mark as approved

When I skip:
1. Mark as 'skipped' so it doesn't show again
