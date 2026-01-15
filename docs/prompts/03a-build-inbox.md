# Build Inbox Page

## Context

You're building the Upstream CRE deal sourcing system. Read the full spec at `docs/upstream-v2-spec.md`.

**Build order:** Data (masters) → Searches → Campaigns → **Inbox** → Pipeline → Calls → Dashboard

We're building **Inbox** - where email replies are classified and actioned.

## What Inbox Does

1. Shows all incoming email replies synced from Outlook
2. Auto-classifies replies using response-classifier agent
3. User reviews classifications and takes actions
4. Actions create deals, schedule calls, add to DNC, etc.

## Database

The migration `supabase/migrations/00017_upstream_v2_schema.sql` creates:

```sql
-- inbox_messages (replies matched to enrollments)
inbox_messages:
  id UUID PRIMARY KEY,

  -- Outlook sync info
  outlook_id TEXT UNIQUE,
  thread_id TEXT,

  -- Email content
  from_email TEXT NOT NULL,
  from_name TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ,

  -- Matched to our data
  enrollment_id UUID REFERENCES enrollments(id),
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),

  -- Classification
  classification TEXT, -- interested, wants_offer, wants_to_buy, schedule_call, question, not_interested, wrong_contact, broker_redirect, dnc, bounce, unclassified
  classification_confidence FLOAT,
  classification_reasoning TEXT,

  -- Review status
  status TEXT DEFAULT 'new', -- new, reviewed, actioned
  action_taken TEXT,

  created_at TIMESTAMPTZ
```

## Classification Categories

| Category | Action | Creates |
|----------|--------|---------|
| `interested` | Continue qualification | Deal (if not exists) |
| `wants_offer` | Extract price, qualify | Deal |
| `wants_to_buy` | Create pending search | Search (source: inbound) |
| `schedule_call` | Schedule call | Call |
| `question` | Draft reply | - |
| `not_interested` | Stop sequence | - |
| `wrong_contact` | Find correct contact | - |
| `broker_redirect` | Log broker, stop | Exclusion |
| `dnc` | Add to DNC | Exclusion |
| `bounce` | Mark bounced | Exclusion |

## Tasks

### 1. Create Inbox List Page

Create `apps/web/src/app/(app)/inbox/page.tsx`:

**Email list style (like Gmail):**
- Split view: List on left, preview on right
- Or: Full-width list with click to expand

List shows:
- Sender name + company
- Subject line (truncated)
- Preview of body
- Classification badge (if classified)
- Received time
- Unread indicator (status = 'new')

**Top bar:**
- Filter tabs: All | Unclassified | Needs Action | Actioned
- Search by sender/subject
- "Classify All" button (queues batch classification)

**Bulk actions:**
- Select multiple
- "Mark as DNC"
- "Mark as Bounce"
- "Archive"

### 2. Create Message Detail View

Create `apps/web/src/app/(app)/inbox/_components/message-detail.tsx`:

**Header:**
- From: Name <email>
- Subject
- Date/Time received
- Classification badge with confidence %
- Property: (linked property if matched)
- Contact: (linked contact if matched)

**Email body:**
- Rendered HTML or plain text
- Show quoted reply chain collapsed

**Classification section:**
- Current classification with reasoning
- "Reclassify" dropdown to change
- Confidence indicator

**Actions panel:**
Based on classification, show relevant action buttons:

For `interested` / `wants_offer`:
- "Create Deal" (if no deal exists)
- "View Deal" (if deal exists)
- "Schedule Call"
- "Send Reply"

For `schedule_call`:
- "Schedule Call" (opens dialog with suggested times)
- "View Contact"

For `wants_to_buy`:
- "Create Search" (opens dialog to capture criteria)
- "View Contact"

For `question`:
- "Draft Reply" (opens compose with suggested response)
- "View Conversation History"

For `not_interested` / `dnc`:
- "Confirm DNC" (adds to exclusions)
- "Override" (if misclassified)

For `bounce`:
- "Confirm Bounce" (adds to exclusions)
- "Check Address"

For `wrong_contact`:
- "Find Correct Contact" (search UI)
- "Update Contact Info"

### 3. Classification Badge Component

Create `apps/web/src/components/classification-badge.tsx`:

```tsx
const classificationConfig = {
  interested: { label: 'Interested', color: 'green', icon: '👍' },
  wants_offer: { label: 'Wants Offer', color: 'emerald', icon: '💰' },
  wants_to_buy: { label: 'Wants to Buy', color: 'blue', icon: '🏢' },
  schedule_call: { label: 'Schedule Call', color: 'purple', icon: '📞' },
  question: { label: 'Question', color: 'yellow', icon: '❓' },
  not_interested: { label: 'Not Interested', color: 'gray', icon: '👎' },
  wrong_contact: { label: 'Wrong Contact', color: 'orange', icon: '🔄' },
  broker_redirect: { label: 'Broker', color: 'red', icon: '🏪' },
  dnc: { label: 'DNC', color: 'red', icon: '🚫' },
  bounce: { label: 'Bounce', color: 'red', icon: '📭' },
  unclassified: { label: 'Unclassified', color: 'gray', icon: '❔' },
};
```

### 4. Quick Reply Dialog

Create `apps/web/src/app/(app)/inbox/_components/quick-reply-dialog.tsx`:

- Pre-fills To with sender email
- Pre-fills Subject with "Re: original subject"
- Shows conversation context
- Textarea for reply
- "Send" queues email via drip-campaign-exec or direct send

### 5. Create API Routes

`apps/web/src/app/api/inbox/route.ts`:
- GET: List messages with pagination, filters
- Query params: status, classification, search, page

`apps/web/src/app/api/inbox/[id]/route.ts`:
- GET: Message details
- PATCH: Update status, classification

`apps/web/src/app/api/inbox/[id]/action/route.ts`:
- POST: Take action on message
- Body: { action: 'create_deal' | 'schedule_call' | 'add_dnc' | 'create_search' | ... }

`apps/web/src/app/api/inbox/classify/route.ts`:
- POST: Queue batch classification for unclassified messages

`apps/web/src/app/api/inbox/stats/route.ts`:
- GET: Counts by status and classification

### 6. Message Matching Logic

When syncing emails, the system matches to enrollments:

```typescript
// Match reply to our data
async function matchMessage(message: InboxMessage) {
  // 1. Find contact by email
  const contact = await findContactByEmail(message.from_email);
  if (!contact) return; // Unknown sender

  message.contact_id = contact.id;

  // 2. Find active enrollment for this contact
  const enrollment = await findActiveEnrollment(contact.id);
  if (enrollment) {
    message.enrollment_id = enrollment.id;
    message.property_id = enrollment.property_id;

    // Stop the sequence (replied)
    await stopEnrollment(enrollment.id, 'replied');
  }

  await updateMessage(message);
}
```

## Existing Patterns

Look at:
- `apps/web/src/app/(app)/jobs/page.tsx` - List page with filters
- `apps/web/src/components/ui/badge.tsx` - Badge component

## UI Components

- `@/components/ui/card`
- `@/components/ui/badge`
- `@/components/ui/button`
- `@/components/ui/dialog`
- `@/components/ui/textarea`
- `@/components/ui/select`
- `@/components/ui/checkbox`
- `@/components/ui/scroll-area` (for message list)
- `@/components/ui/resizable` (for split view)

## Don't

- Don't implement email sync (already exists in scripts/sync_emails.py)
- Don't implement AI classification (response-classifier agent handles that)
- Don't implement email sending (drip-campaign-exec handles that)

## Verify

After building:
1. Can navigate to /inbox from sidebar
2. See list of synced messages
3. Classification badges show correctly
4. Can filter by status and classification
5. Can view message detail with full body
6. Action buttons appear based on classification
7. Can reclassify a message
8. Can take actions (create deal, schedule call, etc.)
