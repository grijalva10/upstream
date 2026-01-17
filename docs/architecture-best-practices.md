# Upstream Sourcing Engine - Architecture & Best Practices

## System Overview

The Upstream Sourcing Engine is an AI-assisted Commercial Real Estate (CRE) deal origination system that automates the discovery of off-market properties, personalized outreach, response classification, and deal packaging.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UPSTREAM SOURCING ENGINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     PRESENTATION LAYER                                  │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │              Next.js Web Application (apps/web/)               │   │ │
│  │  │  ┌──────────┬──────────┬──────────┬──────────┬───────────┐   │   │ │
│  │  │  │Dashboard │  Inbox   │Campaigns │  Deals   │ Searches  │   │   │ │
│  │  │  │    /     │  /inbox  │/campaigns│  /deals  │ /searches │   │   │ │
│  │  │  └──────────┴──────────┴──────────┴──────────┴───────────┘   │   │ │
│  │  │  React 19 + Tailwind CSS 4 + Radix UI                         │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       AGENT LAYER (6 Agents)                           │ │
│  │                                                                        │ │
│  │   DISCOVERY              OUTREACH              QUALIFICATION           │ │
│  │  ┌─────────────┐      ┌─────────────┐      ┌─────────────────────┐   │ │
│  │  │  @sourcing  │─────▶│   @drip     │─────▶│ @response-classifier│   │ │
│  │  │   -agent    │      │  -campaign  │      │                     │   │ │
│  │  │             │      │   -exec     │      │   19 categories     │   │ │
│  │  │ Buyer→Query │      │ 3-email seq │      │   + confidence      │   │ │
│  │  └─────────────┘      └─────────────┘      └──────────┬──────────┘   │ │
│  │                                                       │               │ │
│  │                                                       ▼               │ │
│  │                  CONVERSION                        HANDOFF            │ │
│  │                 ┌─────────────┐               ┌─────────────┐        │ │
│  │                 │  @qualify   │◀──────────────│ @schedule   │        │ │
│  │                 │   -agent    │               │   -agent    │        │ │
│  │                 │             │               │             │        │ │
│  │                 │ SDR follow  │──────────────▶│ Call setup  │        │ │
│  │                 └──────┬──────┘               └─────────────┘        │ │
│  │                        │                                              │ │
│  │                        ▼                                              │ │
│  │                 ┌─────────────┐                                       │ │
│  │                 │   @deal     │                                       │ │
│  │                 │  -packager  │                                       │ │
│  │                 │             │                                       │ │
│  │                 │ Package +   │                                       │ │
│  │                 │ distribute  │                                       │ │
│  │                 └─────────────┘                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      INTEGRATION LAYER                                  │ │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌────────────────────┐   │ │
│  │  │    CoStar API    │  │  Outlook COM    │  │ Python Orchestrator│   │ │
│  │  │                  │  │                 │  │                    │   │ │
│  │  │ Property search  │  │ Send/receive    │  │ Send loop (30s)    │   │ │
│  │  │ 2FA required     │  │ emails          │  │ Response loop (5m) │   │ │
│  │  │ Local only       │  │ Calendar events │  │ pg-boss job queue  │   │ │
│  │  └──────────────────┘  └─────────────────┘  └────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                       DATA LAYER (Supabase)                            │ │
│  │  ┌────────────────────────────────────────────────────────────────┐   │ │
│  │  │              PostgreSQL (~30 tables)                           │   │ │
│  │  │  ┌─────────────┬─────────────┬─────────────┬──────────────┐   │   │ │
│  │  │  │   ENTITIES  │  SOURCING   │   OUTREACH  │ QUALIFICATION│   │   │ │
│  │  │  │ properties  │client_crit  │ sequences   │ qual_data    │   │   │ │
│  │  │  │ companies   │extract_list │ seq_steps   │ deal_packages│   │   │ │
│  │  │  │ contacts    │ markets     │ subscript.  │ tasks        │   │   │ │
│  │  │  │ prop_loans  │ strategies  │ email_drafts│ exclusions   │   │   │ │
│  │  │  └─────────────┴─────────────┴─────────────┴──────────────┘   │   │ │
│  │  │  + RLS (Row-Level Security) + Realtime Subscriptions          │   │ │
│  │  └────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Flow Diagram

```
STAGE 1: SOURCING                 STAGE 2: OUTREACH              STAGE 3: CLASSIFICATION
┌──────────────────────┐         ┌──────────────────────┐       ┌──────────────────────┐
│   Buyer Criteria     │         │    Email Campaign    │       │  Response Analysis   │
│   (Natural Language) │         │                      │       │                      │
│          │           │         │  ┌────────────────┐  │       │  19 Categories:      │
│          ▼           │         │  │ Email 1 (Day 0)│  │       │  ├─ hot_interested   │
│  ┌───────────────┐   │         │  │ Email 2 (Day 2)│  │       │  ├─ hot_pricing      │
│  │@sourcing-agent│   │         │  │ Email 3 (Day 4)│  │       │  ├─ hot_schedule     │
│  └───────┬───────┘   │         │  └────────────────┘  │       │  ├─ question         │
│          │           │         │          │           │       │  ├─ soft_pass        │
│          ▼           │         │          ▼           │       │  ├─ hard_pass        │
│  ┌───────────────┐   │  ───▶   │  ┌───────────────┐   │  ───▶ │  └─ bounce           │
│  │ CoStar Query  │   │         │  │Human Approval │   │       │          │           │
│  │   Payloads    │   │         │  └───────────────┘   │       │          ▼           │
│  └───────────────┘   │         │          │           │       │  ┌───────────────┐   │
│                      │         │          ▼           │       │  │@response-     │   │
│  Output:             │         │  ┌───────────────┐   │       │  │ classifier    │   │
│  • properties        │         │  │ Outlook Send  │   │       │  └───────────────┘   │
│  • companies         │         │  └───────────────┘   │       │                      │
│  • contacts          │         │                      │       │                      │
└──────────────────────┘         └──────────────────────┘       └──────────────────────┘
                                                                           │
           ┌───────────────────────────────────────────────────────────────┘
           │
           ▼
STAGE 4: QUALIFICATION            STAGE 5: SCHEDULING            STAGE 6: PACKAGING
┌──────────────────────┐         ┌──────────────────────┐       ┌──────────────────────┐
│   Lead Nurturing     │         │   Call Coordination  │       │   Deal Distribution  │
│                      │         │                      │       │                      │
│  Temperature:        │         │  ┌────────────────┐  │       │  Requirements:       │
│  ├─ Hot (23%)        │         │  │ Time Proposals │  │       │  ├─ 2/3 pricing      │
│  ├─ Warm (28%)       │────────▶│  │ Calendar Event │  │       │  ├─ Rent roll        │
│  └─ Lukewarm (3%)    │         │  │ Call Prep      │  │       │  ├─ Operating stmt   │
│                      │         │  └────────────────┘  │       │  └─ Decision maker   │
│  ┌───────────────┐   │         │          │           │       │          │           │
│  │ @qualify-agent│   │         │          ▼           │       │          ▼           │
│  └───────────────┘   │         │  ┌───────────────┐   │       │  ┌───────────────┐   │
│          │           │         │  │@schedule-agent│   │       │  │ @deal-packager│   │
│          ▼           │         │  └───────────────┘   │       │  └───────────────┘   │
│  • Answer questions  │         │                      │       │          │           │
│  • Track qual_data   │         │  Output:             │       │          ▼           │
│  • Generate drafts   │─────────│  • Outlook events    │──────▶│  • deal_packages     │
│                      │         │  • tasks (reminders) │       │  • client matching   │
│                      │         │  • call prep email   │       │  • notifications     │
└──────────────────────┘         └──────────────────────┘       └──────────────────────┘
```

---

## Database Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE ENTITIES                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐                           ┌────────────────┐            │
│  │   properties   │◄─────────────────────────▶│   companies    │            │
│  │                │     property_companies     │    (leads)     │            │
│  │ costar_id      │     (owner|manager|lender) │                │            │
│  │ address        │                           │ name           │            │
│  │ property_type  │                           │ status ────────┼─┐          │
│  │ size_sqft      │                           │ source         │ │          │
│  │ year_built     │                           │                │ │          │
│  │ class          │                           └───────┬────────┘ │          │
│  │ market_id      │                                   │          │          │
│  └───────┬────────┘                                   │          │          │
│          │                                            ▼          │          │
│          │                                   ┌────────────────┐  │          │
│          │                                   │    contacts    │  │          │
│          │                                   │                │  │          │
│          │                                   │ email (unique) │  │          │
│          │                                   │ phone          │  │          │
│          │                                   │ title          │  │          │
│          │                                   │ status         │  │          │
│          │                                   └────────────────┘  │          │
│          │                                                       │          │
│          ▼                                                       │          │
│  ┌────────────────┐                    Status Flow:              │          │
│  │ property_loans │                    ┌─────────────────────────┘          │
│  │                │                    ▼                                    │
│  │ lender_name    │         new → contacted → engaged → qualified           │
│  │ maturity_date  │                                      ↓                  │
│  │ ltv_current    │                                 handed_off              │
│  │ payment_status │                                      │                  │
│  └────────────────┘                              ┌───────┴───────┐          │
│                                                  ▼               ▼          │
│                                                 dnc          rejected       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SOURCING & OUTREACH                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐       │
│  │ client_criteria │────▶│ extraction_lists │────▶│ list_properties │       │
│  │                 │     │                  │     │                 │       │
│  │ criteria_json   │     │ query_name       │     │ property_id     │       │
│  │ queries_json    │     │ payload_json     │     │ extraction_id   │       │
│  │ strategy_summary│     │ property_count   │     └─────────────────┘       │
│  └─────────────────┘     └──────────────────┘                               │
│                                                                              │
│  ┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐       │
│  │    sequences    │────▶│  sequence_steps  │     │  seq_subscript  │       │
│  │                 │     │                  │     │                 │       │
│  │ name            │     │ step_order       │     │ contact_id      │       │
│  │ schedule        │     │ step_type        │     │ status          │◀──┐   │
│  │ stop_on_reply   │     │ delay_seconds    │     │ enrolled_at     │   │   │
│  └─────────────────┘     │ template_id      │     └─────────────────┘   │   │
│                          └──────────────────┘                           │   │
│                                                                         │   │
│  ┌─────────────────┐     ┌──────────────────┐                           │   │
│  │  email_drafts   │     │   activities     │───────────────────────────┘   │
│  │                 │     │                  │                               │
│  │ draft_from_agent│     │ type (sent|recv) │     Activity Types:           │
│  │ to_email        │     │ contact_id       │     • email_sent              │
│  │ subject, body   │     │ company_id       │     • email_received          │
│  │ status          │     │ property_id      │     • call                    │
│  └─────────────────┘     │ metadata_json    │     • note                    │
│                          └──────────────────┘     • task                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         QUALIFICATION & DEALS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐          ┌──────────────────────┐                 │
│  │  qualification_data  │─────────▶│    deal_packages     │                 │
│  │                      │          │                      │                 │
│  │ contact_id           │          │ property_id          │                 │
│  │ property_id          │          │ qualification_id     │                 │
│  │ status ──────────────┼──┐       │ package_json         │                 │
│  │                      │  │       │ matched_client_ids   │                 │
│  │ asking_price         │  │       │ packaged_at          │                 │
│  │ noi                  │  │       └──────────────────────┘                 │
│  │ cap_rate             │  │                                                │
│  │ motivation           │  │       Status Flow:                             │
│  │ timeline             │  │       ┌────────────────────────────────────┐   │
│  │ decision_maker_conf  │  └──────▶│ new → engaging → qualified         │   │
│  │ has_rent_roll        │          │           ↓                        │   │
│  │ has_operating_stmt   │          │     docs_received                  │   │
│  └──────────────────────┘          │           ↓                        │   │
│                                    │     ready_to_package               │   │
│  ┌──────────────────────┐          └────────────────────────────────────┘   │
│  │       tasks          │                                                   │
│  │                      │          ┌──────────────────────┐                 │
│  │ type (call_prep|     │          │  email_exclusions    │                 │
│  │      follow_up|      │          │                      │                 │
│  │      review)         │          │ email_text (unique)  │                 │
│  │ due_date             │          │ reason (bounce|      │                 │
│  │ contact_id           │          │        hard_pass|    │                 │
│  │ status               │          │        unsubscribed) │                 │
│  └──────────────────────┘          └──────────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### 1. Agent Design Principles

| Principle | Description | Example |
|-----------|-------------|---------|
| **Single Responsibility** | Each agent handles one domain | `@qualify-agent` only does SDR follow-ups, not scheduling |
| **Clear Contracts** | Define explicit inputs/outputs | Input: `synced_email_id`, Output: `classification + confidence` |
| **Confidence Thresholds** | Auto-execute only with high confidence | Classification requires ≥0.70 confidence |
| **Human Checkpoints** | Critical decisions require approval | All outbound emails go through approval queue |
| **Feedback Loops** | Learn from corrections | Store past agent corrections in prompts |

### 2. Database Best Practices

```sql
-- Use enums for constrained values (prevents invalid states)
CREATE TYPE company_status AS ENUM (
  'new', 'contacted', 'engaged', 'qualified',
  'handed_off', 'dnc', 'rejected'
);

-- Always use RLS for multi-tenant isolation
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own companies" ON companies
  FOR SELECT USING (assigned_user_id = auth.uid());

-- Index frequently queried columns
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_contacts_email ON contacts(email);

-- Use junction tables for many-to-many relationships
-- (property_companies, list_properties, search_properties)
```

**Critical Rules:**
- **NEVER reset database** without backup + explicit permission
- Use migrations for all schema changes (`supabase db diff`)
- Prefer soft deletes (status changes) over hard deletes
- Track all state changes with timestamps

### 3. Email Outreach Best Practices

| Practice | Rationale |
|----------|-----------|
| **3-email maximum** per sequence | Higher volume = spam flags |
| **9am-4pm recipient local time** | Respect business hours |
| **Business days only** | No weekend sends |
| **Random jitter (0-30 min)** | Avoid pattern detection |
| **Stop on reply** | Prevents follow-up spam |
| **No signature in drafts** | Outlook auto-adds signature |
| **Approval queue for all sends** | Brand/compliance review |

**Rate Limits:**
- 10,000 emails/day maximum
- 1,000 emails/hour maximum
- 0.2 second delay between CoStar API calls

### 4. Classification Best Practices

```
CLASSIFICATION HIERARCHY (19 categories)

HOT (Immediate Action Required)
├── hot_interested    → Route to @qualify-agent
├── hot_pricing       → Extract pricing, route to @qualify-agent
├── hot_schedule      → Route to @schedule-agent
└── hot_confirm       → Confirm details, close

QUALIFICATION (Continue Engagement)
├── question          → Answer, continue qualifying
├── info_request      → Provide info, continue
├── doc_promised      → Create task, track
├── doc_received      → Extract, advance
└── referral          → Create new contact, route

ROUTING
├── broker            → Log broker, do not pursue
├── wrong_contact     → Find correct contact
└── buyer_inquiry     → Route to sales team

COLD (End Sequence)
├── soft_pass         → Add to nurture (re-engage later)
├── hard_pass         → Add to DNC forever
├── bounce            → Add to exclusions forever
└── unclear           → Human review required
```

### 5. Integration Best Practices

**CoStar API:**
```python
# Always use rate limiting
time.sleep(0.2)  # Between requests

# Retry with exponential backoff
for attempt in range(3):
    try:
        response = costar_client.query(payload)
        break
    except RateLimitError:
        time.sleep(2 ** attempt)

# Validate payloads against known-working example
# Reference: reference/costar/payload-example.json
```

**Outlook COM:**
```python
# Check availability before scheduling
available_slots = outlook.get_free_busy(
    start=datetime.now(),
    end=datetime.now() + timedelta(days=7)
)

# Respect recipient timezone
send_time = convert_to_recipient_tz(
    desired_time,
    recipient_timezone
)
```

### 6. Pipeline Architecture Best Practices

| Stage | Autonomy | Approval Required |
|-------|----------|-------------------|
| Sourcing | Full | No |
| Extraction | Partial | 2FA always required |
| Campaign Draft | Partial | Email content review |
| Classification | Full | No (confidence threshold) |
| Qualification | Partial | Follow-up email review |
| Scheduling | Partial | Calendar event review |
| Deal Packaging | Full | No |

**Checkpoint System:**
```json
{
  "sourcing": "auto",      // Full autonomy
  "extraction": "plan",    // Always manual (2FA)
  "campaign": "plan",      // Starts manual, can enable auto
  "classification": "auto" // Always autonomous
}
```

### 7. Error Handling Best Practices

```typescript
// Always wrap agent calls in try-catch
try {
  const result = await agent.execute(input);
  if (result.confidence < 0.70) {
    // Flag for human review
    await createReviewTask(result);
  }
} catch (error) {
  // Log and create retry task
  await logAgentError(error);
  await createRetryTask(input);
}

// Idempotent operations (safe to retry)
async function processEmail(emailId: string) {
  const existing = await db.synced_emails
    .select()
    .eq('message_id', emailId)
    .single();

  if (existing?.classification) {
    return existing; // Already processed
  }
  // Process...
}
```

### 8. Security Best Practices

| Practice | Implementation |
|----------|----------------|
| **RLS everywhere** | All tables have row-level security policies |
| **Service role only for admin** | Never expose service role to client |
| **Validate all inputs** | Zod schemas for all API inputs |
| **Sanitize email content** | Prevent XSS in email body display |
| **Never store CoStar credentials** | Session-based auth with 2FA |
| **Audit logging** | `activities` table tracks all actions |

### 9. Performance Best Practices

```typescript
// Use database indexes for common queries
// Properties by market
CREATE INDEX idx_properties_market ON properties(market_id);

// Contacts by email (unique lookups)
CREATE INDEX idx_contacts_email ON contacts(email);

// Subscriptions by status (active sequences)
CREATE INDEX idx_subscriptions_status ON sequence_subscriptions(status)
  WHERE status = 'active';

// Use pagination for large result sets
const results = await db.properties
  .select()
  .range(offset, offset + limit);

// Cache frequently accessed reference data
const markets = await redis.get('markets')
  ?? await db.markets.select();
```

### 10. Testing Best Practices

```typescript
// Test each agent independently
describe('@sourcing-agent', () => {
  it('generates valid CoStar payloads', async () => {
    const result = await sourcingAgent.execute({
      criteria: mockBuyerCriteria
    });

    expect(result.payloads).toHaveLength(
      expect.greaterThan(0)
    );
    expect(result.payloads[0]).toMatchSchema(
      CoStarPayloadSchema
    );
  });
});

// Test pipeline integration
describe('Pipeline Integration', () => {
  it('flows from sourcing to classification', async () => {
    // Create search → run extraction → send email
    // → simulate reply → verify classification
  });
});
```

---

## Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | Next.js 16 + React 19 | Web application |
| **UI Components** | Radix UI + Tailwind CSS 4 | Design system |
| **Database** | Supabase PostgreSQL | Data persistence + Realtime |
| **AI Agents** | Claude (Sonnet) | Specialized task automation |
| **Job Queue** | pg-boss | Async task processing |
| **Email** | Outlook COM (local) | Send/receive/calendar |
| **Data Source** | CoStar API (local) | Property database |
| **Orchestration** | Python | Send/response polling loops |

---

## Local Development Requirements

**Must run on operator's machine:**
1. **CoStar Service** - Requires 2FA via mobile phone
2. **Outlook COM** - Windows only, requires Microsoft Outlook desktop
3. **Supabase Local** - PostgreSQL + Studio + Realtime

**Commands:**
```bash
# Start Supabase
npx supabase start

# Database operations
npx supabase db reset       # Reset and re-seed
npx supabase db diff        # Generate migration

# Direct DB access
psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
```

---

## Key Architectural Decisions

| Decision | Rationale | Tradeoff |
|----------|-----------|----------|
| **6 specialized agents** | Clear responsibilities, parallel development | More coordination overhead |
| **Seller motivation > criteria** | Off-market deals come from motivated sellers | May generate false positives |
| **Email approval queue** | Brand/compliance control | Adds human bottleneck |
| **Supabase Realtime** | Instant response to new emails | WebSocket complexity |
| **Local CoStar/Outlook** | 2FA security, desktop integration | Can't fully cloud deploy |
| **Enum types for status** | Database-level constraint enforcement | Schema migration for changes |
