# Campaign Enrollment Rules

Rules for enrolling contacts into cold outreach sequences.

---

## Pre-Enrollment Checks

Before enrolling any contact, run these checks in order:

### 1. Hard Exclusions (Automatic Block)
Query `email_exclusions` table:
```sql
SELECT * FROM email_exclusions
WHERE email = :contact_email
   OR company_id = :company_id;
```

**If found → BLOCK enrollment**

Exclusion reasons:
- `bounce` - Email doesn't exist
- `hard_pass` - Explicitly said never contact
- `dnc` - Do Not Contact request
- `active_deal` - Currently in negotiation

### 2. Prior Correspondence Check
Query `synced_emails` for any history:
```sql
SELECT
  se.subject,
  se.received_at,
  se.direction,
  se.body_preview
FROM synced_emails se
WHERE se.sender_email = :contact_email
   OR se.recipient_email = :contact_email
ORDER BY se.received_at DESC
LIMIT 10;
```

**If correspondence found → Manual review required**

Classification logic:
| Thread Status | Action |
|--------------|--------|
| Active deal in progress | EXCLUDE - Add to `email_exclusions` with reason `active_deal` |
| Call scheduled | EXCLUDE - Add to `email_exclusions` with reason `active_deal` |
| Passed on DIFFERENT deal | INCLUDE - OK to re-approach with new opportunity |
| No reply, <30 days | EXCLUDE - Too soon, wait for cooldown |
| No reply, 30+ days | INCLUDE - Enough time has passed |
| Hard pass ("not interested ever") | EXCLUDE - Add to `email_exclusions` with reason `hard_pass` |
| Soft pass ("not right now") | INCLUDE - OK to re-approach later |

### 3. Recent Outreach Cooldown
Check `contacts.last_contacted_at`:
```sql
SELECT last_contacted_at
FROM contacts
WHERE id = :contact_id;
```

**If `last_contacted_at` > NOW() - 30 days → BLOCK enrollment**

Suggested cooldown periods:
- Same campaign type: 30 days minimum
- Different property/opportunity: 14 days minimum
- Same property follow-up: 7 days minimum (handled by sequence steps)

---

## Sequence Structure

### Standard Owner Outreach Sequence

| Step | Timing | Subject | Purpose |
|------|--------|---------|---------|
| 1 | Day 0 | `{{property_address}}` | Initial hook - property-specific, direct ask |
| 2 | Day 3 | `Re: {{property_address}}` | Follow-up - add urgency, buyer capability |
| 3 | Day 7 | `Re: {{property_address}}` | Final touch - offer alternative, soft close |

### Sequence Settings
```json
{
  "stop_on_reply": true,
  "send_window_start": "08:00",
  "send_window_end": "17:00",
  "timezone": "America/Los_Angeles",
  "skip_weekends": true
}
```

### Threading Rules
- Email 1: Fresh subject line
- Email 2+: Prepend `Re: ` to create thread appearance
- All emails reference same property to maintain context

---

## Merge Tags

Available personalization fields:

| Tag | Source | Example |
|-----|--------|---------|
| `{{first_name}}` | contacts.first_name | "John" |
| `{{property_address}}` | properties.address | "1234 Industrial Way" |
| `{{building_sf}}` | properties.building_sf | "45,000" |
| `{{land_acres}}` | properties.land_sf / 43560 | "2.3" |
| `{{market}}` | markets.name | "Inland Empire" |
| `{{property_type}}` | properties.property_type | "Industrial" |

---

## Enrollment Flow

```
                    ┌─────────────────┐
                    │  Contact List   │
                    │  (from extract) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │ email_exclusions│───── Found ────► BLOCKED
                    │     check       │
                    └────────┬────────┘
                             │ Not found
                    ┌────────▼────────┐
                    │  synced_emails  │───── Found ────► MANUAL REVIEW
                    │     check       │                      │
                    └────────┬────────┘                      │
                             │ No history          ┌─────────▼─────────┐
                    ┌────────▼────────┐            │ Active deal?      │
                    │ last_contacted  │            │ Call scheduled?   │──► EXCLUDE
                    │   < 30 days?    │            │ Hard pass?        │
                    └────────┬────────┘            └─────────┬─────────┘
                             │                               │ No
                    ┌────────▼────────┐            ┌─────────▼─────────┐
                    │   Yes → WAIT    │            │ Different deal?   │
                    │   No  → ENROLL  │            │ 30+ days ago?     │──► INCLUDE
                    └─────────────────┘            │ Soft pass?        │
                                                   └───────────────────┘
```

---

## Status Updates on Enrollment

When enrolling a contact:

```sql
-- Update contact status
UPDATE contacts
SET status = 'sequence_active',
    last_contacted_at = NOW()
WHERE id = :contact_id;

-- Update company status
UPDATE companies
SET status = 'contacted'
WHERE id = :company_id
  AND status = 'new';

-- Create subscription
INSERT INTO sequence_subscriptions (
  contact_id,
  sequence_id,
  status,
  current_step,
  enrolled_at
) VALUES (
  :contact_id,
  :sequence_id,
  'active',
  1,
  NOW()
);
```

---

## Reply Handling

When a reply is detected (via Outlook sync):

1. **Stop sequence immediately**
   ```sql
   UPDATE sequence_subscriptions
   SET status = 'replied',
       completed_at = NOW()
   WHERE contact_id = :contact_id
     AND status = 'active';
   ```

2. **Route to response-classifier agent**
   - Agent classifies into 8 categories
   - Creates appropriate follow-up task

3. **Update company status based on classification**
   | Classification | Company Status |
   |---------------|----------------|
   | interested | engaged |
   | pricing_given | engaged |
   | question | contacted |
   | referral | contacted (new contact created) |
   | broker_redirect | rejected |
   | soft_pass | nurture |
   | hard_pass | dnc |
   | bounce | (no change, email excluded) |

---

## UI Requirements

### Contact Review Screen
Before campaign launch, show:
- Total contacts to enroll
- Contacts with prior correspondence (flagged for review)
- Contacts excluded (with reason)
- Contacts within cooldown period

### Manual Review Interface
For contacts with email history:
- Show thread preview
- Display classification options
- Allow: INCLUDE / EXCLUDE / DEFER
- If EXCLUDE: require reason selection

### Campaign Dashboard
- Enrolled count
- Emails sent (per step)
- Reply rate
- Classification breakdown
- Pending approvals (if using draft queue)
