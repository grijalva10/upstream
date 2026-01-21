# Lead Status Filter Design

## Overview

Add a status filter dropdown to the leads table, allowing users to filter leads by a single status.

## Decisions

| Question | Decision |
|----------|----------|
| UI location | Dropdown in the "Status" column header |
| Selection mode | Single status only |
| Clear filter | Explicit "All" option at top of dropdown |
| URL persistence | Yes, `?status=<value>` query param |

## URL Structure

```
/leads?status=new&sort=last_activity&dir=desc&page=1
```

The `status` param is optional. When absent or set to "all", no filter is applied.

## Implementation

### Files to modify

- `apps/web/src/app/(app)/leads/page.tsx`

### Data Flow

1. Add `status` parameter to `getLeads()` function
2. Apply `.eq("status", status)` filter to Supabase query when status is set
3. Count automatically reflects filtered results

### UI Component

Replace status column header with dropdown:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    Status {activeFilter && <Badge>{activeFilter}</Badge>}
    <ChevronDown />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>All</DropdownMenuItem>
    <DropdownMenuSeparator />
    {STATUSES.map(status => <DropdownMenuItem>...)}
  </DropdownMenuContent>
</DropdownMenu>
```

### Status Values

```typescript
const LEAD_STATUSES = [
  "new", "contacted", "replied", "engaged",
  "waiting", "qualified", "handed_off", "nurture", "closed"
] as const;
```

### Edge Cases

- When filter reduces results below current page, reset to page 1
- Validate status param against allowed values
- Preserve sort/dir params when changing filter
