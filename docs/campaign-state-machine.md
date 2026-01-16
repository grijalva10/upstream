# Campaign State Machine

Complete flow from campaign creation through deal packaging.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CAMPAIGN STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

CAMPAIGN STATUS
═══════════════
    draft ──► active ──► paused ──► active ──► completed
      │         │                     │
      │         └─────────────────────┘
      │
      └──► [enroll contacts] ──► [generate copy via outreach-copy-gen]


ENROLLMENT (per contact)
════════════════════════

                    ┌─────────────────────────────────────────┐
                    │           DRIP SEQUENCE                 │
                    │  step 1 ──► step 2 ──► step 3 ──► done  │
                    │  (day 0)   (day 3)   (day 7)            │
                    └───────────────┬─────────────────────────┘
                                    │
                            [reply received]
                                    │
                                    ▼
                    ┌───────────────────────────────────────────┐
                    │         RESPONSE CLASSIFIER               │
                    └───────────────────┬───────────────────────┘
                                        │
        ┌───────────┬───────────┬───────┼───────┬───────────┬───────────┐
        ▼           ▼           ▼       ▼       ▼           ▼           ▼
    interested  pricing_given question  ooo   soft_pass  referral    bounce
        │           │           │       │       │           │           │
        │           │           │       │       │           │           ▼
        │           │           │       │       │           │      ┌─────────┐
        │           │           │       │       │           │      │EXCLUSION│
        │           │           │       │       │           │      │ forever │
        │           │           │       │       │           │      └─────────┘
        │           │           │       │       │           │
        │           │           │       │       │           ▼
        │           │           │       │       │      ┌──────────┐
        │           │           │       │       │      │ NEW      │
        │           │           │       │       │      │ CONTACT  │
        │           │           │       │       │      │ restart  │
        │           │           │       │       │      └──────────┘
        │           │           │       │       │
        │           │           │       │       ▼
        │           │           │       │   ┌────────┐
        │           │           │       │   │NURTURE │
        │           │           │       │   │sequence│
        │           │           │       │   └────────┘
        │           │           │       │
        │           │           │       ▼
        │           │           │   ┌─────────┐
        │           │           │   │  WAIT   │
        │           │           │   │ + task  │
        │           │           │   │ to call │
        │           │           │   └─────────┘
        │           │           │
        └───────────┴───────────┴───────────┐
                                            ▼
                              ┌──────────────────────────┐
                              │     QUALIFY-AGENT        │
                              │  (answer Qs, gather info)│
                              └────────────┬─────────────┘
                                           │
                          [call request detected]
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │     SCHEDULE-AGENT       │
                              │  (propose times, book)   │
                              └────────────┬─────────────┘
                                           │
                                   [call happens]
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │   QUALIFICATION DATA     │
                              │ new→engaging→qualified   │
                              │ →docs_received           │
                              │ →ready_to_package        │
                              └────────────┬─────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │     DEAL-PACKAGER        │
                              │  (create deal summary)   │
                              └────────────┬─────────────┘
                                           │
                                           ▼
                              ┌──────────────────────────┐
                              │      DEAL PACKAGE        │
                              │ draft→ready→handed_off   │
                              └──────────────────────────┘


COMPANY STATUS (parallel track)
═══════════════════════════════

  new ──► contacted ──► engaged ──► qualified ──► handed_off
   │          │            │            │              │
   │          │            │            │              └──► [deal done]
   │          │            │            │
   │          │            │            └──► [ready to package]
   │          │            │
   │          │            └──► [reply: interested/pricing_given]
   │          │
   │          └──► [first email sent]
   │
   └──► [created from CoStar extract]

            ──► dnc (hard_pass response)
            ──► rejected (not a fit)


CONTACT STATUS
══════════════

  active ──► dnc (hard_pass)
         ──► bounced (bounce)
         ──► unsubscribed (request)


ENROLLMENT STATUS
═════════════════

  pending ──► active ──► replied (got response)
                     ──► completed (all 3 sent, no reply)
                     ──► stopped (dnc/bounce/manual)
```

## Key Flows

| Trigger | Classification | Action | Next State |
|---------|---------------|--------|------------|
| Reply received | `interested` | qualify-agent | company→engaged |
| Reply received | `pricing_given` | extract $, qualify-agent | company→engaged |
| Reply received | `question` | answer, qualify-agent | company→engaged |
| Reply received | `ooo` | create task, wait | enrollment paused |
| Reply received | `soft_pass` | nurture sequence | company stays |
| Reply received | `referral` | create new contact | restart outreach |
| Reply received | `bounce` | exclusion forever | contact→bounced |
| Reply received | `hard_pass` | DNC forever | contact→dnc |
| Call scheduled | - | schedule-agent | qualification begins |
| Qualified | - | deal-packager | deal_package created |

## Status Values Reference

### Campaign Status
- `draft` - Being configured, not yet sending
- `active` - Actively sending emails
- `paused` - Temporarily stopped
- `completed` - All enrollments finished

### Enrollment Status
- `pending` - Enrolled but not yet started
- `active` - Currently in drip sequence
- `replied` - Got a response
- `completed` - All emails sent, no reply
- `stopped` - Manually stopped or auto-stopped (dnc/bounce)

### Company Status
- `new` - Just extracted from CoStar
- `contacted` - First email sent
- `engaged` - Got a positive response
- `qualified` - Call completed, deal viable
- `handed_off` - Deal packaged and delivered
- `dnc` - Do not contact
- `rejected` - Not a fit

### Contact Status
- `active` - Can be contacted
- `dnc` - Do not contact (requested)
- `bounced` - Email doesn't work
- `unsubscribed` - Opted out

### Qualification Data Status
- `new` - Just started
- `engaging` - In conversation
- `qualified` - Has pricing/motivation/authority
- `docs_received` - Got supporting docs
- `ready_to_package` - Ready for deal-packager

### Deal Package Status
- `draft` - Being created
- `ready` - Ready for handoff
- `handed_off` - Delivered to buyer
- `rejected` - Buyer passed

## Agent Responsibilities

| Agent | Trigger | Input | Output |
|-------|---------|-------|--------|
| `outreach-copy-gen` | Campaign created | contact + property + buyer | 3 email sequence |
| `drip-campaign-exec` | Campaign active | email drafts | sends via Outlook |
| `response-classifier` | Reply received | email content | classification + extracted data |
| `qualify-agent` | interested/pricing/question | classification | follow-up email, gather info |
| `schedule-agent` | call request detected | conversation context | calendar invite |
| `deal-packager` | ready_to_package | qualification data | deal summary PDF |
