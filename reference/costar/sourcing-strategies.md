# CoStar Sourcing Strategies

Plays for identifying motivated off-market sellers using CoStar property search filters.

## Executable Plays (CoStar Queryable)

### Hold Period Plays

| Play | Description | CoStar Filters |
|------|-------------|----------------|
| **Institutional Hold Maturity** | Institutions avg 7.6yr hold | `OwnerTypes: [3,6,7,10,13,16,17,22,24,25]` + `LastSoldDate: 5-8+ yrs ago` |
| **Private Long Hold** | Private owners 10+ yrs | `OwnerTypes: [1,2,4,5,8,9,11,12,14,15,18,19,20,21,23]` + `LastSoldDate: 10+ yrs ago` |
| **PE/Fund Exit Window** | PE funds 7-10yr life | `OwnerTypes: [16]` (Investment Manager) + `LastSoldDate: 5-10 yrs ago` |
| **REIT Capital Recycling** | REITs divesting non-core | `OwnerTypes: [17,24,25]` (REIT types) + `LastSoldDate: 5+ yrs ago` |

### Financial Distress Plays

| Play | Description | CoStar Filters |
|------|-------------|----------------|
| **Loan Maturity Wall** | Loans maturing soon | `Loan.HasLoan: true` + `Loan.MaturityDate: next 12-24 months` |
| **CMBS Special Servicing** | Distressed CMBS loans | `Loan.SpecialServicingStatuses: [1]` (Current) |
| **CMBS Watchlist** | Loans on watchlist | `Loan.WatchlistStatuses: [1]` (Current) |
| **Modified Loan** | Previously troubled | `Loan.IsModification: true` |
| **Rate Shock Risk** | Low fixed rate maturing | `Loan.InterestRateTypes: [1]` (Fixed) + `Loan.InterestRate: <5%` + `Loan.MaturityDate: soon` |
| **High LTV Stress** | Overleveraged | `Loan.LtvCurrent: >70%` |
| **Low DSCR Stress** | Weak cash flow coverage | `Loan.DscrCurrent: <1.2` |
| **Balloon Maturity** | Large payment due | `Loan.IsBalloonMaturity: true` + `Loan.MaturityDate: soon` |
| **Delinquent Loans** | 30-90+ days late | `Loan.PaymentStatuses: [2,3,4]` |
| **Maturity Default** | Failed to refinance | `Loan.PaymentStatuses: [5]` |
| **In Foreclosure** | Active foreclosure | `Loan.PaymentStatuses: [6]` |
| **Bankrupt** | Owner bankruptcy | `Loan.PaymentStatuses: [8]` |
| **REO** | Bank-owned | `Loan.PaymentStatuses: [9]` |
| **All Distressed** | Any distress signal | `Loan.PaymentStatuses: [2,3,4,5,6,8,9]` |

### Property Distress Plays

| Play | Description | CoStar Filters |
|------|-------------|----------------|
| **High Vacancy** | Cash flow pressure | `Building.PercentLeased: <75%` |
| **Deferred Maintenance** | Aging assets | `Building.BuiltEventDate: 25+ yrs ago` + `BuildingClasses: ["B","C"]` |
| **Owner-Occupied Exit** | Sale-leaseback candidates | `Property.IsOwnerOccupied: true` |

### Equity Plays

| Play | Description | CoStar Filters |
|------|-------------|----------------|
| **Appreciation Play** | Bought cheap, now valuable | `LastSoldDate: 5-10 yrs ago` + `LastSoldPrice: low` + use analytics for current $/SF |
| **Low Basis Long Hold** | Maximum unrealized gains | `LastSoldDate: 15+ yrs ago` + `LastSoldPrice: <$X` |

---

## Play Combinations (Stacked Signals)

Higher conversion when multiple signals present:

### Distressed CMBS + Maturity
```json
{
  "Property": {
    "Loan": {
      "HasLoan": true,
      "MaturityDate": { "Minimum": "2026-01-01", "Maximum": "2027-01-01" },
      "SpecialServicingStatuses": [1],
      "WatchlistStatuses": [1]
    }
  }
}
```

### Long Hold Private + Older Building
```json
{
  "Property": {
    "OwnerTypes": [1, 2, 4, 5],
    "LastSoldDate": { "Maximum": "2016-01-01T00:00:00.000Z" },
    "Building": {
      "BuiltEventDate": { "Maximum": { "Month": 12, "Year": "2000" } },
      "BuildingClasses": ["B", "C"]
    }
  }
}
```

### Institutional + Loan Maturity + High Vacancy
```json
{
  "Property": {
    "OwnerTypes": [3, 6, 7, 10, 13],
    "Building": {
      "PercentLeased": { "Maximum": "75" }
    },
    "Loan": {
      "HasLoan": true,
      "MaturityDate": { "Minimum": "2026-01-01", "Maximum": "2027-06-01" }
    }
  }
}
```

### Maximum Distress (Foreclosure + Special Servicing + Delinquent)
```json
{
  "Property": {
    "Loan": {
      "HasLoan": true,
      "PaymentStatuses": [4, 5, 6, 8],
      "SpecialServicingStatuses": [1],
      "LtvCurrent": { "Minimum": "80", "Maximum": "999" },
      "DscrCurrent": { "Minimum": "0.01", "Maximum": "1.1" }
    }
  }
}
```

### Loan Maturity Wall (2026)
```json
{
  "Property": {
    "Loan": {
      "HasLoan": true,
      "MaturityDate": {
        "Minimum": "2026-01-01T00:00:00.000Z",
        "Maximum": "2026-12-31T00:00:00.000Z"
      },
      "InterestRateTypes": [1],
      "InterestRate": { "Minimum": "0", "Maximum": "5" },
      "IsBalloonMaturity": true
    }
  }
}
```

---

## Not Queryable via Property Search

| Play | Data Source | Notes |
|------|-------------|-------|
| **Lease Rollover Risk** | CoStar Lease Comps / Public Records | Data exists in CoStar but separate from property search. Future enhancement. |
| **Anchor Tenant Departure** | CoStar Lease Comps / News | Could cross-reference tenant data. |
| Tax Delinquency | County tax records | External data needed |
| Estate/Probate | Court records, obituaries | External data needed |
| Partnership Dissolution | Secretary of State filings | External data needed |
| Owner Age/Retirement | Public records, LinkedIn | External data needed |
| Divorce/Life Events | Court records | External data needed |
| Absentee Owner | Reonomy (has owner address vs property) | External data needed |
| Code Violations | Municipal records | External data needed |

*Note: Pre-Foreclosure/NOD is now queryable via `Loan.PaymentStatuses: [6]` (In Foreclosure)*

### Future: Lease Rollover Integration
CoStar has lease data via Lease Comps and Public Records. Key fields to capture when available:
- Lease Expiration Date
- WALT (Weighted Average Lease Term)
- % of SF/Income expiring in 12-24 months
- Tenant names and credit quality
- In-place rent vs market rent

---

## Owner Type Reference

**Institutional (short hold 5-8yr):**
- 3: Corporate
- 6: Equity Fund
- 7: Finance
- 10: Insurance
- 13: Listed Fund
- 16: Investment Manager
- 17: REIT
- 22: Bank
- 24: Public REIT
- 25: Private REIT

**Private (long hold 10+yr):**
- 1: Individual
- 2: User/Other
- 4: Developer
- 5: Educational
- 8: Government
- 9: Non-Profit
- 11: Healthcare System
- 12: Religious
- 14: Private
- 15: Trust
- 18-21: Various private types

See `lookups/owner-types.json` for complete mapping.
