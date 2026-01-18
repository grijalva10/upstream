# Campaign State Machine

Complete flow from campaign creation through deal handoff.

> **Note:** The qualification phase (call scheduling, deal packaging) is currently manual. The flow below shows what's automated vs. manual.

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
                    │  process-replies job (5 categories)       │
                    └───────────────────┬───────────────────────┘
                                        │
        ┌─────────────────┬─────────────┼─────────────┬─────────────┐
        ▼                 ▼             ▼             ▼             ▼
       hot            question        pass         bounce        other
        │                 │             │             │             │
        │                 │             │             ▼             │
        │                 │             │        ┌─────────┐        │
        │                 │             │        │EXCLUSION│        │
        │                 │             │        │ forever │        │
        │                 │             │        │contact  │        │
        │                 │             │        │bounced  │        │
        │                 │             │        └─────────┘        │
        │                 │             │                           │
        │                 │             ├──► DNC (if requested)     │
        │                 │             └──► nurture (soft pass)    │
        │                 │                                         │
        │                 │                                  [logged only]
        │                 │                                   (OOO, etc)
        │                 │
        └────────┬────────┘
                 ▼
        ┌────────────────────┐
        │   email_drafts     │
        │  (for human review)│
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │  HUMAN APPROVES    │
        │  (/approvals UI)   │
        └────────┬───────────┘
                 │
                 ▼
        ┌────────────────────┐
        │   MANUAL PROCESS   │
        │  (qualification,   │
        │   call scheduling, │
        │   deal packaging)  │
        └────────────────────┘


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

| Trigger | Classification | Automated Action | Manual Follow-up |
|---------|---------------|------------------|------------------|
| Reply received | `hot` | Create email_draft for review | Human reviews, qualifies |
| Reply received | `question` | Create email_draft for review | Human answers |
| Reply received | `pass` (DNC) | Add to dnc_entries | None |
| Reply received | `pass` (soft) | Update company→nurture | Re-engage later |
| Reply received | `bounce` | Add to email_exclusions, contact→bounced | None |
| Reply received | `other` | Log only | Review if needed |
| Draft approved | - | process-queue → send-email | - |
| Hot lead | - | - | Human qualifies, schedules call |
| Qualified | - | - | Human creates deal package |

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

## Agent & Job Responsibilities

### Active Agents
| Agent | Trigger | Input | Output |
|-------|---------|-------|--------|
| `@sourcing-agent` | New search/criteria | Buyer requirements | CoStar query payloads |
| `@outreach-copy-gen` | Campaign created | contact + property + buyer | 3-email sequence |

### Worker Jobs
| Job | Schedule | Input | Output |
|-----|----------|-------|--------|
| `email-sync` | Every 5 min | Outlook | synced_emails |
| `process-replies` | Every 2 min | synced_emails | classification + actions |
| `process-queue` | Every 1 min | email_queue | send-email jobs |
| `send-email` | On demand | email data | Outlook send + activity |
| `auto-follow-up` | Daily 9 AM | pending docs | email_queue |
| `ghost-detection` | Daily 9:30 AM | unresponsive contacts | status updates |

### Manual Processes (Not Yet Automated)
| Process | Current State |
|---------|---------------|
| Qualification tracking | Human updates deals table |
| Call scheduling | Human uses calendar directly |
| Deal packaging | Human creates packages manually |
