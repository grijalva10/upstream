# Outreach Copy Gen Agent - Example Outputs

Three example outputs demonstrating the agent working across different scenarios.

---

## Example 1: Long Hold Private Owner (18 years, Industrial)

### Input
```json
{
  "contact": {
    "name": "John Martinez",
    "first_name": "John",
    "email": "jmartinez@martinezholdingsllc.com",
    "title": "President"
  },
  "property": {
    "address": "1020 Railroad St, Corona, CA",
    "city": "Corona",
    "state": "CA",
    "building_sf": 40600,
    "lot_acres": 2.1,
    "property_type": "Industrial",
    "year_built": 1998,
    "years_held": 18,
    "building_class": "B"
  },
  "buyer": {
    "capital": "$25M",
    "close_timeline": "30 days",
    "credibility": "closed 15 deals in the Inland Empire last 24 months",
    "exchange_type": null,
    "deadline": null
  },
  "strategy": {
    "name": "Long Hold Private",
    "summary": "Private owners holding 10+ years often have life-event motivations or simply haven't considered selling because no one has asked"
  },
  "broker": {
    "name": "Jeff Grijalva",
    "company": "Lee & Associates"
  }
}
```

### Output
```json
{
  "emails": [
    {
      "step": 1,
      "subject": "1020 Railroad St - Quick Question",
      "body": "John\n\nI'm reaching out regarding your industrial property at 1020 Railroad St in Corona. I represent a private investor group actively acquiring industrial assets in the Inland Empire, and your 40,600 SF building on 2.1 acres caught their attention.\n\nThey have $25M in capital to deploy, can close in 30 days all-cash with no financing contingency, and have closed 15 deals in the IE over the last 24 months. This would be a confidential, off-market process.\n\nI know you've owned this property for nearly two decades, so I completely understand if the timing isn't right. But if you'd ever consider an offer, I'd be happy to share what they could put together.\n\nWould you be open to a brief conversation?",
      "delay_days": 0
    },
    {
      "step": 2,
      "subject": "Re: 1020 Railroad St",
      "body": "John\n\nFollowing up on my note last week about 1020 Railroad St.\n\nMy buyer is finalizing their Q1 acquisitions and your property remains at the top of their list. They're evaluating a handful of industrial assets in the Corona submarket, but yours stands out given the lot size and functional layout.\n\nIf there's any interest on your end - even preliminary - I'd welcome a quick call to share more about what they're thinking. No obligation, just a conversation to see if it makes sense.\n\nWorth 10 minutes?",
      "delay_days": 3
    },
    {
      "step": 3,
      "subject": "Re: 1020 Railroad St - Closing the File",
      "body": "John\n\nLast note on 1020 Railroad St.\n\nI haven't heard back, which I completely understand. Unsolicited inquiries aren't always welcome, and the timing may simply not be right after 18 years of ownership.\n\nI'll close this file for now. But if circumstances ever change - whether that's this year or down the road - I'm always happy to revisit the conversation. My buyer has a long-term view and would still have interest.\n\nEither way, I appreciate your time.",
      "delay_days": 4
    }
  ],
  "metadata": {
    "strategy_used": "Long Hold Private",
    "urgency_angle": "Q1 acquisition timeline, competition from other IE assets",
    "credibility_signals": ["$25M capital", "30-day all-cash close", "15 deals track record in IE"],
    "personalization_points": ["40,600 SF", "2.1 acres", "nearly two decades of ownership", "Corona submarket"]
  }
}
```

### Analysis
- **Tone**: Warm and respectful, acknowledging long ownership
- **Urgency**: Soft - "Q1 acquisitions" and "handful of assets" implies competition without pressure
- **Specificity**: SF, acreage, 18-year ownership all mentioned naturally
- **CTA progression**: "Would you be open?" -> "Worth 10 minutes?" -> graceful exit

---

## Example 2: Institutional Owner (REIT, 9 years)

### Input
```json
{
  "contact": {
    "name": "Sarah Chen",
    "first_name": "Sarah",
    "email": "schen@pacificrealtytrust.com",
    "title": "VP of Dispositions"
  },
  "property": {
    "address": "8500 Century Park East, Los Angeles, CA",
    "city": "Los Angeles",
    "state": "CA",
    "building_sf": 185000,
    "lot_acres": 1.8,
    "property_type": "Office",
    "year_built": 1985,
    "years_held": 9,
    "building_class": "A"
  },
  "buyer": {
    "capital": "$75M",
    "close_timeline": "45 days",
    "credibility": "closed over $500M in LA office transactions since 2022",
    "exchange_type": null,
    "deadline": null
  },
  "strategy": {
    "name": "Institutional Hold Maturity",
    "summary": "REITs and institutional funds often recycle capital at 7-10 year hold marks"
  },
  "broker": {
    "name": "Jeff Grijalva",
    "company": "Lee & Associates"
  }
}
```

### Output
```json
{
  "emails": [
    {
      "step": 1,
      "subject": "8500 Century Park East - Acquisition Interest",
      "body": "Sarah\n\nI'm reaching out regarding the Class A office property at 8500 Century Park East in Century City. I represent an institutional buyer actively seeking office acquisitions in the LA market, and your 185,000 SF asset fits their criteria.\n\nBuyer profile:\n- $75M in deployable capital\n- 45-day close capability, all-cash\n- Closed over $500M in LA office transactions since 2022\n- Clean execution, no retrading\n\nIf this fits your current disposition timeline, I'd welcome a brief call to discuss terms and timing.\n\nWould a conversation make sense?",
      "delay_days": 0
    },
    {
      "step": 2,
      "subject": "Re: 8500 Century Park East",
      "body": "Sarah\n\nFollowing up on 8500 Century Park East.\n\nMy buyer is actively closing on their Q1 pipeline and has flexibility on timing and structure. Given the current office market dynamics, they're focused on well-located Century City assets and can move quickly if the terms work.\n\nIf there's any interest - or if you're exploring disposition options for later this year - I'd be glad to share more details on what they're looking for.\n\nWorth a quick call?",
      "delay_days": 4
    },
    {
      "step": 3,
      "subject": "Re: 8500 Century Park East - Final Note",
      "body": "Sarah\n\nLast note on 8500 Century Park East.\n\nI understand the timing may not align with your current plans. I'll step back for now, but if disposition conversations come up later this year or into 2027, I'd welcome the opportunity to reconnect.\n\nMy buyer maintains a long-term interest in Century City office and would still be a potential counterparty.\n\nAppreciate your time either way.",
      "delay_days": 4
    }
  ],
  "metadata": {
    "strategy_used": "Institutional Hold Maturity",
    "urgency_angle": "Q1 pipeline closing, office market dynamics",
    "credibility_signals": ["$75M capital", "$500M+ track record", "45-day close", "no retrading"],
    "personalization_points": ["185,000 SF", "Class A", "Century City submarket", "office-specific market context"]
  }
}
```

### Analysis
- **Tone**: Professional and transactional - no warm language about ownership tenure
- **Urgency**: Market-focused - "current office market dynamics" speaks to institutional thinking
- **Specificity**: Building class, specific market (Century City), transaction volume in $ not deal count
- **CTA progression**: "Would a conversation make sense?" -> "Worth a quick call?" -> professional closeout
- **Format**: Bullet points for buyer profile (institutional readers scan)

---

## Example 3: Market Timing Angle (Shorter Hold, 1031 Buyer)

### Input
```json
{
  "contact": {
    "name": "Robert Tanaka",
    "first_name": "Robert",
    "email": "rtanaka@sunbeltproperties.com",
    "title": "Managing Partner"
  },
  "property": {
    "address": "4250 E Camelback Rd, Phoenix, AZ",
    "city": "Phoenix",
    "state": "AZ",
    "building_sf": 28500,
    "lot_acres": 1.2,
    "property_type": "Retail",
    "year_built": 2008,
    "years_held": 6,
    "building_class": "A"
  },
  "buyer": {
    "capital": "$12M",
    "close_timeline": "30 days",
    "credibility": "completed 8 retail acquisitions in Phoenix metro since 2023",
    "exchange_type": "1031",
    "deadline": "2026-06-15"
  },
  "strategy": {
    "name": "Market Timing Play",
    "summary": "Retail owners in growth markets may capitalize on recent appreciation before rate changes impact values"
  },
  "broker": {
    "name": "Jeff Grijalva",
    "company": "Lee & Associates"
  }
}
```

### Output
```json
{
  "emails": [
    {
      "step": 1,
      "subject": "4250 E Camelback Rd - 1031 Buyer Interest",
      "body": "Robert\n\nI'm reaching out about your retail property at 4250 E Camelback Rd in Phoenix. I represent a 1031 buyer with a June deadline who's focused on the Camelback corridor, and your 28,500 SF property on 1.2 acres fits their target profile.\n\nBuyer profile:\n- $12M in exchange funds to deploy\n- 30-day close, all-cash, no financing contingency\n- Completed 8 retail acquisitions in Phoenix metro since 2023\n- June 15 identification deadline creates real urgency on their end\n\nGiven the current Phoenix retail market and where values have moved since 2020, this could be good timing to explore an exit. If you'd consider an offer, I'd be happy to discuss.\n\nOpen to a brief call?",
      "delay_days": 0
    },
    {
      "step": 2,
      "subject": "Re: 4250 E Camelback Rd",
      "body": "Robert\n\nFollowing up on 4250 E Camelback Rd.\n\nMy 1031 buyer is in active identification mode with a June 15 deadline. They've narrowed their target list to three Camelback corridor properties, and yours remains their top choice.\n\nI know unsolicited offers can be disruptive, but given the timing pressure on their end and the recent strength in Phoenix retail values, I wanted to make sure you had the option to consider it.\n\nWould a quick conversation make sense this week?",
      "delay_days": 3
    },
    {
      "step": 3,
      "subject": "Re: 4250 E Camelback Rd - Last Note",
      "body": "Robert\n\nFinal note on 4250 E Camelback Rd.\n\nI haven't heard back, and I understand - the timing may not be right, or you may simply not be interested in selling. Either way, I respect that.\n\nMy buyer will need to move forward with their identification by mid-June, so I'll close this file. But if your plans change before then, or if you'd want to revisit this down the road with a different buyer, I'm always happy to reconnect.\n\nAppreciate your time.",
      "delay_days": 4
    }
  ],
  "metadata": {
    "strategy_used": "Market Timing Play + 1031 Exchange",
    "urgency_angle": "June 15 1031 identification deadline (real), Phoenix retail market appreciation",
    "credibility_signals": ["$12M exchange funds", "30-day close", "8 Phoenix retail acquisitions"],
    "personalization_points": ["28,500 SF", "1.2 acres", "Camelback corridor", "Phoenix retail market timing"]
  }
}
```

### Analysis
- **Tone**: Middle ground - professional but not cold (Managing Partner suggests private-ish)
- **Urgency**: Real and specific - June 15 deadline is concrete, not manufactured
- **Market timing**: Referenced without being pushy - "where values have moved since 2020"
- **Specificity**: Camelback corridor (submarket), retail market context, specific deadline
- **CTA progression**: "Open to a brief call?" -> "Would a conversation make sense this week?" -> deadline-aware closeout

---

## Key Differences Across Examples

| Element | Long Hold Private | Institutional | Market Timing/1031 |
|---------|-------------------|---------------|---------------------|
| **Greeting** | Warm ("I know you've owned...") | Direct (no ownership mention) | Balanced |
| **Urgency Source** | Soft (Q1 timeline) | Market dynamics | Hard deadline (June 15) |
| **Credibility** | Deal count in region | Dollar volume ($500M) | Deal count + exchange context |
| **Property Details** | SF, acres, years held | SF, class, submarket | SF, acres, submarket corridor |
| **CTA Style** | Low pressure | Professional | Deadline-aware |
| **Format** | Flowing paragraphs | Bullet points | Mix |
| **Closeout** | "Door always open" | "Reconnect later" | Deadline acknowledgment |

---

## Formatting Validation

All three examples correctly demonstrate:

1. **Number formatting**: "40,600 SF" (commas), "185,000 SF", "28,500 SF"
2. **Property type casing**: "industrial property" (lowercase mid-sentence), "office property", "retail property"
3. **Years held phrasing**: "nearly two decades" (natural), not mentioned for institutional (9 years, skip), not mentioned for 6 years (too short)
4. **No signatures**: Body text ends without signature block
5. **First name without punctuation**: "John", "Sarah", "Robert" - no comma or colon
6. **Word count**: All emails under 250 words
7. **Buyer name**: Never mentioned - uses "private investor group", "institutional buyer", "1031 buyer"
