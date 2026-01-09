# CoStar Lookup Tables

Valid values for CoStar API payload fields. All files are JSON with `byId` and `byName` lookups.

## Files

| File | Payload Path | Type |
|------|--------------|------|
| `property-types.json` | `0.Property.PropertyTypes` | array[int] |
| `property-subtypes.json` | `0.Property.Building.PropertySubtypes` | array[int] |
| `owner-types.json` | `0.Property.OwnerTypes` | array[int] |
| `construction-status.json` | `0.Property.Building.ConstructionStatuses` | array[int] |
| `sale-types.json` | `0.Sale.SaleComp.SaleTypes` | array[int] |
| `building-class.json` | `0.Property.Building.BuildingClasses` | array[string] |
| `tenancy.json` | `0.Property.Building.Tenancy` | array[int] |
| `exclusions.json` | `0.Sale.SaleComp.Exclusions` | object |

## Usage

```python
import json

# Load lookup
with open('lookups/property-types.json') as f:
    prop_types = json.load(f)

# Name to ID
office_id = prop_types['byName']['Office']  # 5

# ID to Name
name = prop_types['byId']['5']  # "Office"

# Check if market filter supported
if office_id in prop_types['marketFilterSupported']:
    # Can use Geography.Filter
else:
    # Must use BoundingBox
```

## Key Constraints

- **Property Types**: Only 1,2,5,6,11 work with market filter
- **Building Class**: Uses strings `["A","B"]`, not integer IDs
- **Exclusions**: Uses integers (1=exclude, 0=include), not booleans
- **Tenancy**: Values assumed (1=Single, 2=Multi) - needs verification
