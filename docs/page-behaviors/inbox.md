# Inbox Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Email States

| State | Description | UI Location | Transitions To |
|-------|-------------|-------------|----------------|
| `new` | Just synced, unreviewed | "Needs Review" tab | `reviewed`, `actioned` |
| `reviewed` | Human looked at it | "All" tab | `actioned` |
| `actioned` | Action taken (by human or AI) | "All" tab (or hidden) | — |

---

## 2. Classification Categories (19)

### HOT (Green) — Active buyer/seller interest

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `hot_interested` | Expressed interest in selling/buying | Human creates deal | AI creates deal + drafts reply |
| `hot_pricing` | Provided pricing info (asking, NOI, cap) | Human extracts + creates deal | AI extracts + creates deal |
| `hot_schedule` | Wants to schedule a call | Human schedules | AI proposes times |
| `hot_confirm` | Confirmed a call time | Human creates calendar event | AI creates event + sends confirmation |

### ACTION (Yellow) — Requires response

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `question` | Asked a question | Human drafts reply | AI drafts, human approves |
| `info_request` | Requested specific info (docs, details) | Human drafts reply | AI drafts, human approves |
| `doc_promised` | Said they'll send docs | Human sets reminder | AI creates follow-up task |
| `doc_received` | Sent documents/attachments | Human reviews + creates deal | AI flags for human review |

### BUYER (Blue) — Inbound buyer inquiries

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `buyer_inquiry` | New buyer expressing interest | Human creates search | AI creates search + replies |
| `buyer_criteria_update` | Buyer updating their criteria | Human updates search | AI updates search |

### REDIRECT (Orange) — Not the right person

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `referral` | Referred to someone else | Human creates new contact | AI creates contact + drafts outreach |
| `broker` | It's a broker, not principal | Human archives | AI archives + logs broker |
| `wrong_contact` | Wrong person/company | Human archives | AI archives |
| `ooo` | Out of office auto-reply | Human ignores | AI ignores, keeps sequence active |

### CLOSED (Red/Gray) — Terminal states

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `soft_pass` | Not interested now, maybe later | Human adds to nurture | AI creates 90-day task |
| `hard_pass` | Never contact again | Human confirms DNC | AI confirms DNC (with undo window) |
| `bounce` | Email bounced/undeliverable | Human confirms exclusion | AI excludes (with undo window) |
| `general_update` | Generic reply, no clear intent | Human reviews | AI marks reviewed |

### FILTERED (Auto-archived)

| Category | Description | Initial Mode | Eventual Mode |
|----------|-------------|--------------|---------------|
| `newsletter` | Marketing/newsletter content | Auto-archive | Auto-archive |
| `internal` | Internal company email | Auto-archive | Auto-archive |

---

## 3. Confidence Thresholds

| Confidence | Initial Behavior | Eventual Behavior |
|------------|------------------|-------------------|
| **≥ 0.85** | Draft created, human approves | AI executes, human can review after |
| **0.70–0.84** | Draft created, human approves | Draft created, human approves |
| **< 0.70** | Flagged for human classification | Flagged for human classification |

---

## 4. Human Actions

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Select message** | Click row | Shows detail in right panel | URL param `?selected=[id]` |
| **Reclassify** | Dropdown in detail | Override AI classification | `synced_emails.classification`, `classified_by='human'` |
| **Create Deal** | Button (hot categories) | Opens deal creation | Creates `deals` record, links contact/property |
| **Schedule Call** | Button | Creates call record | Creates `calls` record for next business day |
| **Reply** | Button | Opens compose dialog | — |
| **Send Reply** | Submit in dialog | Queues email for send | Creates `email_drafts` with status `approved` |
| **Approve Draft** | Button on AI draft | Approves AI reply | Updates `email_drafts.status` to `approved` |
| **Edit Draft** | Button on AI draft | Opens editor | Updates `email_drafts.body` |
| **Reject Draft** | Button on AI draft | Discards AI reply | Updates `email_drafts.status` to `rejected` |
| **Confirm DNC** | Button (hard_pass) | Adds to exclusion list | Creates `email_exclusions` record |
| **Confirm Bounce** | Button (bounce) | Adds to bounce list | Creates `email_exclusions` record |
| **Create Contact** | Button (unknown sender) | Creates contact from email | Creates `contacts` record |
| **Archive** | Button/menu | Marks complete | Updates `synced_emails.status` to `actioned` |
| **Mark Reviewed** | Button | Acknowledges without action | Updates `synced_emails.status` to `reviewed` |
| **Switch View** | Tab click | Filters message list | URL param `?view=[mode]` |
| **Filter by Category** | Sidebar click | Filters by classification group | URL param `?filter=[group]` |
| **Search** | Search box | Text search | Query param |
| **Keyboard nav** | `j`/`k` keys | Next/prev message | Updates selection |

---

## 5. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Sync emails** | Every 5 min | Active | Active | Creates `synced_emails` records |
| **Classify** | New unclassified email | Active | Active | Updates `classification`, `confidence`, `reasoning` |
| **Extract pricing** | `hot_pricing` detected | Active | Active | Updates `extracted_pricing` JSONB |
| **Extract scheduling** | `hot_schedule`/`hot_confirm` | Active | Active | Updates `scheduling_state` JSONB |
| **Draft reply** | Confidence ≥ 0.70 | Creates draft for approval | Creates draft (auto-send if ≥0.85) | Creates `email_drafts` |
| **Create contact** | `referral` with new email | Disabled | Active | Creates `contacts` record |
| **Add to DNC** | `hard_pass` ≥ 0.85 | Disabled (human confirms) | Active (with 24h undo) | Creates `email_exclusions` |
| **Add to bounce list** | `bounce` ≥ 0.85 | Disabled (human confirms) | Active | Creates `email_exclusions` |
| **Stop sequence** | `hard_pass`/`bounce` | Disabled | Active | Updates `sequence_subscriptions.status` |
| **Create nurture task** | `soft_pass` | Disabled | Active | Creates `tasks` record (90 days) |
| **Create call** | `hot_schedule` ≥ 0.85 | Disabled | Active | Creates `calls` record |
| **Create calendar event** | `hot_confirm` ≥ 0.85 | Disabled | Active | Outlook calendar API |
| **Send confirmation** | `hot_confirm` ≥ 0.85 | Disabled | Active | Sends via Outlook |

---

## 6. View Modes

| Mode | Shows | Count Badge |
|------|-------|-------------|
| `needs_review` | `status = 'new'` AND (`needs_review = true` OR `confidence < 0.70`) | Yes |
| `auto_handled` | `auto_handled = true` | Yes |
| `all` | Everything | No |

---

## 7. Processes

### Email Sync Process (Every 5 min)

```
1. Connect to Outlook via COM/Graph API
2. Fetch emails since last sync cursor
3. For each email:
   a. Check if outlook_entry_id exists → skip if duplicate
   b. Determine direction (inbound/outbound) by from_email
   c. Match to existing contact by email address
   d. Match to company via contact
   e. Match to property via active sequence/campaign
   f. Insert into synced_emails with status='new'
4. Update sync cursor
```

### Classification Process (Every 2 min)

```
1. Query synced_emails WHERE classification IS NULL
2. For each unclassified email:
   a. Build context (thread history, contact info, property info)
   b. Call Claude with classification prompt
   c. Receive: category, confidence, reasoning, extracted_data
   d. Update synced_emails with results
   e. If confidence < 0.70: set needs_review = true
   f. If confidence ≥ 0.70: create draft reply
   g. If confidence ≥ 0.85 AND eventual mode: execute action
```

### Draft Approval Process

```
1. AI creates email_drafts record with status='pending'
2. User sees draft in inbox detail view
3. User clicks Approve/Edit/Reject
4. If approved:
   a. Update status to 'approved'
   b. Queue for send via drip-campaign-exec
5. If rejected:
   a. Update status to 'rejected'
   b. User can compose manual reply
```

### DNC/Exclusion Process

```
Initial Mode:
1. AI classifies as hard_pass/bounce
2. User sees "Confirm DNC" / "Confirm Bounce" button
3. User clicks to confirm
4. Creates email_exclusions record
5. Stops any active sequences

Eventual Mode:
1. AI classifies as hard_pass/bounce with ≥0.85 confidence
2. AI creates email_exclusions record
3. AI stops any active sequences
4. User has 24h to undo via inbox
5. After 24h: permanent
```

---

## 8. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `inbox/page.tsx` | Server component, loads data |
| `InboxShell` | `_components/inbox-shell.tsx` | Layout + keyboard handling |
| `MailList` | `_components/mail-list.tsx` | Left panel message list |
| `MailDisplay` | `_components/mail-display.tsx` | Right panel detail view |
| `MessageActions` | `_components/message-actions.tsx` | Action buttons |
| `QuickReplyDialog` | `_components/quick-reply-dialog.tsx` | Reply composer |
| `useInbox` | `_components/use-inbox.ts` | State management hook |
| `ClassificationBadge` | `components/classification-badge.tsx` | Visual indicator |

---

## 9. Database Tables

| Table | Role |
|-------|------|
| `synced_emails` | Core email storage + classification |
| `email_drafts` | AI-generated replies pending approval |
| `email_exclusions` | DNC + bounce list |
| `contacts` | Linked sender info |
| `companies` | Linked company info |
| `properties` | Linked property info |
| `deals` | Created from hot leads |
| `calls` | Scheduled calls |
| `tasks` | Follow-up reminders |
| `sequence_subscriptions` | Active drip campaigns |
| `inbox_view` | Denormalized view for UI queries |

---

## 10. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | Classify only, all actions require human |
| **Phase 2** | Assisted | Draft replies, human approves all |
| **Phase 3** | Semi-autonomous | Auto-send high-confidence, human reviews after |
| **Phase 4** | Autonomous | Full auto with exception handling |

### Phase 1 → 2 Criteria
- Classification accuracy > 90% over 100 emails
- User comfortable with draft quality

### Phase 2 → 3 Criteria
- Draft approval rate > 95%
- No complaints from recipients
- User opts in per category

### Phase 3 → 4 Criteria
- Auto-send accuracy > 99%
- Robust error handling
- Full audit trail
- User explicit opt-in

---

## 11. Edge Cases

| Scenario | Handling |
|----------|----------|
| Unknown sender (no matched contact) | Show "Create Contact" button |
| Email in thread with no parent | Treat as new conversation |
| Multiple properties linked to contact | Show property selector |
| Confidence exactly 0.70 | Treat as medium (draft, needs approval) |
| AI draft rejected 3+ times | Flag for prompt tuning |
| Bounce on previously valid email | Mark contact as bounced, notify user |
| Reply to auto-archived email | Resurface to inbox |
| Duplicate email (re-sync) | Skip via outlook_entry_id unique constraint |
