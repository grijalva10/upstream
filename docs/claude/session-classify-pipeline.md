# Session: upstream-classify-pipeline

**Date:** 2025-01-12
**Focus:** Email classification training, qualify-agent creation, pipeline metrics

---

## What Was Accomplished

### 1. Response Classifier Training Data

Created comprehensive training data from 986 emails sent across campaigns.

**File:** `output/campaign_training_data.json` (238 records)

**Classifications defined (11 total):**

| Classification | Count | % | Description |
|----------------|------:|--:|-------------|
| ooo | 93 | 39% | Out of office auto-reply |
| interested | 47 | 20% | Wants to talk, provided contact |
| bounce | 33 | 14% | Email delivery failure |
| soft_pass | 24 | 10% | Not now, maybe later |
| referral | 16 | 7% | Redirected to another contact |
| unclear | 16 | 7% | Ambiguous/minimal response |
| pricing_given | 5 | 2% | Shared pricing or property info |
| question | 2 | 1% | Asking clarifying question |
| stale_data | 2 | 1% | Wrong/outdated contact |
| broker_redirect | - | - | Has broker handling |
| hard_pass | - | - | Never contact again |

**Updated:** `.claude/agents/response-classifier.md`

---

### 2. Qualify-Agent Training Data

Extracted interested/pricing_given/question responses for qualify-agent training.

**File:** `output/qualify_agent_training_data.json` (39 records after dedupe)

**Lead Temperature:**
| Temperature | Count | Description |
|-------------|------:|-------------|
| hot | 13 | Ready NOW - gave phone, asked for call |
| warm | 23 | Interested but needs info first |
| lukewarm | 3 | Tentative, price-focused |

**Next Actions:**
| Action | Count |
|--------|------:|
| schedule_call | 7 |
| follow_up | 13 |
| send_info | 10 |
| evaluate_pricing | 6 |
| answer_question | 2 |

---

### 3. Qualify-Agent Definition

**File:** `.claude/agents/qualify-agent.md`

**Role:** SDR (Sales Development Rep) - NOT a deal maker

**Core Rules:**
- Does NOT make offers
- Does NOT negotiate pricing
- Does NOT guess any details (if unsure → flag for Jeff)
- Success = qualified lead with call scheduled

**Key Constraint Added:**
> Any information provided to a prospect MUST be 100% accurate. If unsure about property details, buyer criteria, timeline, or any factual claim → flag for Jeff instead of guessing.

---

### 4. Pipeline Metrics Documented

**File:** `output/pipeline-turnaround.md`

#### Overall Conversion Funnel
| Stage | Volume | Rate |
|-------|-------:|-----:|
| Emails Sent | 986 | - |
| Replies | 129 | 13% |
| Interested | 47 | 36% of replies |
| Qualified Deals | 16 | 34% of interested |
| **Overall** | **1 deal per 62 emails** | **1.6%** |

#### SELLER Campaigns (Broker Use Case)
| Stage | Volume | Rate |
|-------|-------:|-----:|
| Emails Sent | 750 | - |
| Replies | 84 | 11.2% |
| Interested | 23 | 3.1% of sent |
| Qualified Deals | ~8 | 34% of interested |
| **Emails per Deal** | **~94** | - |

#### Time to Qualified Deal
| Scenario | Timeline |
|----------|----------|
| **Fast** | 1-2 weeks |
| **Normal** | 2-4 weeks |
| **Extended** | 4-6 weeks |

---

### 5. Off-Market Inventory Catalog

**File:** `output/off-market-inventory.md`

Documented 16 properties from the pipeline:
- Total value: ~$206M+
- Price range: $2.5M - $60M+
- Markets: CA, TX, AZ, UT
- Types: Retail, Office, Warehouse, Industrial

---

## Key Files Created/Modified

| File | Purpose |
|------|---------|
| `output/campaign_training_data.json` | Response classifier training data |
| `output/qualify_agent_training_data.json` | Qualify agent training data |
| `output/campaigns.md` | Campaign performance table |
| `output/classifications.md` | Classification definitions |
| `output/qualify_agent_summary.md` | Qualify agent training summary |
| `output/pipeline-turnaround.md` | Pipeline conversion & timeline |
| `output/off-market-inventory.md` | 16 properties from pipeline |
| `.claude/agents/response-classifier.md` | Updated with 11 classifications |
| `.claude/agents/qualify-agent.md` | Updated SDR role, accuracy rules |

---

## Scripts Created

| Script | Purpose |
|--------|---------|
| `scripts/export_campaign_training_data.py` | Export training data from synced_emails |
| `scripts/label_qualify_data.py` | Auto-label qualify agent training data |
| `scripts/show_hot_leads.py` | Display hot leads from training data |
| `scripts/dedupe_hot_leads.py` | Dedupe hot leads by email |

---

## Key Decisions

1. **Qualify-agent is SDR, not deal-maker** - Answers questions, gathers info, schedules calls. Does NOT make offers.

2. **100% accuracy rule** - Agent must flag for Jeff if unsure about ANY factual claim. Never guess.

3. **Lead temperature classification** - Hot (phone given), Warm (needs info), Lukewarm (tentative)

4. **SELLER campaigns = broker use case** - 94 emails per deal, 2-4 weeks typical timeline

---

## Broker Pitch Summary

> "Input buyer criteria → send 300 emails → expect **3 qualified deals** in **2-4 weeks**. First deal often surfaces in week 1-2."

---

## Next Steps (for future sessions)

1. Test qualify-agent on real responses
2. Build schedule-agent integration
3. Automate response-classifier → qualify-agent handoff
4. Track actual vs predicted conversion rates
