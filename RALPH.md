# RALPH.md - Upstream Build Specification

This document provides everything Ralph needs to complete the Upstream sourcing engine.

**Completion Promise:** `UPSTREAM_COMPLETE`

---

## Critical: Use Specialized Subagents

**ALWAYS prefer spawning specialized subagents over doing work directly.**

When creating or updating agents/prompts, use these specialist agents:

| Task | Use This Agent |
|------|----------------|
| Creating new agents | `.claude/agents/agent-expert.md` |
| Updating agent definitions | `.claude/agents/agent-expert.md` |
| Writing prompts | `.claude/agents/prompt-engineer.md` |
| Refining prompt templates | `.claude/agents/prompt-engineer.md` |

### How to Use

**To create/update an agent:**
```
Spawn agent-expert with task:
"Create the qualify-agent at .claude/agents/qualify-agent.md with the following capabilities: [spec from RALPH.md Phase 3]"
```

**To write/refine prompts:**
```
Spawn prompt-engineer with task:
"Write the email templates for the qualify-agent response playbook: [spec from RALPH.md Phase 3]"
```

### Why This Matters
- Agent-expert knows best practices for agent definitions
- Prompt-engineer knows how to craft effective prompts
- Specialized agents produce better output than general attempts
- This mirrors the Upstream philosophy: use the right tool for the job

### Creating New Specialized Subagents

**If you identify a need for a specialized agent that doesn't exist, CREATE IT.**

```
1. Spawn agent-expert:
   "Create a new specialized agent at .claude/agents/[agent-name].md
   Purpose: [what it does]
   Capabilities: [specific skills]
   Input: [what it receives]
   Output: [what it produces]"

2. Use the new agent for its specialized task
```

**Examples of when to create new agents:**
- A task keeps failing and needs dedicated expertise
- A repetitive pattern emerges that should be encapsulated
- A complex subtask would benefit from focused context
- Integration with a new system/API requires specialized knowledge

**Don't hesitate to spawn agent-expert to create new agents. More specialized agents = better results.**

---

## What Ralph Is Building

A self-running CRE deal sourcing machine that:
1. Takes buyer criteria from Lee & Associates brokers
2. Finds property owners via CoStar extraction
3. Executes cold email drip campaigns
4. Classifies and responds to replies
5. Qualifies leads (gets pricing, motivation, decision maker)
6. Packages qualified deals for handoff

**Reference:** See `docs/upstream-playbook.md` for complete flow diagrams and details.

---

## Phase Structure

```
PHASE 1: Database Schema       → PHASE_1_COMPLETE
PHASE 2: Response Classifier   → PHASE_2_COMPLETE
PHASE 3: Qualify Agent         → PHASE_3_COMPLETE
PHASE 4: Schedule Agent        → PHASE_4_COMPLETE
PHASE 5: Drip Campaign System  → PHASE_5_COMPLETE
PHASE 6: Deal Packager         → PHASE_6_COMPLETE
PHASE 7: Integration & Testing → PHASE_7_COMPLETE
                                → UPSTREAM_COMPLETE
```

---

## PHASE 1: Database Schema

### Objective
Add all required tables and columns to support the Upstream pipeline.

### Tasks

1. **Create `tasks` table**
```sql
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
```

2. **Create `qualification_data` table**
```sql
CREATE TABLE qualification_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  property_id UUID REFERENCES properties(id),

  -- Pricing (need 2 of 3)
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

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  packaged_at TIMESTAMPTZ
);
```

3. **Create `email_template_variants` table**
```sql
CREATE TABLE email_template_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID REFERENCES email_templates(id),
  variant_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sends INTEGER DEFAULT 0,
  opens INTEGER DEFAULT 0,
  replies INTEGER DEFAULT 0,
  positive_replies INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

4. **Create `email_exclusions` table**
```sql
CREATE TABLE email_exclusions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  reason TEXT NOT NULL, -- 'bounce', 'hard_pass', 'spam_complaint'
  bounce_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

5. **Alter `companies` table**
```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS has_broker BOOLEAN DEFAULT FALSE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS broker_contact TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS qualification_status TEXT DEFAULT 'new';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS lead_score NUMERIC;
```

6. **Alter `sequence_subscriptions` table**
```sql
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS emails_sent INTEGER DEFAULT 0;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS last_response_classification TEXT;
ALTER TABLE sequence_subscriptions ADD COLUMN IF NOT EXISTS awaiting_approval BOOLEAN DEFAULT TRUE;
```

7. **Alter `synced_emails` table**
```sql
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classification TEXT;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC;
ALTER TABLE synced_emails ADD COLUMN IF NOT EXISTS extracted_pricing JSONB;
```

### Completion Criteria
- [ ] All tables created without errors
- [ ] All ALTER statements executed
- [ ] Migration file created at `supabase/migrations/YYYYMMDD_upstream_schema.sql`
- [ ] `npx supabase db reset` runs successfully
- [ ] Can INSERT and SELECT from all new tables

### Verification
```bash
echo "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('tasks', 'qualification_data', 'email_template_variants', 'email_exclusions');" | psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
# Should return 4 rows

echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'companies' AND column_name IN ('has_broker', 'broker_contact', 'qualification_status', 'lead_score');" | psql postgresql://postgres:postgres@127.0.0.1:55322/postgres
# Should return 4 rows
```

### Output
When complete, output: `PHASE_1_COMPLETE`

---

## PHASE 2: Response Classifier

### Objective
Build an agent that classifies inbound email responses into actionable categories.

### Location
`.claude/agents/response-classifier.md` (update existing)

### Subagent Instructions
```
1. Spawn agent-expert:
   "Update .claude/agents/response-classifier.md to classify emails into 8 categories:
   interested, pricing_given, question, referral, broker_redirect, soft_pass, hard_pass, bounce.
   Include confidence scoring, pricing extraction, and database update logic.
   See RALPH.md Phase 2 for full specification."

2. Spawn prompt-engineer:
   "Create the classification prompt that accurately identifies email intent.
   Must extract pricing data (NOI, cap rate, asking price) when present.
   Must detect broker mentions and bounce patterns."
```

### Classification Categories

| Code | Signals | Action |
|------|---------|--------|
| `interested` | "Let's talk", "Tell me more", "What's the offer?" | Continue to qualify |
| `pricing_given` | Contains $, NOI, cap rate, asking price | Extract data, continue to qualify |
| `question` | "Who's the buyer?", "Is this 1031?", "What's timeline?" | Answer, continue |
| `referral` | "Talk to my partner", "CC'ing", "Forwarding to" | Follow up with new contact |
| `broker_redirect` | "Contact my broker", broker email domain | Log broker, do not pursue |
| `soft_pass` | "Not right now", "Bad timing", "Maybe later" | Add to nurture (re-engage later) |
| `hard_pass` | "Remove me", "Not interested", "Stop emailing" | Add to DNC forever |
| `bounce` | "Undeliverable", "Address not found", MAILER-DAEMON | Add email to exclusions forever |

### Output Format
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
  "needs_human_review": false,
  "recommended_action": "qualify",
  "reasoning": "Email contains explicit NOI ($1,195,000), cap rate (6%), and asking price ($21.9M)"
}
```

### Tasks

1. **Update agent definition** at `.claude/agents/response-classifier.md`
   - Add all 8 classification categories
   - Add extraction logic for pricing data
   - Add confidence scoring
   - Add reasoning output

2. **Create classification function**
   - Input: email body text, subject, from_email
   - Output: classification JSON
   - Handle edge cases (multiple signals, ambiguous responses)

3. **Create database update function**
   - Update `synced_emails.classification`
   - Update `synced_emails.classification_confidence`
   - Update `synced_emails.extracted_pricing`
   - For `bounce`: insert into `email_exclusions`
   - For `hard_pass`: insert into `dnc_entries`
   - For `broker_redirect`: update `companies.has_broker`

### Completion Criteria
- [ ] Agent classifies all 8 categories correctly
- [ ] Pricing extraction works for: "$X", "X million", "NOI of X", "X% cap"
- [ ] Confidence scores range 0.0-1.0
- [ ] Database updates happen for each classification type
- [ ] Edge cases handled (email with multiple signals picks strongest)

### Verification
Test with sample emails:
```
Test 1: "We'd be happy to discuss. Call me at 555-1234" → interested
Test 2: "NOI is $1.2M, asking $18M" → pricing_given, extracted_data populated
Test 3: "Please contact our broker John at broker@realty.com" → broker_redirect
Test 4: "Not interested, please remove me from your list" → hard_pass
Test 5: "Mail delivery failed" → bounce
```

### Output
When complete, output: `PHASE_2_COMPLETE`

---

## PHASE 3: Qualify Agent

### Objective
Build an agent that responds to classified emails, gathers missing qualification data, and escalates to calls when needed.

### Location
`.claude/agents/qualify-agent.md` (create new)

### Subagent Instructions
```
1. Spawn agent-expert:
   "Create .claude/agents/qualify-agent.md that:
   - Reads classification from response-classifier
   - Checks qualification_data for what's missing
   - Generates appropriate response email
   - Updates qualification_data with new info
   - Escalates to call after 2+ emails without pricing or 5+ days stalled
   See RALPH.md Phase 3 for full specification."

2. Spawn prompt-engineer:
   "Write the response email templates for qualify-agent:
   - Template for 'interested' (ask for pricing)
   - Template for 'pricing_given' with missing pieces
   - Template for 'pricing_given' with 2 of 3 (ask for motivation)
   - Template for 'question' (answer and pivot)
   - Template for 'referral' (contact new person)
   - Template for 'soft_pass' (acknowledge, leave door open)
   - Escalation template (request call)
   Match Jeff's email style from docs/email-style-guide.md"
```

### Qualification Checklist
```
□ Pricing (need 2 of 3)
  □ NOI
  □ Cap Rate
  □ Asking Price

□ Motivation / Story (why selling?)
□ Timeline
□ Decision maker confirmed (not a broker)

BONUS:
□ Operating statements
□ Rent roll
```

### Response Templates

**For `interested` (no pricing yet):**
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

**For `pricing_given` (have 2 of 3, need motivation):**
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

**For `soft_pass`:**
```
[Owner Name] -

Understood - appreciate you letting me know. I'll make a note and won't
follow up unless you reach out.

If circumstances change down the road, feel free to get in touch.

[signature]
```

### Escalation to Call

**Triggers:**
- 2+ email exchanges without getting pricing
- Owner responds but dodges specifics
- Owner asks questions but won't commit info
- 5+ days since last response with incomplete qualification

**Escalation template:**
```
[Owner Name] -

Appreciate the back and forth. Might be easier to jump on a quick call
to discuss [property address] directly - I can answer your questions
and get a better sense of what would work on your end.

Do you have 15 minutes this week?

[signature]
```

### Tasks

1. **Create agent definition** at `.claude/agents/qualify-agent.md`
   - Input: classified email + existing qualification_data
   - Output: response email draft + qualification_data updates

2. **Create qualification tracking**
   - Read existing `qualification_data` for company/property
   - Determine what's missing
   - Generate appropriate response
   - Update `qualification_data` with new info

3. **Create escalation logic**
   - Track email count in thread
   - Track days since last response
   - Detect "dodging" patterns
   - Trigger call escalation when criteria met

4. **Create draft queue**
   - Store draft in database with `awaiting_approval = true`
   - Include: to_email, subject, body, company_id, property_id

### Completion Criteria
- [ ] Agent generates appropriate response for each classification
- [ ] Qualification data is read and updated correctly
- [ ] Missing fields are identified and asked for
- [ ] Escalation to call triggers after 2+ emails without pricing
- [ ] Escalation to call triggers after 5+ days stalled
- [ ] Response drafts are stored for approval

### Verification
```
Scenario 1:
  Input: "interested" classification, no qualification_data exists
  Output: Response asking for pricing + motivation, new qualification_data row created

Scenario 2:
  Input: "pricing_given" with NOI and cap, no asking price
  Output: Response asking for asking price + motivation

Scenario 3:
  Input: 3rd email in thread, still no pricing
  Output: Call escalation response

Scenario 4:
  Input: "pricing_given" with 2 of 3 + motivation + decision maker
  Output: Mark as qualified, trigger deal-packager
```

### Output
When complete, output: `PHASE_3_COMPLETE`

---

## PHASE 4: Schedule Agent

### Objective
Build an agent that handles call scheduling, creates reminders, and preps for calls.

### Location
`.claude/agents/schedule-agent.md` (create new)

### Subagent Instructions
```
1. Spawn agent-expert:
   "Create .claude/agents/schedule-agent.md that:
   - Detects call requests in email responses
   - Proposes 3 available time slots (business hours)
   - Creates tasks table entries for reminders
   - Generates call prep emails 30 min before scheduled calls
   - Parses 'call me in X' timeframes into future task dates
   See RALPH.md Phase 4 for full specification."

2. Spawn prompt-engineer:
   "Write the templates for schedule-agent:
   - Time slot proposal email
   - Call prep email format (with conversation history, what we know, what to get)
   - Timeframe parsing patterns ('in a month', 'next week', 'after Q1', etc.)
   Match Jeff's email style from docs/email-style-guide.md"
```

### Capabilities

1. **Detect call requests**
   - "Let's talk"
   - "Call me"
   - "Can we discuss?"
   - "Do you have time for a call?"

2. **Propose available times**
```
[Owner Name] -

Happy to connect. A few times that work on my end:

• [Day], [Date] at [Time] PT
• [Day], [Date] at [Time] PT
• [Day], [Date] at [Time] PT

Looking forward to it.

[signature]
```

3. **Create calendar events**
   - When call time is confirmed
   - Create Outlook calendar event (via COM or Graph API)
   - Include property address and owner name in event

4. **Create call prep task**
   - Task due 30 minutes before call
   - Type: `call_prep`

5. **Send call prep email (30 min before)**
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

WHAT TO GET ON THIS CALL:
□ [Missing pricing metric]
□ Why are they selling?
□ What's their timeline?
□ Who's the decision maker?
□ Can they send operating statements / rent roll?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

6. **Handle "call me in X" requests**
   - Parse timeframe ("in a month", "after Q1", "next week")
   - Create task with future due date
   - Task type: `call_reminder`

### Tasks

1. **Create agent definition** at `.claude/agents/schedule-agent.md`

2. **Create time slot proposer**
   - Generate 3 available times
   - Business hours only (9am-5pm PT)
   - Skip weekends
   - Space across multiple days

3. **Create task creator**
   - Insert into `tasks` table
   - Set appropriate due_date and due_time
   - Set type (`call_prep`, `call_reminder`, `follow_up`)

4. **Create call prep generator**
   - Pull all data for company/property/contact
   - Pull conversation history from `synced_emails`
   - Pull qualification_data
   - Generate prep email

5. **Create timeframe parser**
   - "in a month" → +30 days
   - "next week" → +7 days
   - "after Q1" → April 1
   - "in a few weeks" → +14 days

### Completion Criteria
- [ ] Detects call requests in email responses
- [ ] Generates 3 time slot proposals
- [ ] Creates tasks in database with correct due dates
- [ ] Generates call prep email with all relevant context
- [ ] Parses natural language timeframes correctly
- [ ] Creates reminder tasks for "call me in X" requests

### Verification
```
Test 1: "Can we discuss this tomorrow?" → Propose 3 times, store draft
Test 2: "Tuesday at 2pm works" → Create calendar event + call_prep task
Test 3: "Call me in a month" → Create task due in 30 days
Test 4: 30 min before scheduled call → Call prep email generated
```

### Output
When complete, output: `PHASE_4_COMPLETE`

---

## PHASE 5: Drip Campaign System

### Objective
Build the email sequence execution system with proper timing and approval flow.

### Subagent Instructions
```
1. Spawn agent-expert:
   "Update .claude/agents/drip-campaign-exec.md to:
   - Execute 3-email sequences with proper timing (Day 0, Day 1-3, Day 3-5)
   - Respect send windows (9am-4pm recipient local time)
   - Stagger sends with random jitter (not all at once)
   - Auto-stop sequence when reply received
   - Support approval queue (awaiting_approval flag)
   - Track emails_sent count
   See RALPH.md Phase 5 for full specification."

2. Spawn prompt-engineer:
   "Write the 3-email drip sequence templates:
   - Email 1: Initial outreach (property + buyer profile + soft CTA)
   - Email 2: Follow-up (brief, ask for call)
   - Email 3: Final attempt (leave door open, no pressure)
   Include merge tags for personalization.
   Match Jeff's email style from docs/email-style-guide.md"
```

### Sequence Structure
```
Email 1: Day 0     - Initial outreach
Email 2: Day 1-3   - Follow-up (if no response)
Email 3: Day 3-5   - Final attempt (if no response)
```

### Timing Rules
- Send window: 9:00 AM - 4:00 PM recipient local time
- Stagger sends: random delay between emails (not all at once)
- Business days only (no weekends)
- Auto-stop sequence when reply received

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

### Tasks

1. **Create sequence scheduler**
   - For each contact in extraction_list
   - Create sequence_subscription
   - Schedule email 1 for appropriate send time
   - Set `awaiting_approval = true` initially

2. **Create send time calculator**
   - Input: target date, recipient timezone
   - Output: datetime within 9am-4pm window
   - Add random jitter (0-30 min) to avoid patterns

3. **Create approval queue system**
   - List all emails with `awaiting_approval = true`
   - Allow edit before send
   - On approve: mark `awaiting_approval = false`, schedule send
   - On reject: cancel email

4. **Create sequence progression**
   - After email sent: schedule next email (if no reply)
   - On reply received: stop sequence, trigger response-classifier
   - Track `emails_sent` count

5. **Create personalization engine**
   - Replace merge tags: [Owner First Name], [address], [property type], etc.
   - Pull data from properties, companies, contacts tables

### Database Updates

```sql
-- Add to sequences table if not exists
INSERT INTO sequences (name, description, stop_on_reply, timezone)
VALUES ('Cold Outreach - Owner', '3-email drip for owner outreach', true, 'America/Los_Angeles');

-- Add sequence steps
INSERT INTO sequence_steps (sequence_id, step_number, step_type, delay_days, delay_hours)
VALUES
  ([seq_id], 1, 'email', 0, 0),      -- Day 0
  ([seq_id], 2, 'email', 2, 0),      -- Day 2
  ([seq_id], 3, 'email', 4, 0);      -- Day 4
```

### Completion Criteria
- [ ] Sequences created with 3 steps
- [ ] Emails personalized with merge tags
- [ ] Send times calculated within 9am-4pm window
- [ ] Sends staggered with random jitter
- [ ] Sequence stops when reply received
- [ ] Approval queue shows pending emails
- [ ] Can edit and approve emails
- [ ] emails_sent count tracks correctly

### Verification
```
Test 1: Create subscription for contact → 3 emails scheduled
Test 2: Email 1 approved and sent → emails_sent = 1, email 2 scheduled
Test 3: Reply received before email 2 → sequence stopped
Test 4: Send time for 3am → rescheduled to 9am+ same day
Test 5: Weekend send → rescheduled to Monday
```

### Output
When complete, output: `PHASE_5_COMPLETE`

---

## PHASE 6: Deal Packager

### Objective
Build an agent that compiles qualified leads into deal package JSON for handoff.

### Location
`.claude/agents/deal-packager.md` (update existing)

### Subagent Instructions
```
1. Spawn agent-expert:
   "Update .claude/agents/deal-packager.md to:
   - Trigger when qualification_data.status = 'qualified'
   - Pull all data from properties, companies, contacts, qualification_data
   - Generate investment summary and highlights
   - Compile conversation history
   - Output complete JSON package with progressive disclosure structure
   See RALPH.md Phase 6 for full specification."

2. Spawn prompt-engineer:
   "Write the prompts for deal-packager to generate:
   - Investment summary (2-3 sentences: property, location, opportunity)
   - Investment highlights (4-6 bullet points: pricing, cap, value-add, motivation)
   - Conversation summary (timeline of key milestones)
   Output should be professional, factual, compelling for CRE investors."
```

### Trigger
When `qualification_data.status = 'qualified'` or manually invoked.

### Output Format

```json
{
  "package_id": "uuid",
  "created_at": "2025-01-10T12:00:00Z",
  "status": "ready",

  "property": {
    "id": "uuid",
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

  "investment_summary": "94,612 SF Class B office building in San Diego's Mission Valley submarket. Current ownership has held for 10+ years with recent tenant turnover creating value-add opportunity. Vacancy trending down over past 6 months with stabilized NOI expected to exceed current run rate.",

  "investment_highlights": [
    "Below replacement cost at $231/SF",
    "6% cap rate with upside as vacancy stabilizes",
    "Recent tenant turnover = value-add opportunity",
    "Long-term ownership indicates low basis",
    "Strong Mission Valley submarket fundamentals"
  ],

  "seller_info": {
    "company_id": "uuid",
    "company_name": "Summa Fresno LLC",
    "contact_name": "Will Dyck",
    "contact_email": "will@summafresno.com",
    "contact_phone": null,
    "motivation": "Investment property, open to offers at basis. Experienced turnover in 2024-2025 but vacancy now decreasing.",
    "timeline": "Flexible, not rushed"
  },

  "supporting_docs": {
    "has_operating_statements": false,
    "has_rent_roll": false
  },

  "conversation_summary": "Initial outreach Sep 18, 2025. Owner responded Sep 19 indicating interest in discussing sale. Follow-up Nov 9 requested pricing details. Owner provided NOI ($1.195M), cap rate (6%), and asking price ($21.9M) on Nov 12, noting that current NOI doesn't reflect expected improvement as vacancy decreases.",

  "source": {
    "campaign": "Institutional Buyer Seeking Off-Market CA Commercial Properties",
    "extraction_list_id": "uuid",
    "client_criteria_id": "uuid",
    "first_contact": "2025-09-18",
    "qualified_date": "2025-11-12",
    "total_touches": 4
  },

  "progressive_disclosure": {
    "teaser": {
      "visible": ["property.type", "property.size_sf", "financials.*", "investment_summary", "investment_highlights"],
      "hidden": ["property.address", "seller_info.*"]
    },
    "after_ca": {
      "visible": ["property.*"],
      "hidden": ["seller_info.*"]
    },
    "after_loi": {
      "visible": ["*"]
    }
  }
}
```

### Tasks

1. **Create deal package generator**
   - Pull all data from: properties, companies, contacts, qualification_data
   - Pull conversation history from synced_emails
   - Calculate derived fields (price_per_sf)

2. **Create investment summary generator**
   - AI-generated based on property + qualification data
   - 2-3 sentences covering: property, location, opportunity

3. **Create investment highlights generator**
   - AI-generated list of 4-6 bullet points
   - Focus on: pricing, cap rate, value-add angle, seller motivation

4. **Create conversation summarizer**
   - Pull all emails in thread
   - Summarize key dates and milestones
   - Note what was shared and when

5. **Store deal package**
   - Create new table or JSON column
   - Link to company_id, property_id
   - Track status: draft, ready, handed_off

### Completion Criteria
- [ ] Generates complete JSON package
- [ ] Investment summary is coherent and relevant
- [ ] Investment highlights are specific to the deal
- [ ] Conversation summary captures key milestones
- [ ] Progressive disclosure fields correctly defined
- [ ] Package stored in database

### Verification
```
Test 1: Qualified lead with full data → Complete package generated
Test 2: Investment summary mentions property type, location, opportunity
Test 3: Investment highlights include actual pricing/cap data
Test 4: Conversation summary shows timeline of outreach
```

### Output
When complete, output: `PHASE_6_COMPLETE`

---

## PHASE 7: Integration & Testing

### Objective
Wire all components together and verify end-to-end flow works.

### Integration Points

1. **sourcing-agent → drip-campaign-exec**
   - After extraction_list created
   - Create sequence_subscriptions for each contact
   - Queue emails for approval

2. **Inbound email → response-classifier**
   - When new email synced
   - Classify and update database
   - Trigger appropriate next action

3. **response-classifier → qualify-agent**
   - For: interested, pricing_given, question, referral
   - Generate response draft
   - Queue for approval

4. **response-classifier → schedule-agent**
   - When call requested or escalation triggered
   - Generate scheduling email
   - Create tasks

5. **qualify-agent → deal-packager**
   - When qualification_data.status = 'qualified'
   - Generate deal package
   - Mark ready for handoff

6. **Bounce/Hard Pass → Exclusions**
   - response-classifier detects
   - Updates email_exclusions or dnc_entries
   - Future sends skip these

### End-to-End Test Scenarios

**Scenario A: Happy Path**
```
1. Buyer criteria submitted
2. sourcing-agent generates CoStar query
3. Extraction runs, properties/owners stored
4. Drip sequence created, email 1 queued
5. Email 1 approved and sent
6. Owner replies with pricing
7. response-classifier: pricing_given
8. qualify-agent asks for motivation
9. Owner provides motivation
10. response-classifier: pricing_given (with more data)
11. qualify-agent marks qualified
12. deal-packager generates package
→ SUCCESS
```

**Scenario B: Escalation to Call**
```
1. Email 1 sent, owner replies "Tell me more"
2. response-classifier: interested
3. qualify-agent asks for pricing
4. Owner responds but dodges pricing
5. qualify-agent asks again
6. Owner still dodges (2+ emails, no pricing)
7. qualify-agent triggers escalation
8. schedule-agent proposes call times
9. Owner confirms time
10. Call prep task created, prep email sent
→ SUCCESS
```

**Scenario C: Bounce Handling**
```
1. Email 1 sent
2. Bounce received (MAILER-DAEMON)
3. response-classifier: bounce
4. Email added to email_exclusions
5. Sequence stopped
6. Future campaigns skip this email
→ SUCCESS
```

**Scenario D: Broker Redirect**
```
1. Email 1 sent
2. Owner replies "Contact my broker at broker@realty.com"
3. response-classifier: broker_redirect
4. companies.has_broker = true
5. companies.broker_contact = "broker@realty.com"
6. No further pursuit
→ SUCCESS
```

### Completion Criteria
- [ ] All 6 agents working individually (phases 1-6 complete)
- [ ] Agents trigger each other correctly
- [ ] Database updates propagate through pipeline
- [ ] Scenario A passes
- [ ] Scenario B passes
- [ ] Scenario C passes
- [ ] Scenario D passes
- [ ] No orphaned data (all foreign keys valid)
- [ ] Approval queue shows pending items from all stages

### Verification
Run each scenario manually and verify:
- Database state after each step
- Correct agent triggered
- Correct output generated

### Output
When complete, output: `PHASE_7_COMPLETE`

Then output: `UPSTREAM_COMPLETE`

---

## Self-Correction Patterns

### If database error occurs:
1. Check if table/column exists
2. Run migration if missing
3. Retry operation

### If agent output is malformed:
1. Validate JSON structure
2. Check for required fields
3. **Spawn prompt-engineer** to fix the prompt
4. Regenerate with improved prompt

### If agent behavior is wrong:
1. Identify what's incorrect
2. **Spawn agent-expert** to update the agent definition
3. Re-run with updated agent

### If classification is uncertain:
1. Set `needs_human_review = true`
2. Lower confidence score
3. Queue for manual review
4. If pattern repeats, **spawn prompt-engineer** to improve classification prompt

### If email send fails:
1. Check if email in exclusions
2. Check for bounce history
3. Retry once, then mark failed

### If qualification stalls:
1. Check days since last response
2. Check email count in thread
3. Trigger escalation if thresholds met

### If email templates underperform:
1. Review response rates
2. **Spawn prompt-engineer** to write improved variants
3. A/B test new vs old

### General Rule
**When something isn't working, spawn the appropriate specialist agent to fix it rather than attempting ad-hoc fixes.**

---

## File Locations Summary

```
.claude/agents/
├── agent-expert.md          (USE THIS to create/update agents)
├── prompt-engineer.md       (USE THIS to write/refine prompts)
├── sourcing-agent.md        (exists - verify)
├── response-classifier.md   (update in Phase 2)
├── qualify-agent.md         (create in Phase 3)
├── schedule-agent.md        (create in Phase 4)
├── drip-campaign-exec.md    (exists - update in Phase 5)
└── deal-packager.md         (exists - update in Phase 6)

supabase/migrations/
└── YYYYMMDD_upstream_schema.sql  (create in Phase 1)

docs/
├── upstream-playbook.md     (exists - reference for full context)
├── email-style-guide.md     (exists - reference for email templates)
├── cold-email-analysis.md   (exists - reference for what worked/didn't)
└── RALPH.md                 (this file)
```

---

## Completion Markers

Output these markers as each phase completes:

- `PHASE_1_COMPLETE` - Database schema ready
- `PHASE_2_COMPLETE` - Response classifier working
- `PHASE_3_COMPLETE` - Qualify agent working
- `PHASE_4_COMPLETE` - Schedule agent working
- `PHASE_5_COMPLETE` - Drip campaign system working
- `PHASE_6_COMPLETE` - Deal packager working
- `PHASE_7_COMPLETE` - Integration tested
- `UPSTREAM_COMPLETE` - All phases complete, system operational
