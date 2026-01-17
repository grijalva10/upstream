# People Page Behavior Spec

> **Mode:** Initially heavily assisted → Eventually autonomous

---

## 1. Overview

The People page provides a unified view of all contacts and companies in the system, organized by relationship type. This replaces the need for separate "Contacts" and "Companies" pages by showing people grouped by their role in the sourcing workflow.

---

## 2. Contact Types (Groups)

| Type | Description | Source | Example |
|------|-------------|--------|---------|
| `seller` | Property owner (outbound target) | CoStar extraction | John Smith, ABC Properties LLC |
| `buyer` | External investor with capital | Manual, inbound inquiry | Sean (active buyer client) |
| `broker` | External broker at another firm | Referral, email reply | Agent at CBRE, Northmarq |
| `tenant` | Looking for space | Inbound inquiry | Business seeking location |
| `team` | Lee & Associates colleagues | Manual, @lee-associates.com | Brian, Ethan |
| `vendor` | Service/data providers | Manual | CoStar rep, title company |
| `other` | Catch-all for unclassified | Various | Unknown relationships |

---

## 3. Contact States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `active` | Can be contacted | Green dot | `dnc`, `bounced`, `unsubscribed` |
| `dnc` | Do Not Contact (requested) | Red "DNC" badge | — (terminal) |
| `bounced` | Email bounced | Yellow "Bounced" badge | `active` (if corrected) |
| `unsubscribed` | Opted out | Gray "Unsubscribed" badge | — (terminal) |

---

## 4. Company States

| State | Description | UI Indicator | Transitions To |
|-------|-------------|--------------|----------------|
| `new` | Just extracted, not contacted | No badge | `contacted` |
| `contacted` | Outreach sent | Blue "Contacted" badge | `engaged`, `dnc`, `rejected` |
| `engaged` | Responded, in conversation | Green "Engaged" badge | `qualified`, `dnc`, `rejected` |
| `qualified` | Deal created, in pipeline | Purple "Qualified" badge | `handed_off` |
| `handed_off` | Passed to buyer/broker | Gray "Handed Off" badge | — |
| `dnc` | Do Not Contact | Red "DNC" badge | — (terminal) |
| `rejected` | Not a fit | Gray "Rejected" badge | — (terminal) |

---

## 5. Human Actions

### List Page (/people)

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **View by type** | Tab click | Filters by contact_type | URL param `?type=[type]` |
| **Search** | Search box | Text search on name/email/company | Query param |
| **Filter by status** | Dropdown | Filters by contact status | URL param |
| **Select contact** | Click row | Shows detail panel | URL param `?id=[uuid]` |
| **Add person** | "Add Person" button | Opens create dialog | — |
| **Create contact** | Dialog submit | Creates contact record | Creates `contacts` record |
| **Bulk select** | Checkboxes | Enables bulk actions | — |
| **Bulk update type** | Action menu | Changes contact_type | Updates `contacts.contact_type` |
| **Export** | "Export" button | Downloads CSV | — |

### Detail Panel

| Action | Trigger | What It Does | Database Changes |
|--------|---------|--------------|------------------|
| **Edit contact** | Edit icon | Opens inline editor | Updates `contacts` fields |
| **Change type** | Type dropdown | Updates relationship type | Updates `contacts.contact_type` |
| **Add to DNC** | "Add to DNC" button | Marks as Do Not Contact | Updates `contacts.status`, creates `dnc_entries` |
| **View company** | Company link | Navigate to company detail | — |
| **View properties** | Properties link | Navigate to linked properties | — |
| **View deals** | Deals link | Navigate to linked deals | — |
| **View activity** | Activity tab | Shows email/call history | — |
| **Send email** | "Email" button | Opens compose dialog | — |
| **Schedule call** | "Call" button | Opens call scheduler | Creates `calls` record |
| **Add note** | "Note" button | Adds activity note | Creates `activities` record |
| **Delete contact** | Delete button | Removes contact | Deletes `contacts` record |

---

## 6. AI Actions

| Action | Trigger | Initial Mode | Eventual Mode | Database Changes |
|--------|---------|--------------|---------------|------------------|
| **Auto-classify type** | New contact from extraction | Active | Active | Sets `contact_type` based on source |
| **Detect broker** | `broker` classification in email | Disabled | Active | Updates `contact_type` to `broker` |
| **Detect buyer** | `buyer_inquiry` classification | Active | Active | Updates `contact_type` to `buyer` |
| **Create from referral** | `referral` email classification | Disabled | Active | Creates new `contacts` record |
| **Merge duplicates** | Duplicate detection | Disabled | Active (with approval) | Merges records |
| **Enrich contact** | Missing data detected | Disabled | Active | Updates contact fields |

---

## 7. View Modes

| Mode | Shows | Count Badge |
|------|-------|-------------|
| `all` | All contacts | No |
| `sellers` | contact_type = 'seller' | Yes |
| `buyers` | contact_type = 'buyer' | Yes |
| `brokers` | contact_type = 'broker' | Yes |
| `tenants` | contact_type = 'tenant' | Yes |
| `team` | contact_type = 'team' | No |
| `vendors` | contact_type = 'vendor' | No |
| `other` | contact_type = 'other' | No |

---

## 8. Database Tables

### Core Tables

| Table | Role |
|-------|------|
| `contacts` | People records with type and status |
| `companies` | Organization records |
| `property_companies` | Junction: property ↔ company (role) |
| `activities` | Email/call/note history |
| `synced_emails` | Email thread history |
| `deals` | Linked deals for qualified contacts |

### Contacts Table Key Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `company_id` | UUID | Link to company |
| `name` | TEXT | Full name |
| `email` | TEXT | Primary email (unique) |
| `phone` | TEXT | Primary phone |
| `title` | TEXT | Job title |
| `contact_type` | TEXT | seller, buyer, broker, tenant, team, vendor, other |
| `status` | TEXT | active, dnc, bounced, unsubscribed |
| `source` | TEXT | costar, manual, referral, inbound |
| `is_buyer` | BOOLEAN | Flag for buyer contacts |
| `is_seller` | BOOLEAN | Flag for seller contacts |
| `is_decision_maker` | BOOLEAN | Confirmed decision maker |
| `last_contacted_at` | TIMESTAMPTZ | Last outreach sent |

---

## 9. Processes

### Add Person Process

```
1. User clicks "Add Person"
2. Dialog opens with type selector (default: seller)
3. User enters: name (required), email, phone, company, title
4. User selects contact_type
5. Submit creates contacts record
6. If company name provided but not linked:
   a. Check for existing company match
   b. Create new company if needed
   c. Link contact to company
```

### Type Change Process

```
1. User selects new contact_type from dropdown
2. System updates contacts.contact_type
3. If changing to 'buyer':
   - Sets is_buyer = true
   - Checks for buyer_criteria_tracking record
4. If changing from 'buyer':
   - Sets is_buyer = false (unless has active searches)
5. If changing to 'dnc':
   - Creates dnc_entries record
   - Stops any active sequences
```

### Create from Referral Process (Eventual Mode)

```
1. Email classified as 'referral' with new contact info
2. AI extracts: name, email, phone, relationship
3. AI creates new contact with:
   - contact_type = inferred from context
   - source = 'referral'
   - company_id = same as referrer (if applicable)
4. AI links referral email to new contact
5. Creates task for human to review new contact
```

---

## 10. UI Components

| Component | File | Purpose |
|-----------|------|---------|
| `page.tsx` | `people/page.tsx` | Main page |
| `people-tabs.tsx` | `_components/` | Type filter tabs |
| `people-table.tsx` | `_components/` | Contact list table |
| `contact-detail.tsx` | `_components/` | Right panel detail view |
| `add-person-dialog.tsx` | `_components/` | Create contact dialog |
| `activity-feed.tsx` | `_components/` | Activity history list |
| `contact-actions.tsx` | `_components/` | Action button group |

---

## 11. Automation Progression

| Phase | Description | AI Autonomy |
|-------|-------------|-------------|
| **Phase 1** (Current) | Heavily assisted | Manual type assignment, auto-classify on extraction |
| **Phase 2** | Assisted | AI suggests type changes, human confirms |
| **Phase 3** | Semi-autonomous | AI updates type on email classification |
| **Phase 4** | Autonomous | Full auto-classification with correction learning |

### Phase 1 → 2 Criteria
- Contact type accuracy > 90% on extraction
- User comfortable with suggestions

### Phase 2 → 3 Criteria
- Type suggestions accepted > 95%
- Clear classification rules validated

### Phase 3 → 4 Criteria
- Full workflow runs without errors
- User opts in to auto-classification

---

## 12. Edge Cases

| Scenario | Handling |
|----------|----------|
| Duplicate email | Show warning, offer to merge or update existing |
| Contact without company | Create orphan contact, show "Add Company" prompt |
| Unknown sender in inbox | Show in "Needs Review" with "Create Contact" button |
| Multiple types (seller + broker) | Use primary type, set flags for secondary |
| Team member in CoStar extract | Auto-detect @lee-associates.com, set type = 'team' |
| Vendor with multiple contacts | Link all to same company, show company view |

---

## 13. Integration Points

| System | Integration |
|--------|-------------|
| **Inbox** | Unknown sender → create contact |
| **Campaigns** | Sellers enrolled in sequences |
| **Deals** | Contacts linked to qualification |
| **Searches** | Buyers linked via buyer_criteria_tracking |
| **Calls** | Scheduled calls linked to contacts |
| **Data pages** | Detailed property/company views |

---

## 14. Type Detection Rules

| Signal | Inferred Type |
|--------|---------------|
| Source = 'costar' | seller |
| Email @lee-associates.com | team |
| Classification = 'buyer_inquiry' | buyer |
| Classification = 'broker' | broker |
| Title contains 'broker', 'agent' | broker |
| Has buyer_criteria_tracking | buyer |
| Manual entry with 'Looking for space' | tenant |
| Domain matches known vendor | vendor |
| Unclear | other (prompt user) |
