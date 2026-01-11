# Email Writing Style Guide

Analysis based on 2,677 outbound emails from synced_emails.

## Overview Stats
- **Total outbound emails**: 2,677 (across 2,143 threads)
- **Average length**: 3,425 characters | **Median**: 935 characters
- **Consistent signature block**: `Jeff Grijalva | Lee & Associates | Newport Beach, CA | (949) 939-2654`

---

## Style Categories

### 1. Quick Replies (Internal/Transactional)
**Tone**: Ultra-concise, no fluff, action-oriented

**Characteristics**:
- 1-2 sentences max before signature
- Often starts with action ("See attached", "Ok", "Received, thank you")
- No greeting in most quick replies
- Minimal punctuation, direct

**Examples**:
- `"See attached 2023."`
- `"Received, thank you."`
- `"Great, thank you."`
- `"Ok I will. Thanks for sharing"`
- `"100% - that is just for our eyes. We shouldn't mention at all."`

---

### 2. Internal Team Updates
**Tone**: Collegial, efficient, collaborative

**Characteristics**:
- Straight to content, no pleasantries
- Uses abbreviations and shorthand when context is clear
- May include action items or acknowledgments
- Relaxed grammar in quick exchanges

**Examples**:
- `"Yes stop by my desk later today if you are around"`
- `"Ok, will do. I'll update the Dropbox for both files."`
- `"I'm only seeing changes to the executive summary in my email. Could you resend when you have a chance or just tell me what line items to remove?"`
- `"See attached survey for Katie. Let me know if you'd like me to send. Thx."`

---

### 3. Professional Deal Communication
**Tone**: Polished but warm, persuasive, relationship-building

**Characteristics**:
- First-name greeting (`Mac,`, `Doug,`, `Zak,`)
- Context-building opening ("Here's the overview you asked for...")
- Bullet points for data/terms
- Soft closes with options ("If you think...", "Let me know...")
- Strategic framing that highlights mutual benefit

**Example (Morgan Stanley financing email)**:
```
Mac,
Here's the overview you asked for on Brian's current financing so you and your team can take a look.
[STRUCTURED DATA WITH BULLETS]
This lender's model is simple: they only make money on the loan. Brian asked me to sense-check whether the rate was competitive...
Brian is a serious buyer with ongoing deal flow, and I know he'd benefit long term from a team that can look at his whole picture...
Let me know what else you need from me. Appreciate you taking a look at this.
```

---

### 4. Cold Outreach / Prospecting
**Tone**: Confident, exclusive, creates urgency

**Characteristics**:
- First name personalization (`Dell -`, `Brendan -`, `Michael -`)
- Immediate value hook (no small talk)
- Bullet points for property highlights
- Scarcity/exclusivity language ("short list of principals", "not a marketed process")
- Soft CTA with options ("If this fits your mandate... Or if you prefer")

**Template Pattern**:
```
[Name] -

Reaching out to a short list of principals who can execute on a $75-85M multifamily acquisition before year-end.

[Property Name] | [Location]

* [Key specs in bullets]
* [Financial highlights]

Seller requires discretion and certainty of close. This is not a marketed process.

If this fits your mandate, I can send the investment summary under CA. Or if you prefer - happy to discuss first.
```

---

### 5. Proposals/Formal Communications
**Tone**: Professional, clear, action-oriented

**Characteristics**:
- Formal greeting when warranted
- Clear statement of purpose
- Request for confirmation
- Professional but not stiff

**Example**:
```
Doug,

Attached is our proposal outlining the key terms for Value-Add Property, LLC's potential purchase of 301-315 E McKinley Rd.

Please confirm receipt at your convenience. We look forward to your response.
```

---

### 6. Advisory/Consultative Replies
**Tone**: Expert, helpful, guiding

**Characteristics**:
- Greeting with name (`Hi Zak,`)
- Acknowledges what was received
- Provides professional opinion/advice
- Suggests prioritization or next steps
- Closes with question or invitation for input

**Example**:
```
Hi Zak,

Thanks for sending over the attorney's comments. I've reviewed the list, and while it's thorough, it's also quite extensive for a standard AIR lease. In my experience, the landlord will not be willing to incorporate all of these changes.

That said, we should identify the key items that are most important to you so we can prioritize and push on those. This will make the negotiation more productive and increase the chances of getting meaningful concessions.

Let me know which points you'd like us to focus on.
```

---

## Key Style Traits

| Trait | Pattern |
|-------|---------|
| **Greetings** | First name only or skipped entirely in replies |
| **Closings** | Often none before signature; occasionally "Appreciate it" or "Thanks" |
| **Punctuation** | Minimal; periods end statements; rarely uses exclamation marks |
| **Sentence length** | Short, punchy sentences; avoids run-ons |
| **Formality** | Scales with relationship (casual internal -> polished external) |
| **Data presentation** | Bullet points for specs/terms; structured info blocks |
| **CTAs** | Soft, option-giving ("Let me know", "If you prefer") |
| **Urgency** | Created through exclusivity, not pressure words |
| **Personality** | Professional but approachable; confident without arrogance |

---

## Classification Framework

For AI-generated emails, classify context as:

| Category | Trigger Signals | Style to Apply |
|----------|----------------|----------------|
| `quick_reply` | Short response needed, routine | 1-2 sentences, no greeting |
| `internal_team` | @lee-associates.com recipients | Casual, efficient, collaborative |
| `deal_intro` | New property/opportunity pitch | Structured, bullet points, exclusivity |
| `follow_up` | Continuing conversation | Context-aware, action-oriented |
| `advisory` | Questions requiring expertise | Helpful, guiding, professional |
| `proposal` | Formal document delivery | Clear, formal, action request |

---

## Voice Guidelines for AI Generation

### Do:
- Use first name only (no "Hi" or "Dear")
- Lead with the point, not preamble
- Use bullet points for 3+ data items
- Offer options in CTAs ("If X... Or if you prefer...")
- Keep sentences short and direct
- Match formality to recipient relationship

### Don't:
- Use exclamation marks
- Start with "I hope this email finds you well"
- Use filler phrases ("Just wanted to", "I was wondering if")
- Over-explain or hedge
- Use formal closings ("Best regards", "Sincerely")
