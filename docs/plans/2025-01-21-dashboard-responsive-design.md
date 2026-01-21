# Dashboard Responsive Design

**Date:** 2025-01-21
**Status:** Ready for implementation

## Goal

Make `/dashboard` (Mission Control) work well on all screen sizes:
- **Mobile:** Quick status checks — see urgent items, system health
- **Tablet:** Full functionality — work from an iPad with all panels accessible
- **Desktop:** Current 3-column layout unchanged

## Approach

Responsive CSS Grid using Tailwind breakpoints. Same components, different arrangements per breakpoint.

## Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 768px | Single column, vertical stack |
| Tablet | md: 768px - 1024px | 2-column grid |
| Desktop | lg: 1024px+ | 3-column layout (current) |

## Layout Structure

### Mobile (default)
```
┌─────────────┐
│  Attention  │
├─────────────┤
│  Pipeline   │
├─────────────┤
│    Jobs     │
├─────────────┤
│  Searches   │
├─────────────┤
│  Campaigns  │
└─────────────┘
```

### Tablet (md)
```
┌───────────┬───────────┐
│ Attention │  Pipeline │
├───────────┼───────────┤
│   Jobs    │ Searches  │
├───────────┴───────────┤
│      Campaigns        │
└───────────────────────┘
```

### Desktop (lg)
```
┌───────────┬───────────┬─────────────┐
│ Attention │  Pipeline │             │
├───────────┼───────────┤  Campaigns  │
│   Jobs    │ Searches  │             │
└───────────┴───────────┴─────────────┘
```

## Implementation Details

### 1. MissionControl Grid (`mission-control.tsx`)

**Current:**
```tsx
<div className="flex-1 grid grid-cols-[1fr_1fr_1.2fr] grid-rows-[1fr_1fr] gap-px bg-border/30 min-h-0">
```

**New:**
```tsx
<div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr] md:grid-rows-[1fr_1fr_auto] lg:grid-rows-[1fr_1fr] gap-px bg-border/30 min-h-0 overflow-y-auto lg:overflow-hidden">
```

**Panel wrapper changes:**

```tsx
{/* Attention - Row 1, Col 1 on tablet/desktop */}
<div className="bg-background p-3 md:p-4">
  <AttentionPanel items={data.attention} />
</div>

{/* Pipeline - Row 1, Col 2 on tablet/desktop */}
<div className="bg-background p-3 md:p-4">
  <PipelineFlow leadStages={data.leadStages} dealStages={data.dealStages} />
</div>

{/* Jobs - Row 2, Col 1 on tablet/desktop */}
<div className="bg-background p-3 md:p-4">
  <JobsPanel jobs={data.jobs} />
</div>

{/* Searches - Row 2, Col 2 on tablet/desktop */}
<div className="bg-background p-3 md:p-4">
  <SearchesPanel searches={data.searches} totalCount={data.searchesTotal} />
</div>

{/* Campaigns - Full width on tablet, right column spanning both rows on desktop */}
<div className="bg-background p-3 md:p-4 md:col-span-2 lg:col-span-1 lg:row-span-2 lg:row-start-1 lg:col-start-3">
  <CampaignsPanel campaigns={data.campaigns} />
</div>
```

**Container height:**
```tsx
{/* Change from h-screen to allow mobile scrolling */}
<div className="min-h-screen lg:h-screen flex flex-col bg-background">
```

### 2. PipelineFlow (`pipeline-flow.tsx`)

Handle horizontal overflow on narrow screens:

```tsx
{/* In PipelineRow, update the stages container */}
<div className="flex items-baseline gap-x-1 gap-y-0.5 flex-1 flex-wrap">
  {stages.map((stage, index) => (
    // ... existing stage rendering
  ))}
</div>
```

### 3. JobsPanel (`jobs-panel.tsx`)

Hide "next run" column on mobile:

```tsx
{/* Header */}
<div className="flex items-center gap-4 text-[10px] text-muted-foreground/50 font-mono">
  <span>last</span>
  <span className="hidden md:inline">next</span>
</div>

{/* In JobRow, hide next run on mobile */}
<span className="text-xs font-mono text-muted-foreground/60 w-16 text-right hidden md:block">
  {job.nextRun}
</span>
```

### 4. CampaignsPanel (`campaigns-panel.tsx`)

2-column grid on tablet when full-width:

```tsx
{/* Update the campaigns list container */}
<div className="space-y-1 md:grid md:grid-cols-2 md:gap-2 md:space-y-0 lg:grid-cols-1 lg:gap-0 lg:space-y-1">
  {campaigns.map((campaign) => (
    // ... existing campaign card
  ))}
</div>
```

### 5. ServicesBar (`services-bar.tsx`)

Compact mode on mobile — hide detail text:

```tsx
{/* For each service */}
<div className="flex items-center gap-2">
  <span className={cn("w-1.5 h-1.5 rounded-full", statusColors[service.status])} />
  <span className="text-xs">{service.name}</span>
  <span className="text-xs text-muted-foreground hidden md:inline">{service.detail}</span>
</div>
```

### 6. HeaderBar (`header-bar.tsx`)

Responsive text sizing:

```tsx
{/* Any titles */}
<span className="text-sm md:text-base font-medium">Mission Control</span>
```

## Touch Targets

Ensure minimum 44px touch targets on mobile:
- Job rows: `py-2` provides adequate height
- Campaign items: `py-2` provides adequate height
- Buttons: Already using proper sizing via shadcn

## Files to Modify

1. `apps/web/src/app/(app)/dashboard/_components/mission-control.tsx` - Grid layout
2. `apps/web/src/app/(app)/dashboard/_components/pipeline-flow.tsx` - Flex wrap
3. `apps/web/src/app/(app)/dashboard/_components/jobs-panel.tsx` - Hide next column
4. `apps/web/src/app/(app)/dashboard/_components/campaigns-panel.tsx` - 2-col grid
5. `apps/web/src/app/(app)/dashboard/_components/services-bar.tsx` - Compact mode
6. `apps/web/src/app/(app)/dashboard/_components/header-bar.tsx` - Text sizing

## Testing

- Chrome DevTools device toolbar: iPhone SE, iPad, Desktop
- Verify all panels visible and functional at each breakpoint
- Check that urgent attention items remain prominent on mobile
- Confirm scroll behavior works on mobile/tablet
