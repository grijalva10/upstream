# Email Thread UI Redesign

## Overview

Clean up the email thread display in the lead detail page. Make sent vs received emails clearly distinguishable, increase body preview length, and add breathing room with an Anthropic-style minimal design.

## Current Problems

1. **Can't tell sent vs received apart** - Small "In/Out" badges aren't clear enough
2. **Previews too short** - Only 150 chars, can't read enough context
3. **Layout cluttered** - Too much crammed into small space

## Design

### Structure

Vertically-stacked conversation view. Messages in chronological order (oldest first) so you read top-to-bottom.

**Collapsed thread card:**
```
┌─────────────────────────────────────────┐
│ 📧  Re: Industrial Property on Main St  │
│     You and John Smith · 4 messages     │
│     Last reply: Yesterday               │
│                                    ▶    │
└─────────────────────────────────────────┘
```

**Expanded thread:**
```
┌─────────────────────────────────────────┐
│  Re: Industrial Property on Main St     │
│  You and John Smith · 4 messages        │
├─────────────────────────────────────────┤
│                                         │
│  ┃ John Smith · Jan 15, 2:30 PM        │
│  ┃ Thanks for reaching out. We're not  │
│  ┃ actively marketing but I'd be open  │
│  ┃ to hearing what you have in mind... │
│                                         │
│  ┃ You · Jan 15, 4:15 PM               │  ← blue-gray bg
│  ┃ Appreciate the response. My client  │
│  ┃ is looking for industrial assets... │
│                                         │
└─────────────────────────────────────────┘
```

### Visual Styling

**Message differentiation:**

| Sender | Left Border | Background | Label |
|--------|-------------|------------|-------|
| Them | `slate-200` | white | Their name (bold) |
| You | `blue-400` | `blue-50/50` | "You" (bold) |

**Typography:**
- Sender name: bold, text-sm
- Timestamp: muted, text-xs, after sender name
- Body: regular weight, text-sm, line-height 1.6

**Smart truncation:**
- Under 500 chars: show full message
- Over 500 chars: show first ~300 chars with "Show more" link
- Expand inline, persists while thread open

**Spacing:**
- 16px gap between messages
- 12px padding inside message blocks
- 16px padding in thread container

### Interaction

- Entire collapsed card clickable to toggle
- Chevron rotates on expand
- Smooth height animation
- Internal scroll if content exceeds ~400px height

## Implementation

### Data Changes

In `page.tsx` line 265, change:
```typescript
body_preview: e.body_text?.slice(0, 150),
```
to:
```typescript
body_text: e.body_text,  // Full text for smart truncation
```

### Component Changes

Replace `EmailThreadItem` in `activity-timeline.tsx` with new design:

1. Extract participant names for header
2. New collapsed/expanded states
3. Message blocks with left border styling
4. Smart truncation with "Show more"

### Files to Modify

| File | Change |
|------|--------|
| `apps/web/src/app/(app)/leads/[id]/page.tsx` | Include full `body_text` in email query |
| `apps/web/src/app/(app)/leads/[id]/_components/activity-timeline.tsx` | Replace EmailThreadItem with new clean design |

No new dependencies needed.
