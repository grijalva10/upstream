# Upstream Playbook

Complete operational guide for the Upstream sourcing engine.

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UPSTREAM: COMPLETE FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

══════════════════════════════════════════════════════════════════════════════════
STAGE 1: INTAKE
══════════════════════════════════════════════════════════════════════════════════

    Lee & Associates Broker
              │
              ▼
    ┌─────────────────────┐
    │  Buyer Criteria     │  Property type, size, geography, price range,
    │  + Buyer Profile    │  cap target, 1031/cash, timeline, etc.
    └─────────────────────┘
              │
              ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 2: LIST GENERATION (sourcing-agent)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────┐
    │   sourcing-agent    │
    │                     │
    │  • Translate criteria to CoStar query
    │  • Apply targeting filters:
    │    - Long hold (10+ yrs)
    │    - Loan maturity approaching
    │    - Owner-occupied
    │    - Out-of-state owners
    │    - Estate/trust ownership
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   CoStar Extract    │  (runs locally - requires 2FA)
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   Database          │
    │                     │
    │  • extraction_lists
    │  • properties
    │  • companies (owners)
    │  • contacts
    └─────────────────────┘
              │
              ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 3: COLD OUTREACH (drip-campaign-exec)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────┐
    │                      3-EMAIL DRIP SEQUENCE                       │
    │                                                                  │
    │   Email 1 (Day 0)          Email 2 (Day 1-3)      Email 3 (Day 3-5)
    │   Initial outreach    →    Follow-up         →    Final attempt  │
    │                                                                  │
    │   • Send window: 9am-4pm                                        │
    │   • Staggered (not blasting)                                    │
    │   • Personalized per property/owner                             │
    │   • Awaits approval initially                                   │
    └─────────────────────────────────────────────────────────────────┘
              │
              │ ◄─────────────── AUTO-STOP if reply received
              ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 4: RESPONSE HANDLING (response-classifier)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────┐
    │  Inbound Email      │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │ response-classifier │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                      CLASSIFICATION                              │
    ├──────────────┬──────────────┬──────────────┬────────────────────┤
    │              │              │              │                    │
    ▼              ▼              ▼              ▼                    ▼

INTERESTED    PRICING_GIVEN    QUESTION     REFERRAL          SOFT_PASS
"Let's talk"  "$5M, 6% cap"    "Who's the   "Talk to my       "Not right
"Tell me      "NOI is $1.2M"    buyer?"      partner John"     now"
 more"                                                         "Maybe later"
    │              │              │              │                    │
    ▼              ▼              ▼              ▼                    ▼
   ───────────────────────────────────────────────────          ┌──────────┐
          CONTINUE TO QUALIFICATION                              │ Add to   │
   ───────────────────────────────────────────────────          │ nurture  │
                                                                 │ (re-engage
                                                                 │  later)  │
                                                                 └──────────┘

    ▼                    ▼                    ▼

HARD_PASS           BROKER_REDIRECT         BOUNCE
"Remove me"         "Contact my broker"     Email undeliverable
"Not interested"    Broker email domain
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐         ┌─────────┐         ┌─────────┐
│ Add to  │         │ Log it  │         │ Add to  │
│ DNC     │         │ Note    │         │ email   │
│ FOREVER │         │ broker  │         │exclusion│
└─────────┘         │ info    │         │ FOREVER │
                    │ Don't   │         └─────────┘
                    │ pursue  │
                    └─────────┘

══════════════════════════════════════════════════════════════════════════════════
STAGE 5: QUALIFICATION (qualify-agent)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────┐
    │                    QUALIFICATION LOOP                            │
    │                                                                  │
    │    ┌──────────────────────────────────────────────────────┐     │
    │    │              WHAT DO WE HAVE?                         │     │
    │    │                                                       │     │
    │    │  □ Pricing (need 2 of 3)                             │     │
    │    │    □ NOI                                              │     │
    │    │    □ Cap Rate                                         │     │
    │    │    □ Asking Price                                     │     │
    │    │                                                       │     │
    │    │  □ Motivation / Story                                 │     │
    │    │  □ Timeline                                           │     │
    │    │  □ Decision maker confirmed (not a broker)           │     │
    │    │                                                       │     │
    │    │  BONUS:                                               │     │
    │    │  □ Operating statements                               │     │
    │    │  □ Rent roll                                          │     │
    │    └──────────────────────────────────────────────────────┘     │
    │                           │                                      │
    │                           ▼                                      │
    │              ┌────────────────────────┐                         │
    │              │   MISSING SOMETHING?   │                         │
    │              └────────────────────────┘                         │
    │                    │            │                                │
    │                    ▼            ▼                                │
    │         ┌──────────────┐  ┌─────────────────────┐               │
    │         │ Email to ask │  │ STALLING?           │               │
    │         │ for missing  │  │                     │               │
    │         │ pieces       │  │ • 2+ emails, no     │               │
    │         └──────────────┘  │   pricing           │               │
    │                │          │ • Owner dodging     │               │
    │                │          │ • 5+ days stalled   │               │
    │                │          │         │           │               │
    │                │          │         ▼           │               │
    │                │          │ ┌───────────────┐   │               │
    │                │          │ │ ESCALATE TO   │   │               │
    │                │          │ │ CALL REQUEST  │   │               │
    │                │          │ └───────────────┘   │               │
    │                │          └─────────────────────┘               │
    │                │                    │                            │
    │                └─────────┬──────────┘                            │
    │                          ▼                                       │
    │           ┌──────────────────────────────┐                      │
    │           │     RESPONSE / CALL          │◄──── Awaits          │
    │           │     (new info comes in)      │      Approval        │
    │           └──────────────────────────────┘      Initially       │
    │                          │                                       │
    │                          ▼                                       │
    │                  (loop back to check)                           │
    │                                                                  │
    └─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  HAVE 2 of 3 PRICING  │
              │  + MOTIVATION         │
              │  + DECISION MAKER     │
              │  = QUALIFIED          │
              └───────────────────────┘
                          │
                          ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 6: CALL FLOW (schedule-agent)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────┐
    │                       CALL SCENARIOS                             │
    │                                                                  │
    │  OWNER REQUESTS CALL              SYSTEM ESCALATES TO CALL      │
    │  "Let's talk"                     (stalling via email)          │
    │         │                                   │                    │
    │         └───────────────┬───────────────────┘                    │
    │                         ▼                                        │
    │              ┌─────────────────────┐                            │
    │              │   schedule-agent    │                            │
    │              │                     │                            │
    │              │  • Propose 3 times  │                            │
    │              │  • Include cal link │                            │
    │              └─────────────────────┘                            │
    │                         │                                        │
    │                         ▼                                        │
    │              ┌─────────────────────┐                            │
    │              │   Call Confirmed    │                            │
    │              │                     │                            │
    │              │  • Create calendar  │                            │
    │              │    event (Outlook)  │                            │
    │              │  • Create call prep │                            │
    │              │    task             │                            │
    │              └─────────────────────┘                            │
    │                         │                                        │
    │                         ▼                                        │
    │              ┌─────────────────────┐                            │
    │              │   30 Min Before     │                            │
    │              │                     │                            │
    │              │  • Email prep sent  │                            │
    │              │  • Dashboard ready  │                            │
    │              └─────────────────────┘                            │
    │                         │                                        │
    │                         ▼                                        │
    │              ┌─────────────────────┐                            │
    │              │      THE CALL       │                            │
    │              │                     │                            │
    │              │  Get in 15 min:     │                            │
    │              │  • All 3 pricing    │                            │
    │              │  • Motivation       │                            │
    │              │  • Timeline         │                            │
    │              │  • Decision maker   │                            │
    │              │  • Request docs     │                            │
    │              └─────────────────────┘                            │
    │                         │                                        │
    │                         ▼                                        │
    │              ┌─────────────────────┐                            │
    │              │   Post-Call         │                            │
    │              │                     │                            │
    │              │  • Log notes in UI  │                            │
    │              │  • Update qual data │                            │
    │              │  • Send follow-up   │                            │
    │              │    email if needed  │                            │
    │              └─────────────────────┘                            │
    │                                                                  │
    │  ────────────────────────────────────────────────────────────   │
    │                                                                  │
    │  "CALL ME IN X"                   UNEXPECTED CALL               │
    │  "Reach back in a month"          (they just call you)          │
    │         │                                   │                    │
    │         ▼                                   ▼                    │
    │  ┌─────────────────┐              ┌─────────────────┐           │
    │  │ Create task     │              │ Phone lookup    │           │
    │  │ with future     │              │ in UI           │           │
    │  │ due date        │              │                 │           │
    │  │                 │              │ Search by       │           │
    │  │ Surface when    │              │ phone/email/    │           │
    │  │ due             │              │ name/address    │           │
    │  └─────────────────┘              │                 │           │
    │                                   │ → Instant lead  │           │
    │                                   │   card          │           │
    │                                   └─────────────────┘           │
    └─────────────────────────────────────────────────────────────────┘
                          │
                          ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 7: DEAL PACKAGING (deal-packager)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────┐
    │    QUALIFIED LEAD   │
    │                     │
    │  ✓ 2 of 3 pricing   │
    │  ✓ Motivation       │
    │  ✓ Decision maker   │
    │  (+ docs if lucky)  │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   deal-packager     │
    │                     │
    │  • Compile all info │
    │  • Generate summary │
    │  • Generate highlights
    │  • Structure JSON   │
    └─────────────────────┘
              │
              ▼
    ┌─────────────────────────────────────────────────────────────────┐
    │                     DEAL PACKAGE JSON                            │
    │                                                                  │
    │  {                                                               │
    │    property: { address, type, size, year_built, image_url }     │
    │    financials: { asking_price, noi, cap_rate, price_per_sf }    │
    │    investment_summary: "...",                                    │
    │    investment_highlights: [...],                                 │
    │    seller_info: { name, company, email, motivation, timeline }  │
    │    supporting_docs: { has_operating_statements, has_rent_roll } │
    │    conversation_summary: "..."                                   │
    │  }                                                               │
    └─────────────────────────────────────────────────────────────────┘
              │
              ▼

══════════════════════════════════════════════════════════════════════════════════
STAGE 8: HANDOFF (to other system)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────┐
    │                   PROGRESSIVE DISCLOSURE                         │
    │                                                                  │
    │  TEASER (no CA)          AFTER CA             AFTER LOI         │
    │  ───────────────         ────────             ─────────         │
    │  • Picture               + Address            + Seller name     │
    │  • Price/NOI/Cap         + Property details   + Contact info    │
    │  • Investment summary    + Year built         + Motivation      │
    │  • Type, market          + Lot size           + Full history    │
    │                                                                  │
    └─────────────────────────────────────────────────────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   OTHER SYSTEM      │
    │                     │
    │  • Match to broker  │
    │    buyer criteria   │
    │  • Alert broker     │
    │  • Broker engages   │
    │  • Deal closes      │
    └─────────────────────┘


══════════════════════════════════════════════════════════════════════════════════
MONITORING & AUTOMATION (UI)
══════════════════════════════════════════════════════════════════════════════════

    ┌─────────────────────────────────────────────────────────────────┐
    │                      APPROVAL QUEUE                              │
    │                                                                  │
    │  Pending Emails:                                                │
    │  □ Initial outreach to John Smith (123 Main St)  [Edit][Approve]│
    │  □ Follow-up to Will Dyck (3838 Camino)          [Edit][Approve]│
    │  □ Call request to Mary Jones (456 Oak Ave)      [Edit][Approve]│
    │                                                   [Approve All] │
    └─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                   ACTIVE CONVERSATIONS                           │
    │                                                                  │
    │  ● Will Dyck - 3838 Camino - QUALIFIED - ready to package       │
    │  ● Tim Huynh - Seattle - pricing given - need motivation        │
    │  ○ Alex Shah - 485 Santa Fe - call scheduled Thu 2pm            │
    │  ○ Imran Jamal - 6608 Highway 6 - awaiting response             │
    └─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                     UPCOMING TASKS                               │
    │                                                                  │
    │  Today:     Call with Alex Shah @ 2pm                           │
    │  Tomorrow:  Follow up with Yunus                                │
    │  Next week: Re-engage Bryan Gordon                              │
    └─────────────────────────────────────────────────────────────────┘

    ┌─────────────────────────────────────────────────────────────────┐
    │                    AUTOPILOT LEVELS                              │
    │                                                                  │
    │  Level 0: TRAINING       Every action needs approval            │
    │  Level 1: DRAFTS         System drafts, you approve             │
    │  Level 2: AUTO-SEND      Sends auto, you review daily           │
    │  Level 3: FULL AUTOPILOT Runs autonomously                      │
    │  Level 4: SELF-OPTIMIZING A/B tests, adjusts targeting         │
    └─────────────────────────────────────────────────────────────────┘
```

---

## The Straightline (Summary)

```
Criteria In → Find Owners → Email (3x) → Classify Response
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
               Interested              Stalling/Slow                  Pass/DNC
                    │                         │                         │
                    ▼                         ▼                         ▼
            Ask for pricing          Escalate to call              Log & move on
                    │                         │
                    └────────────┬────────────┘
                                 ▼
                    Get 2 of 3 + Motivation + Decision Maker
                                 │
                                 ▼
                            QUALIFIED
                                 │
                                 ▼
                          Deal Package
                                 │
                                 ▼
                       Handoff to Other System
```

---

## The Vision

A **self-running sourcing machine** that:
1. Takes broker buyer criteria
2. Finds targets, reaches out, handles responses, qualifies leads
3. Schedules calls, preps you, tracks everything
4. Packages qualified deals for handoff
5. You monitor and approve until confident
6. Toggle to autopilot - system runs + improves itself
7. You become the exception handler (intervene only when needed)

---

## What Upstream Does

**Input:** Buyer criteria + buyer profile (from Lee & Associates brokers with 1031 buyers)
**Output:** Qualified seller leads as deal packages → other system handles matching/broker alerts

```
Upstream Pipeline:
┌──────────────────────────────────────────────────────────────────┐
│  Buyer Criteria + Profile                                        │
│         ↓                                                        │
│  [sourcing-agent] → CoStar extraction → property/owner list      │
│         ↓                                                        │
│  [drip-campaign-exec] → 3-email sequence → outreach              │
│         ↓                                                        │
│  [response-classifier] → categorize inbound replies              │
│         ↓                                                        │
│  [qualify-agent] → respond, get NOI/price/cap + story            │
│         ↓                                                        │
│  [deal-packager] → qualified deal JSON + teaser assets           │
│         ↓                                                        │
│  → Handoff to matching system                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Stage 1: Intake

### Buyer Criteria (what properties to find)
- Property type (office, industrial, retail, multifamily)
- Geography (market, submarket, radius)
- Size range (SF, units, acres)
- Price range
- Cap rate target
- Value-add vs stabilized
- Special requirements (zoning, parking, etc.)

### Buyer Profile (what makes this buyer attractive to sellers)
- Cash buyer / no financing contingency
- 1031 exchange (timeline pressure = fast close)
- Quick close capability (30-45 days)
- Sale-leaseback option available
- No re-trade reputation
- Institutional backing

---

## Stage 2: List Generation (sourcing-agent)

### Process
1. Translate buyer criteria → CoStar query payloads
2. Run extraction via costar-extract
3. Store in: `extraction_lists` → `list_properties` → `properties`
4. Enrich with owner data → `companies` + `contacts`

### Targeting Filters (find motivated sellers)
- Owner-occupied (sale-leaseback candidates)
- Long hold period (10+ years, low basis, may want to exit)
- Loan maturity approaching (refinance pressure)
- High LTV / low DSCR (financial stress)
- Estate/trust ownership (succession planning)
- Out-of-state owners (management fatigue)

---

## Stage 3: Cold Outreach (drip-campaign-exec)

### Sequence Structure
```
Email 1: Day 0 (initial outreach)
Email 2: Day 1-3 (follow-up if no response)
Email 3: Day 3-5 (final attempt)
```

### Timing Rules
- Send window: 9:00 AM - 4:00 PM recipient local time
- Stagger sends: not blasting, simulate human typing/sending
- Randomize within window: don't send all at exactly 9:00 AM
- Respect business days only (no weekends)

### Personalization
Each email includes:
- Owner first name
- Property address
- Property type + size
- Buyer profile highlights relevant to their situation

### Email Templates

**Email 1: Initial Outreach**
```
[Owner First Name] -

I represent a [1031 buyer / cash buyer] actively seeking [property type]
in [market]. Your property at [address] fits their criteria.

Property: [address]
• [type] | [size SF/units] | [acres] lot

Buyer profile:
• All-cash, no financing contingency
• 30-45 day close capability
• [Sale-leaseback available if owner-occupied]

If you'd consider an offer, I'd like to discuss.
Happy to share more about the buyer or answer questions first.

[signature]
```

**Email 2: Follow-up**
```
[Owner First Name] -

Following up on [property address]. My buyer remains interested
and can move quickly if the timing works on your end.

Would you be open to a brief call to discuss?

[signature]
```

**Email 3: Final Attempt**
```
[Owner First Name] -

Last note on [property address]. If you're not considering a sale
right now, no problem - just let me know and I'll make a note
for future reference.

If circumstances change, I'm always reachable.

[signature]
```

### Approval Flow (Initial Phase)
- System generates email draft
- Draft appears in UI for review
- User clicks Approve → email sends
- After confidence builds → toggle to auto-send

---

## Stage 4: Response Classification (response-classifier)

### Categories

| Code | Classification | Signals | Priority |
|------|---------------|---------|----------|
| `interested` | Wants to engage | "Let's talk", "Tell me more", "What's the offer?" | HIGH |
| `pricing_given` | Provided numbers | Contains $, cap, NOI, asking price | HIGH |
| `question` | Needs info before deciding | "Who's the buyer?", "Is this 1031?", "What's timeline?" | MEDIUM |
| `referral` | Forwarded to someone else | "Talk to my partner", "CC'ing our broker" | MEDIUM |
| `broker_redirect` | Owner has broker representation | "Contact my broker at...", broker email domain | LOW (note it) |
| `soft_pass` | Not now but not never | "Not actively looking", "Maybe later", "Bad timing" | LOW |
| `hard_pass` | Definite no | "Not interested", "Remove me", "Do not contact" | NONE |
| `ooo_bounce` | Auto-reply or delivery failure | Out of office, bounce message | NONE |

### Classification Output
```json
{
  "email_id": "uuid",
  "classification": "pricing_given",
  "confidence": 0.92,
  "extracted_data": {
    "asking_price": 21900000,
    "noi": 1195000,
    "cap_rate": 0.06
  },
  "sentiment": "positive",
  "next_action": "qualify"
}
```

---

## Stage 5: Respond & Qualify (qualify-agent)

### Response Playbook

**For `interested`:**
```
[Owner Name] -

Thanks for getting back to me. A few quick questions to see if this
could be a fit:

1. Do you have a sense of pricing or value you'd need to consider a sale?
2. What's driving your interest - any particular timeline or situation?

Happy to jump on a call if easier. What works for your schedule?

[signature]
```

**For `pricing_given` (missing pieces):**
```
[Owner Name] -

Appreciate you sharing that. To get this in front of my buyer properly,
I just need [one/two] more data points:

[If missing NOI]: What's the current annual NOI (or approximate)?
[If missing cap]: What cap rate are you targeting?
[If missing price]: What asking price would work for you?

Also helpful: any context on why you'd consider selling and ideal timeline.

[signature]
```

**For `pricing_given` (have 2 of 3):**
```
[Owner Name] -

That's helpful - [price] at [cap/NOI] is in the range my buyer can work with.

Before I bring this to them formally:
- What's driving your interest in selling?
- Any particular timeline or terms that matter to you?
- Do you have recent operating statements or rent roll you could share?

[signature]
```

**For `question`:**
Answer directly, then pivot back:
```
[Owner Name] -

[Direct answer to their question]

Does that help? If so, would you be open to discussing [property address] further?

[signature]
```

**For `referral`:**
```
Hi [New Contact Name] -

[Owner Name] suggested I reach out to you regarding [property address].

I represent a [buyer profile] interested in acquiring [property type] in [market].
Would you be open to a brief conversation about whether a sale might make sense?

[signature]
```

**For `broker_redirect`:**
- Log in database: `companies.has_broker = true`, `companies.broker_contact = [info]`
- Do NOT pursue (owner is represented)
- Note for future: skip this owner in future campaigns

**For `soft_pass`:**
```
[Owner Name] -

Understood - appreciate you letting me know. I'll make a note and won't
follow up unless you reach out.

If circumstances change down the road, feel free to get in touch.

[signature]
```

**For `hard_pass`:**
- Add to DNC list (`dnc_entries` table)
- No response sent
- Mark company status = `dnc`

**For `bounce`:**
- Add email to permanent exclusion (never email again)
- Try to find alternate contact if available
- Log bounce reason (invalid, full mailbox, etc.)

---

## DNC vs Soft Pass vs Bounce

| Type | Example | Action | Future Contact |
|------|---------|--------|----------------|
| **Hard Pass** | "Remove me", "Not interested", "Stop emailing" | Add to DNC | Never |
| **Soft Pass** | "Not right now", "Bad timing", "Call me in 6 months" | Add to nurture | Yes, after delay |
| **Bounce** | Email undeliverable | Exclude email address | Never (that email) |

Soft pass = future pipeline. Don't burn these.

---

## Call Scheduling & Prep (schedule-agent)

### When Owner Wants a Call

**Response template:**
```
[Owner Name] -

Happy to connect. A few times that work on my end:

• [Day], [Date] at [Time] PT
• [Day], [Date] at [Time] PT
• [Day], [Date] at [Time] PT

Or if easier, here's my calendar link: [Calendly/Booking URL]

Looking forward to it.

[signature]
```

**System actions:**
1. Propose 3 time slots (business hours, spaced across next few days)
2. Include booking link as backup
3. When confirmed → create calendar event + call prep task

### Call Prep (30 min before)

**Email summary sent to you:**
```
Subject: Call Prep: [Owner Name] - [Property Address] @ [Time]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CALL WITH: [Owner Name] ([Company])
PROPERTY: [Address] | [Type] | [Size SF]
TIME: [Date] at [Time]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT WE KNOW:
• Asking: $[X] | NOI: $[X] | Cap: [X]%
• Motivation: [what they've shared]
• Timeline: [what they've shared]

CONVERSATION HISTORY:
• [Date]: Initial outreach sent
• [Date]: They replied - "[summary]"
• [Date]: You followed up asking for [X]
• [Date]: They provided [X]

WHAT TO GET ON THIS CALL:
□ [Missing pricing metric]
□ Why are they selling?
□ What's their timeline?
□ Who's the decision maker?
□ Can they send operating statements / rent roll?

QUICK NOTES:
• [Any flags - e.g., "mentioned they have a broker", "seemed hesitant on price"]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Dashboard view (for during call):**
- Same info but in UI
- Ability to take notes in real-time
- Quick buttons: "Got pricing", "Got motivation", "They passed", "Schedule follow-up"

### Unexpected Calls

**Phone lookup in UI:**
- Search by phone number, email, name, or property address
- Returns lead card with full context
- Same info as call prep, instant access

### "Call Me in X" → Task/Reminder

When owner says "reach out in a month" / "call me after Q1":

1. Parse the timeframe
2. Create reminder task with future date
3. Surface in "Upcoming Tasks" dashboard
4. When due: re-inject into sequence or prompt for outreach

```sql
-- tasks table addition
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'call_reminder', 'follow_up', 'review_deal'
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),

  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,

  status TEXT DEFAULT 'pending', -- pending, completed, snoozed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### Escalation to Call

Some owners won't give pricing via email but will on a call. Detect stalling and pivot.

**Triggers to request a call:**
- 2+ email exchanges without getting pricing
- Owner responds but dodges specifics
- Owner asks questions but won't commit info
- 5+ days since last response with incomplete qualification

**Escalation response:**
```
[Owner Name] -

Appreciate the back and forth. Might be easier to jump on a quick call
to discuss [property address] directly - I can answer your questions
and get a better sense of what would work on your end.

Do you have 15 minutes this week?

[signature]
```

**After call scheduled:**
- Stop email qualification attempts
- Create call prep task
- Resume email only for logistics (confirming time, sending follow-up)

**Call = Qualification Accelerator**
On a 15-min call you can get:
- All 3 pricing metrics
- Motivation and story
- Timeline
- Decision maker confirmation
- Docs request (ask them to email rent roll after)

Always prefer a call over extended email ping-pong.

---

### Qualification Checklist

Track per company/property:

```
□ Property confirmed
  - address
  - type
  - size (SF/units/acres)
  - year built (if known)

□ Pricing (need 2 of 3)
  - [ ] NOI: $_______
  - [ ] Cap Rate: _____%
  - [ ] Asking Price: $_______

□ Motivation & Story
  - Why selling: _______
  - Timeline: _______
  - What matters to them: _______

□ Supporting Docs (bonus - HUGE if obtained)
  - [ ] Operating statements
  - [ ] Rent roll

□ Decision Maker Confirmed
  - Name: _______
  - Title: _______
  - Direct contact: _______
  - (Not a broker)

□ Engagement Level
  - [ ] Willing to proceed if terms work
```

### Qualification Status

| Status | Meaning |
|--------|---------|
| `new` | Just responded, not yet qualified |
| `engaging` | In conversation, gathering info |
| `qualified` | Has 2 of 3 + motivation + decision maker |
| `docs_received` | Has operating statements / rent roll |
| `ready_to_package` | All info complete, ready for deal-packager |

---

## Stage 6: Deal Packager (deal-packager)

### Trigger
When company qualification status = `ready_to_package`

### Output: Deal Package JSON

```json
{
  "package_id": "uuid",
  "created_at": "2025-01-10T12:00:00Z",

  "property": {
    "address": "3838 Camino del Rio N, San Diego, CA 92108",
    "type": "Office",
    "size_sf": 94612,
    "lot_acres": 5.0,
    "year_built": 1985,
    "image_url": "https://..."
  },

  "financials": {
    "asking_price": 21900000,
    "noi": 1195000,
    "cap_rate": 0.06,
    "price_per_sf": 231.47
  },

  "investment_summary": "94,612 SF Class B office in Mission Valley submarket...",

  "investment_highlights": [
    "Below replacement cost at $231/SF",
    "6% cap with upside as vacancy stabilizes",
    "Recent tenant turnover = value-add opportunity",
    "Strong submarket fundamentals"
  ],

  "seller_info": {
    "company_name": "Summa Fresno LLC",
    "contact_name": "Will Dyck",
    "contact_email": "will@summafresno.com",
    "contact_phone": null,
    "motivation": "Investment property, open to offers, lot of turnover in 2024-2025 but vacancy decreasing",
    "timeline": "Flexible, not rushed"
  },

  "supporting_docs": {
    "operating_statements": false,
    "rent_roll": false
  },

  "conversation_summary": "Initial outreach Sep 18. Owner responded Sep 19 indicating interest. Follow-up Nov 9 requested pricing. Owner provided NOI/cap/price Nov 12 with context on vacancy improvement.",

  "source": {
    "campaign": "Institutional Buyer Seeking Off-Market CA Commercial Properties",
    "first_contact": "2025-09-18",
    "qualified_date": "2025-11-12",
    "total_touches": 4
  }
}
```

### Progressive Disclosure (for other system)

| Stage | What's Shown | What's Hidden |
|-------|--------------|---------------|
| **Teaser** | Picture, price, NOI, cap rate, investment summary/highlights, property type, market | Address, seller info |
| **After CA signed** | + Full address, property details, year built, lot size | Seller info |
| **After LOI submitted** | + Seller name, contact info, motivation, conversation history | Nothing |

---

## Database Schema Additions Needed

### companies table - add fields:
```sql
ALTER TABLE companies ADD COLUMN has_broker BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN broker_contact TEXT;
ALTER TABLE companies ADD COLUMN qualification_status TEXT DEFAULT 'new';
-- new, engaging, qualified, docs_received, ready_to_package
```

### New table: qualification_data
```sql
CREATE TABLE qualification_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  property_id UUID REFERENCES properties(id),

  -- Pricing (2 of 3)
  asking_price NUMERIC,
  noi NUMERIC,
  cap_rate NUMERIC,
  price_per_sf NUMERIC,

  -- Motivation
  motivation TEXT,
  timeline TEXT,
  seller_priorities TEXT,

  -- Docs
  has_operating_statements BOOLEAN DEFAULT FALSE,
  has_rent_roll BOOLEAN DEFAULT FALSE,

  -- Decision maker
  decision_maker_confirmed BOOLEAN DEFAULT FALSE,
  decision_maker_name TEXT,
  decision_maker_title TEXT,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  packaged_at TIMESTAMPTZ
);
```

### sequence_subscriptions - add fields for state:
```sql
ALTER TABLE sequence_subscriptions ADD COLUMN emails_sent INTEGER DEFAULT 0;
ALTER TABLE sequence_subscriptions ADD COLUMN last_response_classification TEXT;
ALTER TABLE sequence_subscriptions ADD COLUMN awaiting_approval BOOLEAN DEFAULT TRUE;
```

---

## Approval Flow (UI)

### Initial Phase (training wheels)
1. System generates outreach email or response
2. Email appears in "Pending Approval" queue
3. User reviews, can edit if needed
4. User clicks "Approve & Send"
5. System sends, logs activity

### Confident Phase (auto-pilot)
1. Toggle campaign to "Auto-send"
2. System sends without approval
3. All activity logged for review
4. User can still intervene anytime

### UI Dashboard Needs
- Pending approvals queue
- Active conversations (by status)
- Qualification progress per lead
- Deal packages ready for handoff
- Campaign performance (sent, opened, replied, qualified)

---

## Metrics to Track

### Funnel Metrics
```
Emails Sent → Replies → Engaged → Pricing Obtained → Qualified → Packaged
   1000        20 (2%)    15         10                 6          4
```

### Per Campaign
- Reply rate
- Qualification rate
- Average touches to qualify
- Time from first touch to qualified

### Per Sequence Step
- Open rate (if tracking)
- Reply rate per email in sequence
- Which email gets most replies?

### Owner Intel
- How many gave pricing?
- How many gave 2 of 3?
- How many gave docs?
- How many were broker-represented?

---

## Self-Improvement: Beast Mode

The system gets smarter over time through feedback loops and pattern detection.

### 1. Template A/B Testing

**How it works:**
- Create multiple variants of each email template
- Randomly assign variants to outreach
- Track: open rate, reply rate, positive response rate
- Automatically favor winners, retire losers

**Example:**
```
Subject Line A: "Off-Market | [Property Type] | [Market]"     → 2.1% reply
Subject Line B: "[Property Address] - acquisition interest"   → 1.4% reply
Subject Line C: "Quick question about [Property Address]"     → 3.2% reply

→ System shifts 70% of sends to C, continues testing A & B
```

**What gets tested:**
- Subject lines
- Opening lines
- Buyer profile positioning
- CTA phrasing
- Email length
- Send times

### 2. Send Time Optimization

**How it works:**
- Track when emails are opened and replied to
- Build heatmap of optimal send times per recipient type
- Shift send windows to match

**Example:**
```
Owners reply most: Tuesday-Thursday, 10am-2pm
Corporate RE directors reply most: Monday, 8-9am
→ Adjust send times per contact type
```

### 3. Targeting Refinement

**How it works:**
- Track which CoStar filters produce leads that:
  - Reply (good)
  - Qualify (better)
  - Close (best)
- Surface patterns, suggest filter adjustments

**Example:**
```
Finding: Owners with 10+ year hold + loan maturity <18 months → 4.2% reply rate
Finding: Owner-occupied industrial → 2x qualification rate vs investor-owned
Finding: Out-of-state owners → 3x more likely to provide pricing

→ System suggests: "Prioritize long-hold + maturing debt + out-of-state owners"
```

### 4. Classification Learning

**How it works:**
- When you correct a classification, system learns
- Confidence scores calibrate over time
- Edge cases get flagged for human review

**Example:**
```
System classified as "interested" → You marked as "broker_redirect"
System learns: emails containing "my broker" or "our agent" = broker_redirect

Next time: auto-classifies correctly
```

### 5. Response Quality Scoring

**How it works:**
- Track which response templates lead to:
  - Continued engagement
  - Pricing obtained
  - Qualification
- Score templates, favor high performers

**Example:**
```
Response Template A (ask for call): 40% → get pricing
Response Template B (ask for 2 of 3): 65% → get pricing

→ Shift to Template B for pricing requests
```

### 6. Predictive Lead Scoring

**How it works:**
- Based on property + owner attributes, predict:
  - Likelihood to reply
  - Likelihood to qualify
  - Likelihood to close
- Prioritize high-score leads

**Signals that correlate with success:**
- Hold period (10+ years = higher)
- Loan maturity approaching (higher)
- Owner-occupied (higher)
- Out-of-state owner (higher)
- Previous response to any outreach (much higher)
- Property vacancy (higher)
- Recent management company change (higher)

### 7. Pattern Detection & Insights

**System surfaces patterns like:**
- "Emails sent Tuesday 10am have 2x open rate"
- "Industrial owners respond 40% faster than office owners"
- "Follow-up email 2 gets more replies than email 3 - consider dropping email 3"
- "Owners in [Market X] are 3x more responsive than [Market Y]"
- "Subject lines mentioning '1031' get fewer opens but higher quality replies"

**Weekly digest:**
- What's working this week vs last
- Suggested adjustments
- Anomalies to investigate

### 8. Feedback Capture Points

| Event | Feedback Captured |
|-------|-------------------|
| You edit draft before sending | Learn your style adjustments |
| You reclassify a response | Improve classifier |
| You mark lead as qualified | Learn what qualified looks like |
| Deal closes | Track full funnel attribution |
| You snooze/dismiss a task | Learn priority preferences |
| Call outcome logged | Learn what call prep was useful |

### 9. Autopilot Confidence Levels

| Level | What Happens | Unlock Criteria |
|-------|--------------|-----------------|
| **Level 0: Training** | Every action needs approval | Start here |
| **Level 1: Drafts** | System drafts, you approve | 50+ approved sends, <5% edits |
| **Level 2: Auto-send, review later** | Sends automatically, you review daily | 200+ sends, <2% issues |
| **Level 3: Full autopilot** | Runs autonomously, alerts on exceptions | 500+ sends, proven patterns |
| **Level 4: Self-optimizing** | Makes its own A/B tests, adjusts targeting | High confidence + your permission |

---

## Agent Definitions (Updated)

| Agent | Purpose | Triggers |
|-------|---------|----------|
| `sourcing-agent` | Buyer criteria → CoStar query payloads + strategy | New criteria submitted |
| `drip-campaign-exec` | Execute email sequences via Outlook | Extraction list ready |
| `response-classifier` | Classify inbound replies (interested, pricing, pass, etc.) | New inbound email |
| `qualify-agent` | Respond to leads, gather missing info, track qualification | Response classified |
| `schedule-agent` | Coordinate calls, create reminders, prep for calls | Owner requests call / reminder needed |
| `deal-packager` | Compile qualified lead into deal package JSON | Lead marked qualified |

---

## What to Build Next

### Phase 1: Core Pipeline (Get it working end-to-end)

**1.1 Response Classification**
- [ ] Finish `response-classifier` for all categories
- [ ] Add bounce detection
- [ ] Add broker-redirect detection
- [ ] Confidence scoring

**1.2 Qualify Agent**
- [ ] Build `qualify-agent` with response playbook
- [ ] Create `qualification_data` table
- [ ] Track what's missing per lead
- [ ] Generate appropriate follow-up responses

**1.3 Drip Sequences**
- [ ] 3-email sequence templates
- [ ] Timing rules (Day 0, 1-3, 3-5)
- [ ] Send window (9am-4pm, staggered)
- [ ] Auto-stop on reply
- [ ] Warm lead sequence (post-response)

**1.4 Approval Queue UI**
- [ ] Pending emails list
- [ ] Edit before send
- [ ] Approve/Reject buttons
- [ ] Batch approve option

### Phase 2: Call Management

**2.1 Schedule Agent**
- [ ] Detect call requests in responses
- [ ] Propose available times
- [ ] Create calendar events (Outlook)
- [ ] Create call prep tasks

**2.2 Call Prep**
- [ ] Email summary 30 min before
- [ ] Dashboard view during call
- [ ] Note-taking in UI
- [ ] Quick action buttons

**2.3 Phone Lookup**
- [ ] Search by phone/email/name/address
- [ ] Instant lead card display

**2.4 Tasks & Reminders**
- [ ] Parse "call me in X" timeframes
- [ ] Create future tasks
- [ ] Task dashboard
- [ ] Due date notifications

### Phase 3: Deal Packaging

**3.1 Deal Packager**
- [ ] JSON output format
- [ ] AI-generated investment summary
- [ ] AI-generated investment highlights
- [ ] Progressive disclosure fields

**3.2 Handoff**
- [ ] Mark as qualified → ready for handoff
- [ ] Export to other system (manual for now)
- [ ] Later: automatic API handoff

### Phase 4: Automation & Learning

**4.1 Automation Toggle**
- [ ] Per-campaign auto-send setting
- [ ] Confidence level tracking
- [ ] Unlock criteria logic

**4.2 A/B Testing Infrastructure**
- [ ] Template variants
- [ ] Random assignment
- [ ] Performance tracking
- [ ] Auto-shift to winners

**4.3 Feedback Loops**
- [ ] Track edits before send
- [ ] Track classification corrections
- [ ] Weekly performance digest

**4.4 Pattern Detection**
- [ ] Send time analysis
- [ ] Targeting correlation analysis
- [ ] Insight surfacing

---

## Database Schema Additions

```sql
-- Tasks table
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL, -- 'call_reminder', 'follow_up', 'review_deal'
  company_id UUID REFERENCES companies(id),
  contact_id UUID REFERENCES contacts(id),
  property_id UUID REFERENCES properties(id),
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,
  status TEXT DEFAULT 'pending', -- pending, completed, snoozed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Qualification data
CREATE TABLE qualification_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  property_id UUID REFERENCES properties(id),

  -- Pricing (2 of 3)
  asking_price NUMERIC,
  noi NUMERIC,
  cap_rate NUMERIC,
  price_per_sf NUMERIC,

  -- Motivation
  motivation TEXT,
  timeline TEXT,
  seller_priorities TEXT,

  -- Docs
  has_operating_statements BOOLEAN DEFAULT FALSE,
  has_rent_roll BOOLEAN DEFAULT FALSE,

  -- Decision maker
  decision_maker_confirmed BOOLEAN DEFAULT FALSE,
  decision_maker_name TEXT,
  decision_maker_title TEXT,

  -- Status
  status TEXT DEFAULT 'new', -- new, engaging, qualified, docs_received, ready_to_package

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  packaged_at TIMESTAMPTZ
);

-- Email template variants (for A/B testing)
CREATE TABLE email_template_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES email_templates(id),
  variant_name TEXT NOT NULL, -- 'A', 'B', 'C'
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sends INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bounce list (permanent exclusion)
CREATE TABLE email_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL, -- 'bounce', 'hard_pass', 'spam_complaint'
  bounce_type TEXT, -- 'invalid', 'full_mailbox', 'blocked'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add fields to companies
ALTER TABLE companies ADD COLUMN has_broker BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN broker_contact TEXT;
ALTER TABLE companies ADD COLUMN qualification_status TEXT DEFAULT 'new';
ALTER TABLE companies ADD COLUMN lead_score NUMERIC;

-- Add fields to sequence_subscriptions
ALTER TABLE sequence_subscriptions ADD COLUMN emails_sent INTEGER DEFAULT 0;
ALTER TABLE sequence_subscriptions ADD COLUMN last_response_classification TEXT;
ALTER TABLE sequence_subscriptions ADD COLUMN awaiting_approval BOOLEAN DEFAULT TRUE;

-- Add fields to synced_emails for tracking
ALTER TABLE synced_emails ADD COLUMN classification TEXT;
ALTER TABLE synced_emails ADD COLUMN classification_confidence NUMERIC;
ALTER TABLE synced_emails ADD COLUMN extracted_pricing JSONB;
```
