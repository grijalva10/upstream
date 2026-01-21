# Upstream Sourcing Engine

> **Note:** This is a simplified overview. See `docs/VISION.md` for the full architecture including bidirectional flows (buyers becoming sellers, campaigns uncovering different inventory, etc.) and how Upstream feeds into Lee 1031 X.

## What Is It
A tool that finds property owners who might sell, emails them, and packages deals.

## The Problem
Buyers have money and deadlines. Good properties are hard to find. Emailing owners one by one is slow.

## The Solution
AI agents do the boring parts. Human does the important parts.

## How It Works

```
1. BUYER SAYS WHAT THEY WANT
   "I have $5M, want industrial in Phoenix, need 6% cap"
        ↓
2. AI FIGURES OUT WHAT TO SEARCH
   Translates english into CoStar filters
        ↓
3. COSTAR GIVES US PROPERTIES
   (requires 2FA, human has to help here)
        ↓
4. AI WRITES EMAILS
   3 emails per owner, personalized
        ↓
5. EMAILS GO OUT
   Via Outlook, spaced out, not spammy
        ↓
6. REPLIES COME BACK
   AI sorts them: interested / not interested / maybe later / go away
        ↓
7. HUMAN TALKS TO INTERESTED ONES
   Qualification calls, get the real info
        ↓
8. AI PACKAGES THE DEAL
   Makes it look nice for distribution
        ↓
9. DEAL GOES TO BUYERS
   Via Lee 1031 X platform
```

## What's Built
- [ ] Query builder (CoStar filters) ← START HERE
- [ ] CoStar integration (costar-extract exists, needs work)
- [ ] Email writer
- [ ] Email sender (Outlook COM)
- [ ] Response classifier
- [ ] Deal packager
- [ ] UI for decisions
- [ ] Database for persistence

## What Runs Where

**On My Computer (Required)**
- costar-extract (needs 2FA from my phone)
- Outlook email sending (COM automation)
- Claude Code agents

**In The Cloud**
- Supabase (data storage, so I don't lose everything)
- Next.js UI (eventually, so I can check from phone)

## Current Status
Figuring out the CoStar filter mappings. The docs we have might be wrong.

## Next Step
Get one query working end-to-end. Input criteria, output valid CoStar payload, run it, see results.
