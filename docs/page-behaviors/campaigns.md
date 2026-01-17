# Campaigns Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Campaign States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `draft` | Being configured, no emails sent | "Draft" badge | `active` |
| `active` | Actively sending emails | "Active" badge (green) | `paused`, `completed` |
| `paused` | Temporarily stopped | "Paused" badge (yellow) | `active` |
| `completed` | All enrollments finished | "Completed" badge | — |

---

## 2. Enrollment States

| State | Description | Trigger |
|-------|-------------|---------|
| `pending` | Enrolled but campaign not activated | On enroll |
| `active` | In drip sequence, emails being sent | On campaign activate |
| `replied` | Received response (sequence stops) | Reply detected |
| `completed` | All 3 emails sent, no reply | After email 3 sent |
| `stopped` | Manually stopped or auto-stopped | DNC, bounce, manual |

---

## 3. Human Actions

### List Page (/campaigns)

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **View campaigns** | Navigate to /campaigns | Shows all campaigns in table | — |
| **Filter by status** | Dropdown filter | Filters table | URL param |
| **New campaign** | "New Campaign" button | Navigates to search selection | — |
| **View campaign** | Click row | Navigate to detail page | — |

### Detail Page (/campaigns/[id])

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Go back** | Back button | Return to list | — |
| **Generate emails** | "Generate Emails" button | Calls AI to create 3-email sequence | Updates `email_1_*`, `email_2_*`, `email_3_*` |
| **Edit email** | Edit icon on email card | Opens editor | Updates email fields |
| **Enroll contacts** | "Enroll Contacts" button | Bulk enrolls from search results | Creates `enrollments` records |
| **Send test** | "Send Test" button | Sends test email to self | — |
| **Activate** | "Activate Campaign" button | Opens datetime picker, schedules emails | Updates status to `active`, creates `email_queue` |
| **Pause** | "Pause" button | Stops sending | Updates status to `paused` |
| **Resume** | "Resume" button | Resumes sending | Updates status to `active` |
| **View enrollments** | Scroll to table | Shows enrolled contacts | — |
| **Paginate enrollments** | Page controls | Navigate enrollment pages | URL param |

---

## 4. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Generate email copy** | User clicks "Generate Emails" | Active | Active | Updates campaign email fields |
| **Personalize emails** | On activate | Active | Active | Merge tags replaced in `email_queue` |
| **Schedule emails** | On activate | Active | Active | Creates `email_queue` entries |
| **Send emails** | Worker job | Active | Active | Updates `email_queue.status`, enrollment timestamps |
| **Detect replies** | Email sync | Active | Active | Updates `synced_emails` |
| **Stop on reply** | Reply detected | Active | Active | Updates enrollment `status='replied'` |
| **Classify reply** | Reply detected | Routes to inbox | Routes + auto-action | Updates classification |
| **Auto-create campaign** | Search ready | Disabled | Active (with approval) | Creates campaign |
| **Auto-enroll** | Campaign created | Disabled | Active (with approval) | Creates enrollments |
| **Auto-activate** | Enrollments + emails ready | Disabled | Active (with approval) | Schedules emails |

---

## 5. Email Sequence Structure

| Email | Default Delay | Purpose | Tone |
|-------|---------------|---------|------|
| **Email 1** | Day 0 | Initial outreach | Professional, property-specific |
| **Email 2** | +3 days | Follow-up | Brief, ask for call |
| **Email 3** | +4 days | Final attempt | Leave door open |

### Merge Tags

| Tag | Source | Example |
|-----|--------|---------|
| `{{FirstName}}` | contacts.name (first word) | "John" |
| `{{property_address}}` | Full address | "123 Main St, Los Angeles, CA" |
| `{{property_type}}` | properties.property_type | "industrial" |
| `{{building_sf}}` | properties.building_size_sqft | "45,000" |
| `{{years_held}}` | currentYear - year_acquired | "12" |
| `{{year_built}}` | properties.year_built | "1998" |
| `{{city}}` | properties.city | "Los Angeles" |
| `{{state}}` | properties.state_code | "CA" |

---

## 6. Send Window & Timing

| Setting | Default | Description |
|---------|---------|-------------|
| `send_window_start` | 09:00 | Earliest send time |
| `send_window_end` | 17:00 | Latest send time |
| `timezone` | America/Los_Angeles | Recipient timezone |
| **Skip weekends** | Yes | Days 0 (Sun) and 6 (Sat) |
| **Stagger** | 30s-2min | Random delay between each email |

### Rate Limits

| Limit | Default |
|-------|---------|
| Hourly | 1,000 emails |
| Daily | 10,000 emails |

---

## 7. Enrollment Rules

### Pre-Enrollment Checks

| Check | Result |
|-------|--------|
| Email in `email_exclusions` (bounce) | EXCLUDE |
| Email in `email_exclusions` (hard_pass) | EXCLUDE |
| Contact status = 'dnc' | EXCLUDE |
| Active deal in progress | EXCLUDE |
| Call scheduled | EXCLUDE |
| No reply < 30 days | EXCLUDE (too soon) |
| No reply 30+ days | INCLUDE |
| Soft pass on different deal | INCLUDE |
| Hard pass on any deal | EXCLUDE |

### Enrollment Flags

| Flag | Meaning |
|------|---------|
| `flag_already_contacted_any` | Contact has been emailed before |
| `flag_already_contacted_this` | Contact emailed about THIS property |
| `flag_is_dnc` | Contact on DNC list |
| `flag_is_bounced` | Email has bounced before |

### Cooldown Periods

| Scenario | Minimum Wait |
|----------|--------------|
| Same campaign type | 30 days |
| Different property | 14 days |
| Same property | 7 days |

---

## 8. Database Tables

### Core Tables

| Table | Role |
|-------|------|
| `campaigns` | Campaign config and metrics |
| `enrollments` | Contact enrollment per campaign |
| `email_queue` | Scheduled emails pending send |
| `synced_emails` | Received replies |
| `email_exclusions` | DNC and bounce list |

### Campaigns Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `search_id` | UUID | Link to source search |
| `name` | TEXT | Campaign name |
| `status` | TEXT | draft/active/paused/completed |
| `email_1_subject` | TEXT | Email 1 subject |
| `email_1_body` | TEXT | Email 1 body |
| `email_2_subject` | TEXT | Email 2 subject |
| `email_2_body` | TEXT | Email 2 body |
| `email_2_delay_days` | INT | Days after email 1 (default 3) |
| `email_3_subject` | TEXT | Email 3 subject |
| `email_3_body` | TEXT | Email 3 body |
| `email_3_delay_days` | INT | Days after email 2 (default 4) |
| `send_window_start` | TIME | Default 09:00 |
| `send_window_end` | TIME | Default 17:00 |
| `timezone` | TEXT | Default America/Los_Angeles |
| `total_enrolled` | INT | Metric |
| `total_sent` | INT | Metric |
| `total_opened` | INT | Metric |
| `total_replied` | INT | Metric |
| `total_stopped` | INT | Metric |
| `scheduled_start_at` | TIMESTAMPTZ | From activate dialog |
| `started_at` | TIMESTAMPTZ | When first email sent |
| `completed_at` | TIMESTAMPTZ | When campaign finished |

### Enrollments Table Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | Parent campaign |
| `property_id` | UUID | Property being pitched |
| `contact_id` | UUID | Contact receiving emails |
| `status` | TEXT | pending/active/replied/completed/stopped |
| `current_step` | INT | 0-3 (which email sent) |
| `email_1_sent_at` | TIMESTAMPTZ | When email 1 sent |
| `email_1_opened_at` | TIMESTAMPTZ | When email 1 opened |
| `email_2_sent_at` | TIMESTAMPTZ | When email 2 sent |
| `email_2_opened_at` | TIMESTAMPTZ | When email 2 opened |
| `email_3_sent_at` | TIMESTAMPTZ | When email 3 sent |
| `email_3_opened_at` | TIMESTAMPTZ | When email 3 opened |
| `replied_at` | TIMESTAMPTZ | When reply received |
| `reply_classification` | TEXT | AI classification of reply |
| `stopped_at` | TIMESTAMPTZ | When stopped |
| `stopped_reason` | TEXT | replied/dnc/bounce/manual |

---

## 9. API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/campaigns` | GET | List all campaigns |
| `/api/campaigns` | POST | Create new campaign |
| `/api/campaigns/[id]` | GET | Get campaign details |
| `/api/campaigns/[id]` | PATCH | Update campaign |
| `/api/campaigns/[id]/enroll` | POST | Bulk enroll contacts |
| `/api/campaigns/[id]/activate` | POST | Schedule email 1s |
| `/api/campaigns/[id]/generate-emails` | POST | AI generates 3-email sequence |
| `/api/campaigns/[id]/enrollments` | GET | List enrollments (paginated) |
| `/api/campaigns/[id]/send-test` | POST | Send test email |

---

## 10. Processes

### Campaign Creation Process

```
1. User navigates to /campaigns
2. Clicks "New Campaign"
3. Selects a search with status IN [ready, extraction_complete]
4. POST /api/campaigns with search_id and name
5. Campaign created with status='draft'
6. Redirect to /campaigns/{id}
```

### Email Generation Process

```
1. User clicks "Generate Emails"
2. POST /api/campaigns/[id]/generate-emails
3. API extracts:
   - Buyer context from search.criteria_json
   - Search context (markets, types, price)
4. Calls AGENT_SERVICE_URL with generation prompt
5. Agent returns 3-email JSON sequence
6. API parses and updates campaign fields
7. UI shows populated email cards
```

### Enrollment Process

```
1. User clicks "Enroll Contacts"
2. POST /api/campaigns/[id]/enroll
3. API queries: search_properties → properties → property_companies (owner) → contacts
4. Filters by:
   - relationship='owner'
   - contact.status='active'
   - contact has email
5. Applies exclusion checks (DNC, bounce, cooldown)
6. Deduplicates by contact_id (one enrollment per contact)
7. Creates enrollment records with status='pending'
8. Updates campaign.total_enrolled
```

### Activation Process

```
1. User clicks "Activate Campaign"
2. Dialog opens: select start datetime
3. User confirms
4. POST /api/campaigns/[id]/activate with scheduledStartAt
5. For each pending enrollment:
   a. Replace merge tags in email_1
   b. Calculate send time:
      - Base: scheduledStartAt
      - Add stagger (30s-2min per enrollment)
      - Ensure within send window
      - Skip weekends
   c. Create email_queue entry
6. Update enrollments: status='active', current_step=1
7. Update campaign: status='active', started_at=NOW()
```

### Email Sending Process (Worker)

```
1. Worker polls: SELECT * FROM email_queue WHERE status='pending' AND scheduled_for <= NOW()
2. Checks rate limits
3. For each email:
   a. Call Outlook COM to send
   b. Update email_queue.status='sent', sent_at=NOW()
   c. Update enrollment: email_X_sent_at=NOW()
   d. Update campaign: total_sent++
   e. If not last email: schedule next email
4. On failure: increment attempts, schedule retry or mark failed
```

### Reply Detection Process

```
1. Email sync polls Outlook inbox
2. New email detected
3. Match from_email to contacts table
4. Link to enrollment via conversation_id or contact match
5. Create synced_emails record
6. Update enrollment:
   - status='replied'
   - replied_at=NOW()
7. Update campaign: total_replied++
8. Route to inbox for classification
```

### Stop-on-Reply Process

```
1. Reply detected (from above process)
2. Find active enrollment for this contact
3. Update enrollment:
   - status='replied'
   - stopped_at=NOW()
   - stopped_reason='replied'
4. Cancel any pending email_queue entries for this enrollment
5. Route reply to inbox for human review or AI action
```

---

## 11. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `campaigns/page.tsx` | List page |
| `[id]/page.tsx` | `campaigns/[id]/page.tsx` | Detail page |
| `campaign-actions.tsx` | `[id]/_components/` | Enroll, Activate, Pause, Resume buttons |
| `email-sequence.tsx` | `[id]/_components/` | Shows 3 email cards with delays |
| `enrollments-table.tsx` | `[id]/_components/` | Paginated enrollment list |
| `generate-emails-button.tsx` | `[id]/_components/` | AI email generation trigger |
| `send-test-button.tsx` | `[id]/_components/` | Test email sender |

---

## 12. Metrics Display

| Metric | Source | Display |
|--------|--------|---------|
| **Enrolled** | `campaigns.total_enrolled` | Card with Users icon |
| **Sent** | `campaigns.total_sent` | Card with Send icon |
| **Opened** | `campaigns.total_opened` | Card with Eye icon |
| **Replied** | `campaigns.total_replied` | Card with Reply icon |

---

## 13. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | User triggers all actions |
| **Phase 2** | Assisted | AI generates emails, user reviews and activates |
| **Phase 3** | Semi-autonomous | AI creates campaigns from searches, user approves |
| **Phase 4** | Autonomous | Full pipeline with approval checkpoints |

### Phase 1 → 2 Criteria
- Email generation quality consistently good
- Merge tags work correctly

### Phase 2 → 3 Criteria
- Campaign setup is repeatable
- User trusts AI campaign creation

### Phase 3 → 4 Criteria
- End-to-end delivery rate > 95%
- Reply rate meets expectations
- No compliance issues

---

## 14. Edge Cases

| Scenario | Handling |
|----------|----------|
| Search has no contacts | Show warning, can't enroll |
| All contacts excluded | Show "0 enrolled, X skipped" message |
| Email generation fails | Show error, allow retry |
| Outlook unavailable | Queue emails, retry when available |
| Send window missed | Reschedule for next valid window |
| Weekend activation | First email scheduled for Monday |
| Reply before email 2 | Stop sequence, don't send email 2 |
| Bounce on email 1 | Stop sequence, add to exclusions |
| Contact unsubscribes | Stop sequence, add to DNC |
| Campaign deleted | Cascade delete enrollments |

---

## 15. Integration Points

| System | Integration |
|--------|-------------|
| **Searches** | Campaign created from search, uses search.criteria_json |
| **Inbox** | Replies appear in inbox for classification |
| **People** | Contacts enrolled, status updated |
| **Deals** | Created from hot replies |
| **Outlook** | COM automation for sending and syncing |
| **Agent Service** | Email generation via AGENT_SERVICE_URL |
