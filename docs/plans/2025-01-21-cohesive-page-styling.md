# Cohesive Page Styling

**Date:** 2025-01-21
**Status:** Ready for implementation

## Goal

Create visual cohesion across all pages by applying the dashboard's design language to `/leads`, `/inbox`, `/searches`, and `/campaigns`.

## Problem

Currently there's no through-line between pages:
- Dashboard uses compact uppercase headers, monospace stats, status dots
- Other pages use title case headers, regular fonts, Badge components
- Mixed width constraints and spacing patterns

## Approach

1. Create small reusable components that encode dashboard patterns
2. Update `PageContainer` to full-width by default
3. Apply consistent styling across all list/table pages

## Design System Components

### StatusDot

Status indicator with colored dot and optional label.

```tsx
// components/ui/status-dot.tsx
interface StatusDotProps {
  status: string;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "default";
}

// Usage
<StatusDot status="active" />              // ●
<StatusDot status="active" showLabel />    // ● active
<StatusDot status="paused" label="3 hot" /> // ○ 3 hot
```

**Status → Color mapping:**
| Status | Color | Dot |
|--------|-------|-----|
| `active`, `healthy`, `completed`, `qualified`, `handed_off` | emerald-500 | ● |
| `paused`, `warning`, `snoozed`, `hot`, `engaged`, `waiting` | amber-500 | ○ |
| `error`, `failed`, `closed`, `bounced`, `dnc` | red-500 | ● |
| `draft`, `new`, `idle`, `pending`, `contacted`, `replied` | zinc-500 | ● |
| `scheduled` | blue-500 | ◷ |

### SectionHeader

Uppercase section header with optional count and action.

```tsx
// components/ui/section-header.tsx
interface SectionHeaderProps {
  children: React.ReactNode;
  count?: number;
  action?: React.ReactNode;
}

// Usage
<SectionHeader>Leads</SectionHeader>
<SectionHeader count={247}>Leads</SectionHeader>
<SectionHeader count={12} action={<Button size="icon-sm"><Plus /></Button>}>
  Campaigns
</SectionHeader>
```

**Styling:**
- Title: `text-xs font-medium text-muted-foreground uppercase tracking-wider`
- Count: `text-xs font-mono text-muted-foreground`

### StatValue

Monospace number/stat display.

```tsx
// components/ui/stat-value.tsx
interface StatValueProps {
  children: React.ReactNode;
  muted?: boolean;
}

// Usage
<StatValue>247</StatValue>
<StatValue muted>12/45</StatValue>
```

**Styling:**
- Base: `text-xs font-mono`
- Muted: `text-muted-foreground`

## Layout Changes

### PageContainer

Change default to full-width:

```tsx
// components/layout/page-container.tsx
const variantStyles: Record<PageContainerVariant, string> = {
  default: "px-4 sm:px-6 py-6",                          // Full width (NEW)
  narrow: "px-4 sm:px-6 py-6 max-w-3xl mx-auto",
  constrained: "px-4 sm:px-6 py-6 max-w-6xl mx-auto",   // Old default
  "full-bleed": "h-full",
};
```

### PageHeader

Support compact dashboard-style headers:

```tsx
// In page-setup.tsx files, update to:
<PageHeader>
  <PageHeaderLeft>
    <SectionHeader count={count}>Leads</SectionHeader>
  </PageHeaderLeft>
  <PageHeaderRight>
    {/* actions */}
  </PageHeaderRight>
</PageHeader>
```

## Page-Specific Changes

### /leads

| Element | Current | New |
|---------|---------|-----|
| Status column | `<Badge>` with color classes | `<StatusDot status={status} showLabel />` |
| Page title | `text-lg font-semibold` | `<SectionHeader count={count}>` |
| Contact/property counts | Plain text | `<StatValue>` |
| Table row hover | Default | `hover:bg-muted/50` |

### /inbox

| Element | Current | New |
|---------|---------|-----|
| Page header | Custom `InboxHeader` | Use `<SectionHeader>` |
| Tab border | `border-b` | `border-border/50` |
| Classification badges | Text | `<StatusDot>` for hot/question/pass |

### /searches

| Element | Current | New |
|---------|---------|-----|
| Status column | Text | `<StatusDot status={status} showLabel />` |
| Property/lead counts | Plain numbers | `<StatValue>` |

### /campaigns

| Element | Current | New |
|---------|---------|-----|
| Status column | Text | `<StatusDot status={status} showLabel />` |
| Enrolled/replied stats | Plain text | `<StatValue muted>12/45</StatValue>` |
| Reply rate | Plain text | `<StatValue>27%</StatValue>` |

## DataTable Updates

Update shared `DataTable` component:

1. Header row already uses `bg-muted/30` - keep
2. Add helper for rendering status columns with `StatusDot`
3. Add helper for rendering stat columns with `StatValue`
4. Ensure row hover is `hover:bg-muted/50`

## Files to Create

```
apps/web/src/components/ui/status-dot.tsx
apps/web/src/components/ui/section-header.tsx
apps/web/src/components/ui/stat-value.tsx
```

## Files to Modify

```
apps/web/src/components/layout/page-container.tsx
apps/web/src/app/(app)/leads/page.tsx
apps/web/src/app/(app)/leads/_components/page-setup.tsx
apps/web/src/app/(app)/inbox/_components/page-setup.tsx
apps/web/src/app/(app)/inbox/_components/task-tabs.tsx
apps/web/src/app/(app)/searches/_components/columns.tsx
apps/web/src/app/(app)/searches/_components/page-setup.tsx
apps/web/src/app/(app)/campaigns/page.tsx
apps/web/src/app/(app)/campaigns/_components/page-setup.tsx
apps/web/src/app/(app)/data/_components/data-table.tsx
```

## Out of Scope

- Dashboard changes (it's the reference, not being modified)
- Page layout restructuring (tables stay tables)
- New functionality
- Detail pages (lead/[id], campaign/[id], etc.)

## Testing

1. Visual comparison: each page should feel like it belongs with the dashboard
2. Responsive: full-width tables should still work on mobile (horizontal scroll)
3. Functionality: no behavior changes, just styling
