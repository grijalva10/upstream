# CoStar Payload Variables

All variables from `payload-example.json` with paths, types, and known values.

---

## Root Level

| Key | Type | Example | Purpose |
|-----|------|---------|---------|
| `0` | object | `{...}` | Main filter object |
| `1` | integer | `20` | Records per page |
| `2` | integer | `1` | Page number |
| `3` | object | `{...}` | Unit settings (constant) |
| `4` | boolean | `false` | Include estimated values |
| `5` | array | `[]` | Additional options |

---

## 0.BoundingBox

Geographic bounds for map search.

| Path | Type | Example |
|------|------|---------|
| `0.BoundingBox.UpperLeft.Latitude` | number | `53.91247753467119` |
| `0.BoundingBox.UpperLeft.Longitude` | number | `-143.14650495` |
| `0.BoundingBox.LowerRight.Latitude` | number | `14.958134245808175` |
| `0.BoundingBox.LowerRight.Longitude` | number | `-58.77150495` |

---

## 0.Geography

Market-based filtering. **Always use FilterType 132 for CoStar Markets.**

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Geography.Filter.FilterType` | integer | `132` | 132 = CoStar Market filter (always use this) |
| `0.Geography.Filter.Ids` | array[int] | `[105, 108, 421]` | `marketKeyId` values from markets-us-lookup.json |

### Market ID Examples
```
"Phoenix - AZ": 776
"Los Angeles - CA": 605
"Dallas-Fort Worth - TX": 316
"Houston - TX": 1276
"Austin - TX": 159
"Atlanta - GA": 1805
"Chicago - IL": 1264
"New York - NY": 716
"San Francisco - CA": 865
"Denver - CO": 332
```

See `markets-us-lookup.json` for full US market name → ID mapping.

### Property Type Constraints Per Market

**Each market only supports certain property types.** Check `markets-us.json` for `propertyTypeIds` per market.

| Type ID | Name | US Market Coverage |
|---------|------|-------------------|
| 1 | Hospitality | 33% (173 markets) |
| 2 | Industrial | 75% (391 markets) |
| 5 | Office | 75% (391 markets) |
| 6 | Retail | 75% (391 markets) |
| 11 | Multifamily | 75% (391 markets) |

**NOT available via market filter** (use BoundingBox instead):
- 3: Land
- 7: Flex
- 8: Sports & Entertainment
- 10: Specialty
- 12: Shopping Center
- 13: Health Care
- 15: Residential
- 31: Student

---

## 0.Property

Main property filter container.

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Property.PropertyTypes` | array[int] | `[5]` | See owner-types.json for IDs |
| `0.Property.OwnerTypes` | array[int] | `[3]` | 3 = Individual |
| `0.Property.LastSoldDate.Minimum` | string | `"2021-01-08T22:28:50.096Z"` | ISO 8601 datetime |
| `0.Property.LastSoldDate.Maximum` | string | `"2026-01-01T08:00:00.000Z"` | ISO 8601 datetime |
| `0.Property.LastSoldPrice.Minimum.Value` | integer | `1` | Price in dollars |
| `0.Property.LastSoldPrice.Minimum.Code` | string | `"USD"` | Currency code |
| `0.Property.LastSoldPrice.Maximum.Value` | integer | `999999999` | Price in dollars |
| `0.Property.LastSoldPrice.Maximum.Code` | string | `"USD"` | Currency code |

---

## 0.Property.Building

Building-specific filters (nested inside Property).

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Property.Building.BuildingArea.Minimum.Value` | integer | `5000` | Square feet |
| `0.Property.Building.BuildingArea.Minimum.Code` | string | `"[sft_i]"` | Unit code |
| `0.Property.Building.BuildingArea.Maximum.Value` | integer | `200000` | Square feet |
| `0.Property.Building.BuildingArea.Maximum.Code` | string | `"[sft_i]"` | Unit code |
| `0.Property.Building.PropertySubtypes` | array[int] | `[63]` | 63 = Loft/Creative Space |
| `0.Property.Building.ConstructionStatuses` | array[int] | `[1]` | 1 = Existing |
| `0.Property.Building.PercentLeased.Minimum` | string | `"1"` | Percentage as string |
| `0.Property.Building.PercentLeased.Maximum` | string | ? | Not in example |
| `0.Property.Building.BuiltEventDate.Minimum.Month` | integer | `1` | 1-12 |
| `0.Property.Building.BuiltEventDate.Minimum.Year` | string | `"1900"` | Year as string |
| `0.Property.Building.BuiltEventDate.Maximum.Month` | integer | `12` | 1-12 |
| `0.Property.Building.BuiltEventDate.Maximum.Year` | string | `"2026"` | Year as string |
| `0.Property.Building.YearMonthBuiltIncludeUnknown` | boolean | `true` | Include unknown year |
| `0.Property.Building.Stories.Minimum` | string | `"1"` | Number as string |
| `0.Property.Building.Stories.Maximum` | string | ? | Not in example |
| `0.Property.Building.Tenancy` | array[int] | `[2]` | 1=Single, 2=Multi (assumed) |
| `0.Property.Building.IsOwnerOccupied` | boolean | `false` | Direct boolean |
| `0.Property.Building.BuildingClasses` | array[string] | `["A", "B"]` | A, B, C, F |

---

## 0.Property.Land

Land-specific filters (nested inside Property).

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Property.Land.LandArea.Minimum.Value` | integer | `1` | Acres |
| `0.Property.Land.LandArea.Minimum.Code` | string | `"[acr_us]"` | Unit code |
| `0.Property.Land.LandArea.Maximum.Value` | integer | `9999` | Acres |
| `0.Property.Land.LandArea.Maximum.Code` | string | `"[acr_us]"` | Unit code |

---

## 0.Property.Parking

Parking filters (nested inside Property).

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Property.Parking.Spaces.Minimum` | string | `"1"` | Number as string |
| `0.Property.Parking.Spaces.Maximum` | string | ? | Not in example |

---

## 0.Sale.SaleComp

Sale comparison filters.

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.Sale.SaleComp.SaleTypes` | array[int] | `[1]` | 1=Investment, 2=Owner User |
| `0.Sale.SaleComp.Exclusions.BulkPortfolios` | integer | `1` | 1=exclude, 0=include |
| `0.Sale.SaleComp.Exclusions.MultiplePropertySales` | integer | `1` | 1=exclude, 0=include |
| `0.Sale.SaleComp.Exclusions.BusinessParkSales` | integer | `1` | 1=exclude, 0=include |
| `0.Sale.SaleComp.Exclusions.Condos` | integer | `1` | 1=exclude, 0=include |
| `0.Sale.SaleComp.Exclusions.LandValueSale` | integer | `1` | 1=exclude, 0=include |
| `0.Sale.SaleComp.IsFinancedSale` | boolean | `true` | Filter for financed sales |
| `0.Sale.SaleComp.Price.CapitalizationRate.Minimum` | string | `"1"` | Percentage as string |
| `0.Sale.SaleComp.Price.CapitalizationRate.Maximum` | string | `"20"` | Percentage as string |

---

## 0.ListingType

| Path | Type | Example | Notes |
|------|------|---------|-------|
| `0.ListingType` | integer | `0` | 0 = All? Unknown values |

---

## 3 (Unit Settings) - CONSTANT

Do not modify. Copy as-is.

```json
{
  "RateBasis": "month",
  "CurrencyCode": "USD",
  "BuildingAreaUnit": "SF",
  "secondaryAreaUnit": "SF",
  "AreaUom": "AC",
  "lengthUnit": "FT"
}
```

---

## Unknown / Needs Research

Things we don't know yet:

| Question | Where to Find |
|----------|---------------|
| What do `Tenancy` values 1, 2 mean exactly? | CoStar UI inspection |
| What other `ListingType` values exist? | Test different searches |
| Are there more `Exclusions` fields? | Test different searches |
| What fields are optional vs required? | Trial and error |

### Resolved
- ~~FilterType values~~ → `132` = CoStar Market (always use this)

---

## Type Patterns

| Pattern | Example | Fields Using It |
|---------|---------|-----------------|
| Value/Code object | `{"Value": 5000, "Code": "[sft_i]"}` | BuildingArea, LandArea, LastSoldPrice |
| Array of integers | `[1, 2, 3]` | PropertyTypes, OwnerTypes, ConstructionStatuses, Tenancy, SaleTypes |
| Array of strings | `["A", "B"]` | BuildingClasses |
| Min/Max strings | `{"Minimum": "1", "Maximum": "20"}` | PercentLeased, Stories, CapRate |
| ISO datetime | `"2021-01-08T22:28:50.096Z"` | LastSoldDate |
| Month/Year object | `{"Month": 1, "Year": "1900"}` | BuiltEventDate |
| Integer flag | `1` or `0` | All Exclusions fields |
