# Build Campaigns Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → **Campaigns** → Pipeline → Calls → Dashboard

We're building **Campaigns** - 3-email drip sequences that target properties from a search.

## What Campaigns Does

1. User creates campaign from a Search's results
2. Campaign has 3 email templates with merge tags
3. System enrolls property/contact combinations
4. drip-campaign-exec sends emails on schedule
5. Replies stop the sequence and appear in Inbox

## Database

The migration `supabase/migrations/00017_upstream_v2_schema.sql` creates these tables:

```sql
-- campaigns
campaigns:
  id UUID PRIMARY KEY,
  search_id UUID NOT NULL REFERENCES searches(id),
  name TEXT,
  status TEXT, -- draft → active → paused → completed

  -- Email templates
  email_1_subject TEXT, email_1_body TEXT,
  email_2_subject TEXT, email_2_body TEXT, email_2_delay_days INT DEFAULT 3,
  email_3_subject TEXT, email_3_body TEXT, email_3_delay_days INT DEFAULT 4,

  -- Send settings
  send_window_start TIME DEFAULT '09:00',
  send_window_end TIME DEFAULT '17:00',
  timezone TEXT DEFAULT 'America/Los_Angeles',

  -- Metrics (denormalized)
  total_enrolled, total_sent, total_opened, total_replied, total_stopped,

  created_at, started_at, completed_at, updated_at

-- enrollments (one per property/contact combo)
enrollments:
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  property_id UUID REFERENCES properties(id),
  contact_id UUID REFERENCES contacts(id),

  status TEXT, -- pending → active → replied → completed → stopped
  current_step INT, -- 0 = not started, 1-3 = which email

  -- Email tracking
  email_1_sent_at, email_1_opened_at,
  email_2_sent_at, email_2_opened_at,
  email_3_sent_at, email_3_opened_at,

  -- Reply handling
  replied_at, reply_classification,

  -- Stop tracking
  stopped_at, stopped_reason, -- replied, dnc, bounce, manual

  -- Warning flags
  flag_already_contacted_any BOOLEAN,
  flag_already_contacted_this BOOLEAN,
  flag_is_dnc BOOLEAN,
  flag_is_bounced BOOLEAN,

  created_at, updated_at,
  UNIQUE (campaign_id, property_id, contact_id)
```

## Tasks

### 1. Create Campaigns List Page

Create `apps/web/src/app/(app)/campaigns/page.tsx`:

- Fetch all campaigns from `campaigns` table
- Display as cards with:
  - Name
  - Source search name
  - Status badge (draft, active, paused, completed)
  - Progress bar (sent / enrolled)
  - Metrics row: Enrolled | Sent | Opened | Replied | Stopped
  - Actions: View, Pause/Resume (if active), Edit (if draft)
- "New Campaign" button (opens search selector → create from search)
- Filter tabs: All, Draft, Active, Paused, Completed

### 2. Create Campaign Detail Page

Create `apps/web/src/app/(app)/campaigns/[id]/page.tsx`:

Layout with tabs:

**Overview Tab:**
- Status badge with start/pause buttons
- Metrics cards: Enrolled, Sent, Opened (%), Replied (%), Stopped
- Progress: "Step 1: 45/100 | Step 2: 12/45 | Step 3: 0/12"
- Recent activity (last 5 enrollments with status changes)

**Emails Tab:**
- Show all 3 email templates side by side
- Each shows:
  - Subject line
  - Body preview
  - Delay (days after previous)
  - Edit button (if draft)
- Merge tags available: {{first_name}}, {{company_name}}, {{property_address}}, {{property_city}}

**Enrollments Tab:**
- Data table with columns:
  - Property (address, city)
  - Contact (name, email)
  - Status badge
  - Current Step
  - Last Activity
  - Actions: Stop, Remove
- Filter by status
- Search by property/contact
- Pagination (50 per page)

**Settings Tab:**
- Send window (start/end time)
- Timezone selector
- Email delays (days between steps)
- Save button

### 3. Create Campaign from Search

Create `apps/web/src/app/(app)/campaigns/_components/create-campaign-dialog.tsx`:

Step 1 - Select Search:
- List searches with status 'ready'
- Show search name, property count, contact count
- Select one → Next

Step 2 - Configure:
- Campaign name (auto-generated from search name + date)
- Review enrollment count (properties × contacts)
- Show warnings if any:
  - "X contacts already contacted for this property"
  - "Y contacts on DNC list"
  - "Z emails have bounced"
- Option to exclude warned contacts

Step 3 - Write Emails:
- 3 textarea sections for each email
- Subject + Body for each
- Delay inputs (default: 0, 3, 4 days)
- Show merge tag reference

Step 4 - Review & Create:
- Summary of campaign
- "Create as Draft" or "Create & Start"

### 4. Create API Routes

`apps/web/src/app/api/campaigns/route.ts`:
- GET: List all campaigns with search name
- POST: Create campaign with enrollments

`apps/web/src/app/api/campaigns/[id]/route.ts`:
- GET: Campaign details with metrics
- PATCH: Update status, settings, emails

`apps/web/src/app/api/campaigns/[id]/enrollments/route.ts`:
- GET: List enrollments with pagination, filters
- PATCH: Update enrollment (stop, remove)

`apps/web/src/app/api/campaigns/[id]/start/route.ts`:
- POST: Start campaign (set status to 'active', activate enrollments)

`apps/web/src/app/api/campaigns/[id]/pause/route.ts`:
- POST: Pause campaign

### 5. Enrollment Creation Logic

When creating a campaign from a search:

```typescript
// 1. Get all properties from the search
const properties = await getSearchProperties(searchId);

// 2. For each property, get the primary contact
for (const property of properties) {
  const contact = await getPrimaryContact(property.id);
  if (!contact) continue;

  // 3. Check for warnings
  const flags = {
    flag_already_contacted_any: await hasBeenContacted(contact.id),
    flag_already_contacted_this: await hasBeenContactedForProperty(contact.id, property.id),
    flag_is_dnc: await isDnc(contact.email),
    flag_is_bounced: await hasBounced(contact.email),
  };

  // 4. Create enrollment
  await createEnrollment({
    campaign_id: campaignId,
    property_id: property.id,
    contact_id: contact.id,
    status: 'pending',
    current_step: 0,
    ...flags
  });
}

// 5. Update campaign totals
await updateCampaignTotals(campaignId);
```

## Merge Tags

Available merge tags for email templates:
- `{{first_name}}` - Contact first name
- `{{last_name}}` - Contact last name
- `{{company_name}}` - Company name
- `{{property_address}}` - Full property address
- `{{property_city}}` - Property city
- `{{property_state}}` - Property state
- `{{property_type}}` - Property type (Industrial, Office, etc.)
- `{{property_sqft}}` - Property square footage

## Existing Patterns

Look at:
- `apps/web/src/app/(app)/jobs/page.tsx` - Page with tabs and data table
- `apps/web/src/app/(app)/searches/page.tsx` - List page (once built)
- `apps/web/src/components/ui/progress.tsx` - Progress bar component

## UI Components

- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/dialog`
- `@/components/ui/tabs`
- `@/components/ui/textarea`
- `@/components/ui/select`
- `@/components/ui/progress`
- Data table from jobs page

## Don't

- Don't implement the actual email sending (drip-campaign-exec agent handles that)
- Don't implement reply processing (response-classifier agent handles that)
- Don't build email tracking (opens/clicks) infrastructure yet

## Verify

After building:
1. Can navigate to /campaigns from sidebar
2. Can see list of existing campaigns
3. Can create new campaign from a search
4. Can view campaign detail with all tabs
5. Can see enrollment list with filters
6. Can pause/resume an active campaign
7. Campaign status badges work correctly
