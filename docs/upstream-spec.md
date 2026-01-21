# Upstream Sourcing Engine

**AI-Assisted Commercial Real Estate Deal Origination System**

*Technical Documentation for IP Review*

> **Context:** This document describes the technical system for IP/legal purposes. For the full product vision including the relationship with Lee 1031 X and bidirectional flows (buyers, sellers, pivots), see `VISION.md`.

---

## CONFIDENTIAL DISCLOSURE NOTICE

**Intellectual Property Ownership:** All intellectual property rights in the system, processes, methods, and innovations described in this document are the sole and exclusive property of Jeff Grijalva, or such entity as he may designate. This intellectual property is not owned by, assigned to, or licensed to Lee & Associates, Lee 1031 X Exchange, or any other business entity unless expressly stated in a separate written agreement.

**Restricted Distribution:** This document is provided on a strictly confidential basis to the named recipient only. The recipient may not copy, distribute, disclose, or share this document or its contents with any third party without the prior written consent of Jeff Grijalva. This restriction includes but is not limited to colleagues, employees, partners, affiliates, attorneys, and advisors of any affiliated business entity.

**Purpose of Disclosure:** This document is shared solely for informational purposes to provide the recipient with an understanding of the technical system. Receipt of this document does not grant any license, ownership interest, or other rights in the intellectual property described herein.

*By reading beyond this notice, the recipient acknowledges and agrees to these terms.*

---

## 1. Executive Summary

The Upstream Sourcing Engine is a proprietary AI-driven system that transforms natural language buyer requirements into qualified commercial real estate deal flow. The system orchestrates multiple AI agents to automate prospect identification, personalized outreach, response classification, and deal packaging—while maintaining human oversight at critical decision points.

**Core Innovation:** The system converts unstructured buyer criteria and profile narratives into actionable intelligence, then autonomously executes a multi-stage outreach and qualification pipeline that culminates in packaged investment opportunities ready for distribution.

---

## 2. System Overview

### 2.1 Purpose

The Upstream Sourcing Engine addresses a fundamental challenge in 1031 exchange transactions: buyers operate under strict 45-day identification and 180-day closing deadlines, yet off-market opportunities—which often offer the best value—are difficult to identify and access at scale.

**The system solves this by:**
- Interpreting complex, nuanced buyer requirements expressed in natural language
- Translating requirements into precise property database queries
- Generating highly personalized, context-aware outreach at scale
- Intelligently classifying and routing responses for follow-up
- Packaging qualified opportunities into investment-ready deal summaries

### 2.2 System Boundary

The Upstream Sourcing Engine operates as a pre-platform pipeline. It generates qualified deal inventory that is subsequently loaded into the Lee 1031 X deal distribution platform. The two systems are intentionally decoupled—Lee 1031 X handles broker-client deal distribution, while this engine handles upstream supply generation.

---

## 3. System Inputs

The system accepts two primary inputs, both expressed in natural language:

### 3.1 Investment Criteria

Structured and semi-structured requirements including:

| Field | Description | Example |
|-------|-------------|---------|
| **Capital Available** | Investment budget range | $1M – $10M |
| **Timeline** | Closing capability and urgency | 30 days |
| **Target Cap Rate** | Minimum yield requirements | 5%+ |
| **Asset Types** | Property categories of interest | Industrial, Retail |
| **Target Markets** | Geographic preferences | Phoenix, Houston, Dallas |
| **1031 Deadline** | Exchange identification deadline | Dec 29, 2024 |

### 3.2 Buyer Profile

Unstructured narrative context that informs outreach personalization:

- **Transaction History:** Prior deal experience (e.g., "20+ deals completed")
- **Decision Structure:** Solo buyer, partnership, family office, etc.
- **Operational Capability:** In-house management, preferred deal structures
- **Risk Tolerance:** Value-add vs. stabilized preferences
- **Narrative Notes:** Contextual information about the buyer's situation, preferences, and constraints

### 3.3 Example Input

```
Capital: $1-5M
Timeline: 30 days
Decision: Partnership
Experience: 20+ deals
Budget: $1M - $10M | Cap rate: 5%+
Assets: Industrial, Retail | Markets: AZ, CA, TX
1031 Deadline: Dec 29, 2024

Notes: Michael's team at Rexford just completed the disposition of their
85,000 SF industrial portfolio in the IE West for $12.8M. They have
approximately $4.5M of equity to deploy into 1-3 replacement properties.
Primary focus is on value-add industrial with lease-up opportunity...
```

---

## 4. Process Pipeline

The system executes a six-stage pipeline, with AI agents handling automation and humans providing oversight at critical qualification points.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STAGE 1        STAGE 2        STAGE 3        STAGE 4        STAGE 5       │
│  Prospect  →    Outreach  →    Drip      →    Response  →    Human    →    │
│  List Gen       Copy Gen       Campaign       Classify       Qualify       │
│  [AI]           [AI]           [AI]           [AI]           [HUMAN]       │
│                                                                             │
│                                                              STAGE 6        │
│                                                              Deal Package   │
│                                                              & Upload [AI]  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Stage 1: Prospect List Generation

| | |
|---|---|
| **Actor** | AI Agent |
| **Output** | High-probability prospect list downloaded from property database |

**Process:** The AI agent analyzes the natural language criteria and buyer profile to determine optimal search parameters. It then generates specific filter configurations for commercial real estate databases that will yield high-probability prospects.

**Key Intelligence:**
- Interprets nuanced requirements ("value-add industrial with lease-up opportunity")
- Translates to database filters (occupancy 70-90%, building age 15+, etc.)
- Considers buyer profile for targeting (experienced buyers may tolerate more risk)
- Outputs actionable search parameters for operator execution

### 4.2 Stage 2: Outreach Copy Generation

| | |
|---|---|
| **Actor** | AI Agent |
| **Output** | Three personalized email templates per prospect |

**Process:** The AI agent generates a three-email sequence optimized for conversion. Each email is crafted based on the specific buyer profile, creating authentic, contextually relevant messaging.

**Key Intelligence:**
- Incorporates buyer credibility signals ("backed by experienced partnership with 20+ transactions")
- Adapts tone and urgency based on timeline ("1031 exchange deadline approaching")
- Personalizes to each property and owner (not bulk templated messaging)
- Creates natural progression across the three-email sequence

### 4.3 Stage 3: Drip Campaign Execution

| | |
|---|---|
| **Actor** | AI Agent |
| **Output** | Executed email campaign with delivery tracking |

**Process:** The AI agent orchestrates the email campaign, determining optimal timing, sequencing, intervals, and pacing. Emails are sent individually (not in bulk) to maintain deliverability and authenticity.

**Key Intelligence:**
- Determines optimal send times based on recipient profiles
- Manages inter-email intervals (e.g., 3-5 days between touches)
- Adjusts pacing based on campaign timeline constraints
- Executes individual sends to avoid spam detection

### 4.4 Stage 4: Response Classification & Routing

| | |
|---|---|
| **Actor** | AI Agent |
| **Output** | Classified responses routed to appropriate workflows |

**Process:** The AI agent monitors incoming responses and classifies them into actionable categories, then routes each appropriately.

**Classification Categories:**

| Category | Action |
|----------|--------|
| Potential Seller | Route to qualification queue |
| Potential Buyer | Route to buyer intake |
| Future Interest | Add to nurture sequence |
| Do Not Contact | Add to suppression list |

### 4.5 Stage 5: Human Qualification

| | |
|---|---|
| **Actor** | Human Operator |
| **Output** | Qualified seller with complete deal information package |

**Process:** Human operator conducts qualification calls with potential sellers to collect deal-critical information.

**Information Collected:**
- Asking price and pricing flexibility
- Current cap rate and NOI
- Motivation and timeline
- Financial statements and due diligence documents
- Property photos and condition information

### 4.6 Stage 6: Deal Packaging & Upload

| | |
|---|---|
| **Actor** | AI Agent |
| **Output** | Complete deal record in Lee 1031 X platform, ready for broker distribution |

**Process:** The AI agent synthesizes all collected information into a compelling, standardized deal package and uploads it to the Lee 1031 X deal distribution platform.

**Package Components:**
- **Investment Summary:** Compelling narrative highlighting opportunity thesis
- **Investment Highlights:** Key value drivers and differentiators
- **Financial Summary:** Price, cap rate, NOI, and key metrics
- **Property Photos:** Curated imagery of the asset
- **Seller Contact Information:** Owner details for qualified buyers
- **Due Diligence Documents:** Financial statements and supporting materials

---

## 5. Novel Technical Elements

The following elements represent potentially protectable innovations:

### 5.1 Natural Language to Query Translation

The system's ability to interpret unstructured buyer requirements (including nuanced preferences like "value-add industrial with lease-up opportunity") and translate them into precise database filter parameters represents a novel application of language models to commercial real estate prospecting.

### 5.2 Profile-Aware Outreach Generation

The email generation system creates individualized outreach by synthesizing buyer profile narratives, property-specific details, and market context. This is distinct from template-based mail merge systems—each email is contextually generated.

### 5.3 Multi-Class Response Classification

The automated classification of email responses into actionable categories (potential seller, potential buyer, future interest, DNC) with appropriate workflow routing represents an intelligent triage system that extends beyond simple sentiment analysis.

### 5.4 AI-Generated Deal Packaging

The system's ability to synthesize raw deal information into compelling investment summaries and structured deal packages—ready for distribution—represents an automated content generation capability specific to commercial real estate transactions.

### 5.5 End-to-End Pipeline Orchestration

The integration of multiple AI agents across the entire sourcing pipeline—from criteria interpretation through deal packaging—with appropriate human checkpoints represents a novel workflow architecture for deal origination.

---

## 6. Technical Architecture

### 6.1 Components

| Component | Purpose |
|-----------|---------|
| **AI Agent Framework** | Large language model integration for natural language processing, generation, and workflow orchestration |
| **Local Execution Environment** | AI agent runs on operator's personal computer with direct system access |
| **Property Database Integration** | Commercial real estate databases (CoStar) for prospect list generation |
| **Email Infrastructure** | Microsoft Outlook integration via operator's account for campaign delivery and response monitoring |
| **Calendar Integration** | Outlook calendar for scheduling qualification calls and follow-up reminders |
| **Downstream Platform** | Lee 1031 X for deal distribution |

### 6.2 Execution Model

The AI agent operates on the operator's local machine, directly interfacing with Outlook for email operations and calendar management. This architecture ensures:

- Full control over outreach timing and pacing
- Direct access to email responses for real-time classification
- Seamless calendar integration for scheduling
- Human oversight at critical decision points

### 6.3 Data Flow

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Natural Language │ → │  AI Query        │ → │  Property        │
│  Input            │     │  Translation     │     │  Database        │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  AI Email        │ ← │  Prospect        │ ← │  Search Results  │
│  Generation      │     │  List            │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Campaign        │ → │  Response        │ → │  Human           │
│  Execution       │     │  Classification  │     │  Qualification   │
│  (via Outlook)   │     │                  │     │                  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
                                                           │
                                                           ▼
                         ┌──────────────────┐     ┌──────────────────┐
                         │  Lee 1031 X      │ ← │  AI Deal         │
                         │  Platform        │     │  Packaging       │
                         └──────────────────┘     └──────────────────┘
```

---

*All intellectual property described herein is owned exclusively by Jeff Grijalva.*

*Unauthorized distribution or disclosure is prohibited.*
