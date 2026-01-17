# Upstream CRE Pipeline: Process Flow & Best Practices

## Executive Summary

The Upstream Sourcing Engine is an AI-driven pipeline that transforms buyer criteria into qualified CRE deal flow. Six specialized agents work together to automate prospect identification, personalized outreach, response handling, and deal packaging—while maintaining human oversight at critical decision points.

---

## Process Flow Diagram

### High-Level Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UPSTREAM CRE PIPELINE                                │
└─────────────────────────────────────────────────────────────────────────────┘

  BUYER CRITERIA                                                 DEAL PACKAGES
       │                                                              ▲
       ▼                                                              │
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   STAGE 1    │───▶│   STAGE 2    │───▶│   STAGE 3    │───▶│   STAGE 4    │
│   SOURCING   │    │   OUTREACH   │    │ QUALIFICATION│    │  PACKAGING   │
│              │    │              │    │              │    │              │
│ sourcing-    │    │ drip-        │    │ response-    │    │ deal-        │
│ agent        │    │ campaign-    │    │ classifier   │    │ packager     │
│              │    │ exec         │    │ qualify-     │    │              │
│              │    │              │    │ agent        │    │              │
│              │    │              │    │ schedule-    │    │              │
│              │    │              │    │ agent        │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │                   │
       ▼                   ▼                   ▼                   ▼
   CoStar API         Outlook COM          Email Sync         Client Match
   Extraction          Sending             Processing         & Notify
```

---

### Detailed Agent Flow

```
                                    ┌─────────────────────┐
                                    │   BUYER CRITERIA    │
                                    │  (Natural Language) │
                                    └──────────┬──────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │        SOURCING-AGENT          │
                              │  • Parse buyer requirements    │
                              │  • Generate CoStar payloads    │
                              │  • Apply motivation filters    │
                              └────────────────┬───────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │     COSTAR EXTRACTION          │
                              │  • Run queries (local 2FA)     │
                              │  • Extract properties          │
                              │  • Scrape owner contacts       │
                              └────────────────┬───────────────┘
                                               │
                                               ▼
                    ┌──────────────────────────────────────────────────┐
                    │                  extraction_lists                 │
                    │  properties → companies → contacts                │
                    └──────────────────────────┬───────────────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │      DRIP-CAMPAIGN-EXEC        │
                              │  • Create 3-email sequences    │
                              │  • Personalize with merge tags │
                              │  • Schedule in send windows    │
                              └────────────────┬───────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │       APPROVAL QUEUE           │
                              │  [Human reviews & approves]    │
                              └────────────────┬───────────────┘
                                               │
                                               ▼
                              ┌────────────────────────────────┐
                              │      OUTLOOK COM SEND          │
                              │  • Send approved emails        │
                              │  • Log activities              │
                              └────────────────┬───────────────┘
                                               │
                           ┌───────────────────┴───────────────┐
                           │                                   │
                     [No Reply]                          [Reply Received]
                           │                                   │
                           ▼                                   ▼
                    ┌──────────────┐              ┌────────────────────────┐
                    │ Continue     │              │    OUTLOOK SYNC        │
                    │ Sequence     │              │  • Sync inbound emails │
                    │ (Email 2, 3) │              │  • Match to contacts   │
                    └──────────────┘              └───────────┬────────────┘
                                                              │
                                                              ▼
                              ┌────────────────────────────────────────────┐
                              │          RESPONSE-CLASSIFIER               │
                              │  • Classify into 8+ categories             │
                              │  • Extract pricing/data                    │
                              │  • Assign confidence score                 │
                              └────────────────────┬───────────────────────┘
                                                   │
              ┌─────────────────┬─────────────────┼─────────────────┬─────────────────┐
              │                 │                 │                 │                 │
              ▼                 ▼                 ▼                 ▼                 ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
        │interested│     │ pricing  │     │ question │     │soft_pass │     │hard_pass │
        │          │     │ _given   │     │          │     │          │     │ /bounce  │
        └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
             │                │                │                │                │
             └────────────────┴────────────────┤                │                │
                                               │                │                │
                                               ▼                ▼                ▼
                              ┌────────────────────────┐  ┌──────────┐    ┌──────────┐
                              │     QUALIFY-AGENT      │  │ Nurture  │    │   DNC    │
                              │  • Answer questions    │  │ Task     │    │  List    │
                              │  • Gather pricing/NOI  │  │ (90 days)│    │          │
                              │  • Request motivation  │  └──────────┘    └──────────┘
                              │  • Push toward call    │
                              └───────────┬────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         │                                 │
                   [Call Request]                    [Email Loop]
                         │                                 │
                         ▼                                 │
              ┌────────────────────────┐                   │
              │    SCHEDULE-AGENT      │                   │
              │  • Propose 3 time slots│                   │
              │  • Create calendar evt │                   │
              │  • Generate call prep  │                   │
              └───────────┬────────────┘                   │
                          │                                │
                          ▼                                │
              ┌────────────────────────┐                   │
              │   CALL CONDUCTED       │                   │
              │  [Human conversation]  │◄──────────────────┘
              └───────────┬────────────┘
                          │
                          ▼
              ┌────────────────────────────────────────────┐
              │              QUALIFICATION CHECK           │
              │  ✓ 2 of 3 pricing (ask/NOI/cap)           │
              │  ✓ Motivation & timeline                  │
              │  ✓ Decision maker confirmed               │
              └───────────────────┬────────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────────┐
              │            DEAL-PACKAGER                   │
              │  • Synthesize all qualification data       │
              │  • Generate deal thesis                    │
              │  • Create package JSON                     │
              │  • Match to active clients                 │
              │  • Queue notification emails               │
              └───────────────────┬────────────────────────┘
                                  │
                                  ▼
              ┌────────────────────────────────────────────┐
              │            DEAL PACKAGE                    │
              │  Ready for client distribution             │
              └────────────────────────────────────────────┘
```

---

### Response Classification Branching

```
                         ┌──────────────────┐
                         │  Inbound Email   │
                         └────────┬─────────┘
                                  │
                                  ▼
                    ┌─────────────────────────────┐
                    │    Pre-Classification       │
                    │    Checks                   │
                    └─────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
   ┌──────────┐            ┌──────────┐            ┌──────────┐
   │  Bounce  │            │   DNC    │            │  Valid   │
   │  Check   │            │  Check   │            │ Response │
   └────┬─────┘            └────┬─────┘            └────┬─────┘
        │                       │                       │
        ▼                       ▼                       ▼
   ┌──────────┐            ┌──────────┐      ┌──────────────────────┐
   │ Add to   │            │  Stop    │      │   CLASSIFY           │
   │exclusions│            │ (logged) │      │                      │
   └──────────┘            └──────────┘      └───────────┬──────────┘
                                                         │
    ┌──────────────────┬──────────────────┬──────────────┼──────────────┬─────────────────┐
    │                  │                  │              │              │                 │
    ▼                  ▼                  ▼              ▼              ▼                 ▼
┌─────────┐      ┌─────────┐      ┌─────────┐    ┌─────────┐    ┌─────────┐      ┌─────────┐
│  HOT    │      │ QUESTION│      │REFERRAL │    │ BROKER  │    │  SOFT   │      │  HARD   │
│interested│     │         │      │         │    │REDIRECT │    │  PASS   │      │  PASS   │
│pricing  │      │         │      │         │    │         │    │         │      │         │
│schedule │      │         │      │         │    │         │    │         │      │         │
└────┬────┘      └────┬────┘      └────┬────┘    └────┬────┘    └────┬────┘      └────┬────┘
     │                │                │              │              │                 │
     ▼                ▼                ▼              ▼              ▼                 ▼
 QUALIFY          QUALIFY         CREATE NEW      LOG BROKER     NURTURE           ADD TO
  AGENT            AGENT           CONTACT         (DO NOT       TASK               DNC
 (continue)       (answer)        (new outreach)   PURSUE)      (90 days)         (forever)
```

---

### Qualification State Machine

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                  QUALIFICATION JOURNEY                       │
                    └─────────────────────────────────────────────────────────────┘

    ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐        ┌─────────┐
    │   NEW   │───────▶│ENGAGING │───────▶│QUALIFIED│───────▶│  DOCS   │───────▶│ READY   │
    │         │        │         │        │         │        │RECEIVED │        │TO PACK  │
    └─────────┘        └─────────┘        └─────────┘        └─────────┘        └─────────┘
         │                  │                  │                  │                  │
         │                  │                  │                  │                  │
         ▼                  ▼                  ▼                  ▼                  ▼
    Contact           Email loop         2 of 3 pricing     Rent roll/T12      deal-packager
    enrolled          with owner         + motivation       received           runs
    in sequence       (qualify-agent)    confirmed

    REQUIRED DATA:
    ┌────────────────────────────────────────────────────────────────────────────────────┐
    │ □ asking_price  □ NOI  □ cap_rate  (need 2 of 3)                                   │
    │ □ motivation (why selling)                                                          │
    │ □ timeline (urgency)                                                               │
    │ □ decision_maker_confirmed                                                          │
    │ □ documents (rent_roll, operating_statements) [optional but preferred]             │
    └────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Company Status Flow

```
    ┌─────────────────────────────────────────────────────────────────────────────┐
    │                         COMPANY (LEAD) LIFECYCLE                            │
    └─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │   NEW    │
                              │(imported)│
                              └────┬─────┘
                                   │
                                   ▼
                              ┌──────────┐
                              │CONTACTED │
                              │(email 1) │
                              └────┬─────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
        ┌──────────┐        ┌──────────┐        ┌──────────┐
        │ ENGAGED  │        │ NURTURE  │        │   DNC    │
        │(replied) │        │(soft pass│        │(hard pass│
        └────┬─────┘        │ 90 days) │        │ forever) │
             │              └──────────┘        └──────────┘
             │
             ▼
        ┌──────────┐
        │QUALIFIED │
        │(all data)│
        └────┬─────┘
             │
             ▼
        ┌──────────┐
        │HANDED OFF│
        │(to client)│
        └──────────┘
```

---

## Best Practices by Stage

### Stage 1: Sourcing (sourcing-agent)

| Category | Best Practice |
|----------|---------------|
| **Query Strategy** | Generate 3-5 layered queries, not 1 or 20. Each targets a different motivation signal. |
| **Motivation First** | Prioritize seller motivation over criteria matching. A motivated seller slightly outside specs beats a perfect-fit unmotivated owner. |
| **Targeting Signals** | Focus on: long hold period (10+ years), loan maturity, owner-occupied, out-of-state owners, estate/trust ownership. |
| **Validation** | Always run a sample extraction to validate volume. Target 45-150 properties per query. |
| **Iteration** | If results too narrow (<20 contacts), loosen filters. If too broad (>500), add constraints. |
| **Off-Market Only** | Always use `ListingType: 0` to exclude listed properties. |

### Stage 2: Outreach (drip-campaign-exec)

| Category | Best Practice |
|----------|---------------|
| **Send Windows** | 9 AM - 4 PM recipient local time, business days only. |
| **Staggering** | Add 0-30 minute random jitter between sends. Never batch-send. |
| **Sequence Length** | 3 emails maximum: Day 0, Day 1-3, Day 3-5. |
| **Personalization** | Use merge tags: `[Owner First Name]`, `[address]`, `[property_type]`, `[size_display]`, `[buyer_type]`. |
| **Auto-Stop** | Immediately halt sequence when any reply is received. |
| **Approval Flow** | All emails require approval initially (`awaiting_approval = true`). |
| **Tracking** | Track `emails_sent` (0-3) per subscription for sequence position. |

### Stage 3: Response Classification (response-classifier)

| Category | Best Practice |
|----------|---------------|
| **Confidence Thresholds** | ≥0.85: Auto-action. 0.70-0.84: Auto but monitor. <0.70: Human review required. |
| **Data Extraction** | Always extract pricing data from `pricing_given` responses (ask, NOI, cap rate). |
| **Sentiment Analysis** | Track sentiment (positive/negative/neutral) alongside classification. |
| **Bounce Handling** | Add bounced emails to permanent `email_exclusions` list. |
| **DNC Handling** | Add hard passes to `dnc_entries` permanently. |
| **Referral Tracking** | When referral detected, create new contact and initiate fresh outreach. |

### Stage 4: Qualification (qualify-agent)

| Category | Best Practice |
|----------|---------------|
| **Role Clarity** | SDR role only—answer questions, gather info, schedule calls. Never negotiate or make offers. |
| **Email Length** | Keep under 75 words. Be direct and helpful. |
| **Pricing Goal** | Get 2 of 3: asking price, NOI, cap rate. |
| **Motivation Goal** | Understand why selling and timeline/urgency. |
| **Decision Maker** | Confirm you're speaking with the actual decision maker. |
| **Escalation Trigger** | Push for call after 2+ email exchanges without progress or 5+ days stalled. |
| **Tone** | Helpful and direct. No salesy language or over-the-top friendliness. |
| **Flagging** | Flag for human review: pricing data received, broker involvement, geographic mismatches. |

### Stage 5: Scheduling (schedule-agent)

| Category | Best Practice |
|----------|---------------|
| **Time Slots** | Propose exactly 3 options across 2 days, at least 2 hours apart. |
| **Business Hours** | 9 AM - 5 PM Pacific Time, weekdays only. |
| **Call Prep** | Send prep email 30 minutes before scheduled call. |
| **Prep Content** | Include: what's known (pricing, motivation), conversation history, missing info to collect, decision maker status. |
| **Deferred Calls** | Parse natural language timeframes accurately ("call me in a month" → +30 days). |
| **Call Goals** | Target 15-minute calls to get: all 3 pricing metrics, motivation, timeline, decision maker confirmation, promise of docs. |

### Stage 6: Deal Packaging (deal-packager)

| Category | Best Practice |
|----------|---------------|
| **Qualification Gate** | Only package when: 2 of 3 pricing confirmed, motivation understood, decision maker identified. |
| **Deal Thesis** | 3-4 sentences synthesizing motivation, timeline, and value drivers. Be factual, not promotional. |
| **Direct Quotes** | Include seller quotes when available to build authenticity. |
| **Matching Logic** | Match on: property type, size range, price range, market. |
| **Progressive Disclosure** | Different detail levels per stage: Teaser → CA-required → LOI-level. |
| **Package JSON** | Include: property details, financials, seller info, deal thesis, conversation summary, documents available. |

---

## Approval Queue Best Practices

| Category | Best Practice |
|----------|---------------|
| **Initial Phase** | Start with 100% approval required (training wheels mode). |
| **Review Cadence** | Review pending emails at least 2x daily during active campaigns. |
| **Edit Carefully** | Edits should refine tone, not change substance. Trust agent judgment on strategy. |
| **Rejection Notes** | When rejecting, add clear notes explaining why for agent learning. |
| **Batch Approval** | Once confident in agent output, approve similar emails in batches. |
| **Autopilot Path** | Progress: Training → Drafts Approved → Auto-Send with Review → Full Autopilot. |

---

## Data Integrity Best Practices

| Category | Best Practice |
|----------|---------------|
| **Backup First** | Always backup before database resets: `pg_dump postgresql://...` |
| **Status Transitions** | Follow defined status flows. Don't skip states. |
| **Duplicate Prevention** | Check for existing contacts before creating new ones from referrals. |
| **DNC Respect** | Never contact anyone in `dnc_entries` or `email_exclusions`. |
| **Activity Logging** | Log all touchpoints (emails sent/received, calls, notes) to `activities` table. |
| **Sync State** | Maintain `email_sync_state` cursor for reliable Outlook sync. |

---

## Error Handling Best Practices

| Category | Best Practice |
|----------|---------------|
| **Classification Uncertainty** | Low confidence (<0.70) → Human review task, not auto-action. |
| **Extraction Failures** | Log failure, don't retry without checking 2FA status. |
| **Send Failures** | Retry with exponential backoff (2s, 4s, 8s, 16s), max 4 attempts. |
| **Sync Failures** | Resume from last known cursor, don't re-process already-synced emails. |
| **Missing Data** | Flag incomplete records for review rather than proceeding with gaps. |

---

## Performance Metrics to Track

| Metric | Target | Purpose |
|--------|--------|---------|
| Response Rate | >5% | Measure outreach effectiveness |
| Positive Response Rate | >2% | Quality of targeting |
| Time to Qualification | <14 days | Pipeline velocity |
| Emails to Call | <4 | Efficiency of qualification |
| Call to Package | >50% | Call effectiveness |
| Classification Accuracy | >90% | Agent reliability |
| Approval Override Rate | <10% | Agent alignment with strategy |

---

## Security & Compliance

| Area | Best Practice |
|------|---------------|
| **DNC Compliance** | Check DNC list before every send. Honor opt-outs immediately. |
| **Data Retention** | Follow data retention policies for synced emails and PII. |
| **Access Control** | CoStar extraction requires 2FA—cannot be automated. |
| **Audit Trail** | Log all agent executions with prompt, response, tokens used. |
| **Credential Security** | Never store CoStar credentials in code. Use environment variables. |

---

## Quick Reference: Agent Triggers

| Agent | Triggered By |
|-------|--------------|
| `sourcing-agent` | New search created, "Run Agent" clicked |
| `drip-campaign-exec` | Extraction complete, "Create Campaign" action |
| `response-classifier` | New email synced from Outlook |
| `qualify-agent` | Classification = interested, pricing_given, question |
| `schedule-agent` | Call request detected in response |
| `deal-packager` | `qualification_data.status = 'qualified'` |

---

## Quick Reference: Database Tables by Stage

| Stage | Primary Tables |
|-------|----------------|
| Sourcing | `searches`, `search_properties`, `properties`, `companies`, `contacts` |
| Outreach | `sequences`, `sequence_subscriptions`, `email_templates`, `activities` |
| Classification | `synced_emails`, `email_sync_state` |
| Qualification | `qualification_data`, `email_drafts`, `tasks` |
| Scheduling | `tasks`, calendar events (Outlook) |
| Packaging | `deal_packages`, `email_drafts` (notifications) |
