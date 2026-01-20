# Upstream + Lee 1031 X Vision

## The Two Systems

**Lee 1031 X (XChange)** is a deal distribution platform where brokers submit buyer criteria for 1031 exchange clients. Deals get matched to buyers through progressive disclosure:

```
Teaser → CA signed → Property details + docs → Review → LOI → Seller contact → Under contract
```

**Upstream** is the sourcing engine that feeds lee-1031x with off-market deals. It finds motivated sellers, qualifies them through outreach and calls, and packages deals for distribution.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│   LEE 1031 X                                    UPSTREAM                    │
│   (Deal Distribution)                           (Deal Sourcing)             │
│                                                                             │
│   ┌─────────────────┐                          ┌─────────────────┐          │
│   │ Buyer Criteria  │─────── criteria ────────▶│ Search + Query  │          │
│   │ from Brokers    │                          │ Generation      │          │
│   └─────────────────┘                          └────────┬────────┘          │
│                                                         │                   │
│                                                         ▼                   │
│                                                ┌─────────────────┐          │
│                                                │ Email Campaigns │          │
│                                                │ to Property     │          │
│                                                │ Owners          │          │
│                                                └────────┬────────┘          │
│                                                         │                   │
│   ┌─────────────────┐                                   │                   │
│   │ Deal Matching   │◀──────── replies ─────────────────┤                   │
│   │ to Buyers       │         classified                │                   │
│   └────────┬────────┘                                   ▼                   │
│            │                                   ┌─────────────────┐          │
│            │                                   │ Qualify via     │          │
│            │                                   │ Calls + Docs    │          │
│            │                                   └────────┬────────┘          │
│            │                                            │                   │
│            │                                            ▼                   │
│            │                                   ┌─────────────────┐          │
│            │◀──────── packaged deal ──────────│ Deal Packaging  │          │
│            │                                   └─────────────────┘          │
│            ▼                                                                │
│   ┌─────────────────┐                                                       │
│   │ Broker/Buyer    │                                                       │
│   │ Review + LOI    │                                                       │
│   └─────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bidirectional Flows

The real value is that data flows both directions, and campaigns uncover more than just sellers.

### Flow 1: Buyer Criteria → Find Sellers (Primary)

The main flow. A broker submits criteria to lee-1031x, which triggers Upstream to find matching sellers.

```
Broker submits criteria
    ↓
Criteria flows to Upstream
    ↓
Upstream generates CoStar queries
    ↓
Email campaigns to property owners
    ↓
Responses classified + qualified
    ↓
Calls with quasi-qualified leads
(Partner handles calls with 35+ years experience, operator takes notes)
    ↓
On call: Get the story + enough for an offer
(Need 2 of 3: NOI, cap rate, price)
    ↓
If immediate buyer → match directly
If no immediate buyer → create deal in lee-1031x for matching
```

### Flow 2: Campaign Uncovers Buyers (Inbound)

Sometimes the response is "I won't sell, but I'm looking to buy."

```
Campaign email sent
    ↓
Reply: "I won't sell, but I'm looking to buy X"
    ↓
Capture their criteria
    ↓
They become a buyer in the system
    ↓
Create new search from their criteria (source: 'inbound')
```

### Flow 3: Campaign Uncovers Different Inventory (Pivot)

Sometimes the response reveals a different opportunity.

```
Campaign email about industrial property
    ↓
Reply: "Won't sell my industrial, but I'll sell my office in PHX"
    ↓
New opportunity discovered
    ↓
Create deal for the offered property
    ↓
Match against existing buyer criteria (different market/type)
```

### Flow 4: Listing → Find Buyers (Reverse Flow)

When the boss gets a listing, search for buyers instead of sellers.

```
Boss gets a listing
    ↓
Search existing DB for potential buyers matching the listing
    ↓
Or search CoStar for entities that might want to buy
    ↓
Campaign to them (buy-side outreach)
```

---

## What "Leads" Really Are

Leads are not just "potential sellers." They're entities with rich relationship data:

| Attribute | Description |
|-----------|-------------|
| Properties they own | Current portfolio from CoStar |
| Interests | Buy, sell, or both |
| History | Every email, call, response, campaign touchpoint |
| Criteria | If they're a buyer, what they want |
| Status | Where they are in our pipeline |

The system works both directions (find sellers AND find buyers). Matching is not just at deal creation - it should be continuous as new data comes in.

---

## The AI Opportunity

All email campaigns generate rich relationship data:
- Who owns what
- Who wants what
- Who said what, and when

AI could continuously match across this data:

> "Hey, 6 months ago this guy said he'd sell his office in PHX - we now have a buyer for that."

The operator is BOTH the system operator AND a broker, so matching opportunities benefit them directly.

---

## Deal Progression in Lee 1031 X

Once a deal is packaged and uploaded:

```
1. Teaser visible to matching buyers
2. Buyer broker signs CA → releases property details + docs
3. Broker/buyer reviews investment summary, financials
4. Buyer submits LOI
5. LOI execution → releases seller contact info
6. Broker works directly with seller
7. Under contract → removed from matching
```

---

## Current Priority

**Upstream side (sourcing/qualifying).** The lee-1031x platform exists separately.

Focus areas:
1. Search generation from buyer criteria
2. CoStar extraction
3. Email campaigns with classification
4. Qualification pipeline (calls, docs)
5. Deal packaging

The bidirectional flows (capturing inbound buyers, pivoting to different inventory, reverse buy-side campaigns) are planned but not yet implemented.

---

## UI/UX Philosophy: AI-Driven Workflow

**Core principle:** AI runs the system, human reviews and approves. Minimal manual navigation.

### The Four Pages

| Page | Purpose |
|------|---------|
| **Dashboard** | System health, campaign overview, pending items at a glance |
| **Inbox** | AI-driven task queue - review drafts, approve sends, handle tasks |
| **Leads** | Drill down when needed - the "investigate" view, not daily workflow |
| **Settings** | On/off switches, guardrails, automation controls |

### How Work Gets Done

**Creating searches/campaigns:**
```
You (AI Sheet): "Find industrial owners in OC with loans maturing 2026"
AI: Creates search → generates CoStar payloads → runs extraction → creates campaign
You: "Preview the campaign"
AI: Shows contacts to enroll, exclusions with reasons, schedule
You: "Looks good, activate it"
AI: Activates campaign
```

**Processing responses:**
```
Email comes in → Auto-classified → Draft created → Task in Inbox
                                                        ↓
                                         [Expand] shows thread + AI draft
                                         [Approve & Send] → queued → sent
                                         [Edit] → modify draft → approve
                                         [Dismiss] → reject draft
```

**Monitoring:**
```
Dashboard shows:
- Active campaigns (sent/replied/hot counts)
- System health (last sync, worker status)
- Pending items (drafts awaiting approval)

AI Sheet answers:
- "How's the Industrial OC campaign doing?"
- "Show me hot leads from last week"
- "What contacts bounced?"
```

### Safety Guardrails

1. **No auto-send** - AI creates drafts, human approves before sending
2. **DNC/exclusion checks** - Enforced at approval time
3. **Campaign preview** - See who will be emailed before activation
4. **Settings controls** - Global on/off for automation

### What NOT to Build

- Complex filter UIs for data that doesn't exist yet
- Dedicated pages for every entity type
- Manual workflows that AI can handle
- Features before understanding the actual workflow

---

## Key Insight for Future Claude Sessions

When working on this codebase, remember:

1. **Two systems exist** - Upstream (this repo) feeds lee-1031x (separate)
2. **Leads are bidirectional** - Same entity can be buyer, seller, or both
3. **Campaigns generate intel** - Responses reveal more than just yes/no on current property
4. **Matching is continuous** - Not just at deal creation, but as new data arrives
5. **Operator = Broker** - The person running Upstream is also a broker who benefits from matches
6. **AI-first UI** - AI Sheet is the command center, Inbox is for approvals, Dashboard is for monitoring
7. **Human approval required** - Never auto-send emails, always create drafts for review
8. **Minimal pages** - Dashboard, Inbox, Leads, Settings. That's it.
