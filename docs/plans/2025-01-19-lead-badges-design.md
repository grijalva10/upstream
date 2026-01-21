# Lead Badges Redesign

## Problem

Status and Type badges for leads need better visual distinction. Currently:
- Status badges have colors but some overlap (Pass/Rejected both gray, Blue/Cyan similar)
- Type has no visual styling - just plain text

## Design

### Status Badges (Primary)

Filled colored pills with semantic colors. These are the primary visual element for quick pipeline scanning.

| Status | Color | Tailwind Classes |
|--------|-------|------------------|
| New | Slate | `bg-slate-100 text-slate-700` |
| Contacted | Blue | `bg-blue-100 text-blue-700` |
| Engaged | Amber | `bg-amber-100 text-amber-700` |
| Qualified | Green | `bg-green-100 text-green-700` |
| Handed Off | Purple | `bg-purple-100 text-purple-700` |
| Nurture | Teal | `bg-teal-100 text-teal-700` |
| Pass | Gray | `bg-gray-100 text-gray-500` |
| Rejected | Orange | `bg-orange-100 text-orange-700` |
| DNC | Red | `bg-red-100 text-red-700` |

**Status meanings clarified:**
- Pass = "not a fit right now" (neutral, could revisit)
- Rejected = "hard no from us" (negative, won't revisit)
- DNC = "they requested no contact" (compliance)

### Type Badges (Secondary)

Icon + text with subtle gray background. Secondary visual element for filtering/categorization.

| Type | Icon (Lucide) |
|------|---------------|
| Owner | Building2 |
| Tenant | Key |
| Buyer | Wallet |
| Broker | Briefcase |
| Lender | Landmark |
| Vendor | Wrench |
| Other | MoreHorizontal |

**Styling:**
- Background: `bg-gray-100`
- Text: `text-gray-600`
- Icon: `h-3 w-3` same color as text
- Shape: Rounded pill (`rounded-md`)
- Padding: `px-2 py-0.5`

## Files to Update

1. **`apps/web/src/app/(app)/leads/[id]/_components/status-select.tsx`**
   - Update `statusStyles` object with new colors (teal for Nurture, orange for Rejected)

2. **`apps/web/src/app/(app)/leads/[id]/_components/type-select.tsx`**
   - Add icon mapping constant
   - Add gray pill background styling to trigger
   - Import Lucide icons

3. **`apps/web/src/app/(app)/leads/page.tsx`**
   - Update `getStatusColor()` function with new colors
   - Change Type column from plain text to badge with icon

## Visual Hierarchy

- Status = bold colored pills (primary, for pipeline tracking)
- Type = subtle gray pills with icons (secondary, for filtering)
