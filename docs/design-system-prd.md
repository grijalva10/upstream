# Upstream Design System PRD

> A design system for building consistent, delightful, and intelligent interfaces for the Upstream CRE platform.

**Version:** 1.0
**Last Updated:** January 2026
**Inspired By:** [Vercel Geist](https://vercel.com/geist/introduction), [Dieter Rams' 10 Principles](https://www.vitsoe.com/us/about/good-design), Agentic UI Patterns

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Core Principles](#core-principles)
3. [Design Tokens](#design-tokens)
4. [Typography](#typography)
5. [Color System](#color-system)
6. [Spacing & Layout](#spacing--layout)
7. [Shadows & Elevation](#shadows--elevation)
8. [Iconography](#iconography)
9. [Components](#components)
10. [Agentic UI Patterns](#agentic-ui-patterns)
11. [Implementation](#implementation)

---

## Design Philosophy

### From Macintosh to Agentic UI

The evolution from the Macintosh Human Interface Guidelines (1992) to modern Agentic UI represents a fundamental shift in how we design interfaces. While the original HIG focused on direct manipulation and metaphors, Agentic UI designs for autonomous, goal-driven systems that proactively assist users.

### Less, But Better

Following Dieter Rams' philosophy, our design system prioritizes:

- **Clarity over decoration** - Every element serves a purpose
- **Consistency over novelty** - Familiar patterns reduce cognitive load
- **Function over form** - Aesthetic choices support usability
- **Simplicity over complexity** - The minimum design required for the task

### The Upstream Aesthetic

Our visual language reflects the precision and professionalism of commercial real estate while embracing the efficiency of AI-powered workflows:

- Clean, structured layouts that mirror deal documentation
- High contrast for scanability during fast-paced operations
- Purposeful use of color to communicate status and priority
- Generous whitespace for focused, distraction-free work

---

## Core Principles

### 1. Good Design is Innovative

Upstream pushes boundaries in CRE deal sourcing. Our interface should feel modern and capable without being experimental to the point of confusion.

### 2. Good Design is Useful

Every interface element must serve the user's goal: finding off-market deals faster. No decorative elements that don't contribute to workflow efficiency.

### 3. Good Design Makes a Product Understandable

Complex agent behaviors and pipeline states should be immediately comprehensible. The interface explains itself through clear visual hierarchy and meaningful feedback.

### 4. Good Design is Honest

- Never hide agent actions from users
- Show confidence scores and reasoning transparently
- Communicate processing states accurately
- Don't promise capabilities that don't exist

### 5. Good Design is Unobtrusive

The interface should recede, letting users focus on deals and relationships. Agents work in the background; the UI surfaces results without demanding attention.

### 6. Good Design is Consistent in Every Detail

- Same interaction patterns across all modules
- Unified visual language from dashboard to email composer
- Predictable component behavior throughout

### 7. Good Design is Long-Lasting

Avoid trendy design patterns. Build interfaces that will feel professional and usable for years, not months.

### 8. Good Design is as Little Design as Possible

Concentrate on essential aspects. If an element can be removed without loss of function, remove it.

---

## Design Tokens

Design tokens are the atomic values that define our visual language. They enable consistency across platforms and make systematic updates possible.

### Token Architecture

```
tokens/
├── primitives/       # Raw values (colors, sizes)
├── semantic/         # Contextual meaning (bg-primary, text-muted)
└── component/        # Component-specific tokens
```

### Naming Convention

```
{category}-{property}-{variant}-{state}

Examples:
- color-bg-primary
- color-text-muted
- spacing-component-gap
- radius-button-default
```

---

## Typography

### Font Family

**Primary:** Geist Sans
**Monospace:** Geist Mono
**Weight:** Semibold for headings, Regular for body

Geist embodies the Swiss design movement's principles: precision, clarity, and functionality. Its geometric letterforms enhance readability in data-dense interfaces.

### Type Scale

| Token | Size | Line Height | Weight | Use Case |
|-------|------|-------------|--------|----------|
| `display-2xl` | 72px | 1.0 | 600 | Hero headlines |
| `display-xl` | 60px | 1.0 | 600 | Page titles |
| `display-lg` | 48px | 1.1 | 600 | Section headers |
| `heading-xl` | 36px | 1.2 | 600 | Card titles (large) |
| `heading-lg` | 30px | 1.3 | 600 | Card titles |
| `heading-md` | 24px | 1.3 | 600 | Subsection headers |
| `heading-sm` | 20px | 1.4 | 600 | Group labels |
| `body-lg` | 18px | 1.5 | 400 | Lead paragraphs |
| `body-md` | 16px | 1.5 | 400 | Default body text |
| `body-sm` | 14px | 1.5 | 400 | Secondary text |
| `caption` | 12px | 1.4 | 400 | Labels, metadata |
| `overline` | 11px | 1.3 | 500 | Category labels (uppercase) |

### Typography Principles

**Visual Hierarchy**

A thoughtful hierarchy within type styles draws users through content in a logical manner. Combined with proper spacing, it creates entry points for the reader, making text easier to scan and comprehend.

```
┌─────────────────────────────────────┐
│  ● HEADING (entry point)            │
│  ━━━━━━━━━━━━━━━━━━━                │
│  ───────────────────────────        │
│  ───────────────────                │
│                                     │
│     ● SUBHEADING (entry point)      │
│     ━━━━━━━━━━━━━                   │
│     ─────────────────────           │
│     ─────────────────               │
└─────────────────────────────────────┘
```

**Guidelines**

- Prefer curly quotes (" ") over straight quotes (" ")
- Use tabular numbers for data comparisons: `font-variant-numeric: tabular-nums`
- Separate numbers and units with a non-breaking space (e.g., "10 MB" not "10MB")
- Maximum line length: 65-75 characters for readability

---

## Color System

### Semantic Colors (Light/Dark Mode)

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `bg-primary` | `#FFFFFF` | `#000000` | Main background |
| `bg-secondary` | `#F7F7F7` | `#191919` | Card backgrounds |
| `bg-tertiary` | `#E5E5E5` | `#363636` | Subtle backgrounds |
| `bg-elevated` | `#FFFFFF` | `#191919` | Floating elements |
| `text-primary` | `#000000` | `#FFFFFF` | Main text |
| `text-secondary` | `#666666` | `#A3A3A3` | Supporting text |
| `text-muted` | `#999999` | `#707070` | Disabled/placeholder |
| `border-default` | `#E5E5E5` | `#363636` | Default borders |
| `border-subtle` | `#F0F0F0` | `#262626` | Subtle separators |

### Accent Colors

| Color | Token Range | Primary (500) | Purpose |
|-------|-------------|---------------|---------|
| **Blue** | `B100-B800` | `#0568F6` (light) / `#4D93FC` (dark) | Primary actions, links, accent |
| **Green** | `G100-G800` | `#288034` (light) / `#3CC14E` (dark) | Success, positive changes |
| **Red** | `R100-R800` | `#D50B0B` (light) / `#FF5C5C` (dark) | Errors, attention, negative changes |
| **Orange** | `O100-O800` | `#D97706` | Warnings, pending states |

### Color Scale (100-800)

Each color family provides 8 shades for flexibility:

```
100 ░░░░░░░░  Lightest (backgrounds, hover states)
200 ░░░░░░░░  Light
300 ░░░░░░░░  Light-medium
400 ████░░░░  Medium-light
500 ████████  Primary (default)
600 ████████  Medium-dark
700 ████████  Dark
800 ████████  Darkest (text on light backgrounds)
```

### Color Usage Guidelines

- **Don't rely on color alone** for status cues; always include text labels
- Use `Accent` (blue) sparingly for primary CTAs and interactive elements
- Use `Attention` (red) only for errors, destructive actions, or urgent items
- Use `Success` (green) for confirmations and positive metrics

---

## Spacing & Layout

### Spacing Scale

Based on a 4px base unit, our spacing system uses two groups:

**Group 1: Component Spacing (4-32)**

For communicating relationships between UI elements using the proximity principle.

| Token | Value | Use Case |
|-------|-------|----------|
| `space-1` | 4px | Tight gaps, icon padding |
| `space-2` | 8px | Related element spacing |
| `space-3` | 16px | Default component padding |
| `space-4` | 24px | Card internal padding |
| `space-5` | 32px | Section gaps within cards |

**Group 2: Section Spacing (40-96)**

For visually separating screen regions using whitespace.

| Token | Value | Use Case |
|-------|-------|----------|
| `space-6` | 40px | Between related sections |
| `space-7` | 48px | Card margins |
| `space-8` | 56px | Major section breaks |
| `space-9` | 64px | Page section spacing |
| `space-10` | 80px | Large visual breaks |
| `space-11` | 96px | Maximum section spacing |

### Dimension Scale (Visual)

```
4   ▪
8   ▪▪
16  ████
24  ██████
32  ████████
────────────────
40  ██████████
48  ████████████
56  ██████████████
64  ████████████████
80  ████████████████████
96  ████████████████████████
```

### Layout Grid

- **Columns:** 12-column grid
- **Gutter:** 24px (desktop), 16px (tablet), 12px (mobile)
- **Margins:** 64px (desktop), 32px (tablet), 16px (mobile)
- **Max content width:** 1280px

---

## Shadows & Elevation

### Elevation Levels

Shadows communicate hierarchy and interactivity. Each level serves a specific component type:

| Level | Token | Use Case | Shadow |
|-------|-------|----------|--------|
| 0 | `shadow-none` | Flat elements | none |
| 1 | `shadow-card` | Cards, tiles | `0 1px 3px rgba(0,0,0,0.08)` |
| 2 | `shadow-dropdown` | Dropdowns, tooltips | `0 4px 12px rgba(0,0,0,0.12)` |
| 3 | `shadow-drawer` | Drawers, sheets | `0 8px 24px rgba(0,0,0,0.16)` |
| 4 | `shadow-modal` | Modals, dialogs | `0 16px 48px rgba(0,0,0,0.20)` |

### Visual Representation

```
   ╭───────╮    ╭───────╮    ╭───────╮    ╭───────╮
   │ CARD  │    │DROPDN │    │DRAWER │    │ MODAL │
   ╰───────╯    ╰───────╯    ╰───────╯    ╰───────╯
      ░░           ▒▒           ▓▓           ██
   Level 1      Level 2      Level 3      Level 4
```

### Nested Radius Rule

For nested elements, child radius should be ≤ parent radius, with curves concentric so they align:

```
Parent: border-radius: 16px
Child:  border-radius: 12px (with 4px gap)

┌──────────────────────┐
│  ╭──────────────╮    │
│  │              │    │
│  │              │    │
│  ╰──────────────╯    │
└──────────────────────┘
```

---

## Iconography

### Icon Scale

| Size | Token | Use Case |
|------|-------|----------|
| 14px | `icon-xs` | Inline with small text |
| 16px | `icon-sm` | Inline with body text, dense UIs |
| 24px | `icon-md` | Default size, buttons |
| 32px | `icon-lg` | Feature icons |
| 56px | `icon-xl` | Empty states |
| 64px | `icon-2xl` | Hero sections |

### Icon Grid

Icons are designed on a 24x24 grid with 2px padding safe zone:

```
┌────────────────────────┐
│  ┌──────────────────┐  │
│  │                  │  │
│  │    Icon Area     │  │
│  │                  │  │
│  └──────────────────┘  │
│     2px safe zone      │
└────────────────────────┘
```

### Icon Style Guidelines

- Stroke width: 1.5px (consistent across all icons)
- Corner radius: 2px (where applicable)
- Style: Outlined (not filled) for most UI icons
- Filled variants for selected/active states

---

## Components

### Form Controls

#### Text Input

```
┌─────────────────────────────────────┐
│ Label                               │
├─────────────────────────────────────┤
│ Placeholder text...                 │
└─────────────────────────────────────┘
```

- Height: 40px (default), 32px (compact)
- Padding: 12px horizontal
- Border: 1px solid `border-default`
- Border radius: 8px
- Focus: 2px ring with `accent` color

#### Select / Dropdown

```
┌─────────────────────────────────┬───┐
│ Selected value                  │ ▼ │
└─────────────────────────────────┴───┘
```

- Same dimensions as text input
- Dropdown uses `shadow-dropdown` elevation

#### Date Picker

```
┌─────────────────────────────────┬───┐
│ 2/14/2026                       │ 📅 │
└─────────────────────────────────┴───┘
```

#### Chips / Tags

```
┌──────────────────┐  ┌───────────────────────┐
│ Sales       +    │  │ Customer Support  ✕   │
└──────────────────┘  └───────────────────────┘
     Inactive              Active/Selected
```

- Height: 28px
- Padding: 4px 12px
- Border radius: 14px (pill)
- Active: filled background
- Inactive: outlined

#### Radio Buttons

```
○ Option A
○ Option B
● Option C (selected)
```

- Size: 16px diameter
- Selected: filled center dot

#### Checkboxes

```
☐ Unchecked
☑ Checked
```

- Size: 16px
- Border radius: 4px
- Checked: filled with checkmark icon

#### Toggle Switch

```
OFF: ○────────
ON:  ────────●
```

- Width: 40px
- Height: 24px
- Transition: 150ms ease

#### Range Slider

```
         180 ──────●──────●────── 200
              └──── range ────┘
```

- Track height: 4px
- Thumb size: 16px
- Range fill: accent color

### Buttons

#### Button Hierarchy

| Type | Appearance | Use Case |
|------|------------|----------|
| Primary | Filled, dark | Main actions |
| Secondary | Outlined | Alternative actions |
| Ghost | Text only | Tertiary actions |
| Danger | Red filled | Destructive actions |

```
┌───────────────┐   ┌───────────────┐
│  START CHAT   │   │ CONFIGURE ... │
└───────────────┘   └───────────────┘
    Primary            Secondary
```

- Height: 40px (default), 32px (compact), 48px (large)
- Padding: 16px horizontal
- Border radius: 8px
- Font: Semibold, uppercase for emphasis (optional)

### Cards

#### Metric Card

```
┌─────────────────────────────────┐
│ Involvement Rate                │
│                                 │
│ 85%                    ↑ 2%     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░           │
│ 4,151 out of 5,500              │
└─────────────────────────────────┘
```

- Background: `bg-secondary`
- Padding: 24px
- Border radius: 12px
- Shadow: `shadow-card`

#### Report Card (Metrics Grid)

```
┌─────────────────────────────────┐
│ Report Card         [VIEW]      │
│ Last evaluated Jan 14           │
├─────────────────────────────────┤
│ Accuracy    ▓▓▓▓▓▓▓▓▓░    90%   │
│ Quality     ▓▓▓▓▓▓▓▓▓▓   100%   │
│ Retrieval   ▓▓▓▓▓▓▓▓░░    84%   │
│ Trust       ▓▓▓▓▓▓▓░░░    75%   │
└─────────────────────────────────┘
```

### Progress Indicators

#### Progress Bar

```
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  37%
```

- Height: 4px (slim), 8px (default)
- Border radius: full (pill)
- Background: `bg-tertiary`
- Fill: `accent` or semantic color

#### Loading State

```
● RETRIEVING...
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░
```

### Data Visualization

#### Charts

- Use solid fills for actual data
- Use hatched/striped patterns for forecasts
- Include legends with clear labels
- Time filters: 24H, 7D, 14D, 1M tabs

```
              Actual ■  Forecast ▤  YoY Growth |
$10M ┤
 $8M ┤            ■■■■    ▤▤▤▤    ▤▤▤▤
 $6M ┤       ■■■■
 $4M ┤  ■■■■
 $2M ┤
 $0M ┼────────────────────────────────────
     2023 Q3   2024 Q3   2025 Q3   2026 Q3
```

---

## Agentic UI Patterns

### Design Philosophy for AI Interfaces

The shift from traditional UI to Agentic UI requires designing around outcomes, not flows. AI agents are primary actors in the product experience, not features bolted onto old patterns.

### Core Principles

#### 1. Transparency

Inform users that AI is involved, how it functions, and what actions it has taken.

```
┌─────────────────────────────────────────────┐
│ ⟳ Identifying key patterns           ✓     │
│ ☰ Ranking top insights               ✓     │
│ ∞ Searching web, news and data       ●     │
│ ⎙ Creating a report                  ○     │
│ ◇ Generating recommendations         ○     │
├─────────────────────────────────────────────┤
│         Scanning Data Sources...            │
│ Agents are scanning multiple data sources   │
│ to extract key insights for the report      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░           │
└─────────────────────────────────────────────┘
```

#### 2. Control

Enable users to customize, specify preferences, and have control over agent behavior.

```
AGENT MODE
○ Reasoning
○ Fast
● Complex Tasks

☑ I agree to terms and conditions

Enable PRO mode       ●────
Enable Research mode  ○────
```

#### 3. Consistency

Use familiar UI/UX patterns. Reduce cognitive load with predictable interactions.

### Model Selector Pattern

When multiple AI models are available, provide clear differentiation:

```
┌─────────────────────────────────────────────┐
│ Model                                       │
├─────────────────────────────────────────────┤
│ AI  Claude 4.1 Opus                      ▼  │
└─────────────────────────────────────────────┘
      ┌───────────────────────────────────────┐
      │ Anthropic                             │
      ├───────────────────────────────────────┤
      │ AI  Claude 4 Sonnet - High Thinking   │
      │     Power 5/5 · 200k · Reasoning      │
      ├───────────────────────────────────────┤
      │ AI  Claude 4.1 Opus              ✓    │
      │     Power 5/5 · 200k · Balanced       │
      ├───────────────────────────────────────┤
      │ AI  Claude 4.5 Haiku          NEW     │
      │     Power 4/5 · 200k · Fast           │
      └───────────────────────────────────────┘
```

Show for each model:
- Provider icon
- Model name and version
- Release date (optional)
- Power/capability rating
- Context window
- Primary use case (Reasoning, Balanced, Fast, Complex Tasks)

### AI Assistant Sheet

A slide-in sheet from the right side provides universal AI access without leaving context.

```
                                    ┌─────────────────────┐
                                    │ Eval agent       ▼ ✕│
                                    │                     │
                                    │                     │
                                    │   [Chat content]    │
                                    │                     │
                                    │                     │
                                    ├─────────────────────┤
                                    │ ✎ Draft a Reply     │
                                    │ ≡ Summarize         │
                                    ├─────────────────────┤
                                    │ Ask a follow up...  │
                                    │ + │ ✦ GEMINI 3  │ ↑ │
                                    └─────────────────────┘
```

**Sheet Specifications:**
- Width: 400px (collapsed), up to 600px (expanded)
- Trigger: Keyboard shortcut (Cmd+J), button, or contextual action
- Shadow: `shadow-drawer`
- Includes: Agent selector, quick actions, chat input, model picker

### Quick Actions

Provide contextual AI actions that users can invoke with one click:

```
✎ Draft a Reply
≡ Summarize
⟳ Regenerate
✓ Approve
```

### Agent Configuration Panel

For complex agent setup, provide organized sections:

```
┌─────────────────────┬─────────────────────┐
│ NAME                │ MODEL               │
│ ┌─────────────────┐ │ ┌─────────────────┐ │
│ │ Agentic UI      │ │ │ Claude 4.1 Opus │ │
│ └─────────────────┘ │ └─────────────────┘ │
├─────────────────────┼─────────────────────┤
│ DATE                │ COST                │
│ ┌─────────────────┐ │ ┌─────────────────┐ │
│ │ 2/14/2026    📅 │ │ │ $199.00      ▲▼ │ │
│ └─────────────────┘ │ └─────────────────┘ │
├─────────────────────┼─────────────────────┤
│ AGENT TYPE          │ TASK PROGRESS       │
│ [Sales+] [Support✕] │ ▓▓▓▓▓▓▓▓░░░░  37%   │
│ [Research+] [Q&A+]  │ // Scanning...      │
├─────────────────────┼─────────────────────┤
│ AGENT MODE          │ TOKENS              │
│ ○ Reasoning         │    180 ────●── 200  │
│ ○ Fast              │                     │
│ ● Complex Tasks     │ [AI] [⚙] [✦]        │
├─────────────────────┴─────────────────────┤
│ ☑ I agree to terms   Enable PRO ●────     │
│ and conditions       Enable Research ○─── │
├───────────────────────────────────────────┤
│    [START CHAT]     [CONFIGURE AGENT]     │
└───────────────────────────────────────────┘
```

### Agent Dashboard

For monitoring and managing multiple agents:

```
┌──────────────────────────────────────────────────────────────────┐
│ ◆ Agentic UI                              Hi, Alex  👤          │
├────────────────┬─────────────────────────────────────────────────┤
│ ⊙ MONITOR      │ AGENTS > WEALTH MANAGEMENT                      │
│   Dashboard    │                                                 │
│   Call History │ Equity Research Agent          [Configure ↗]   │
│   Live Calls   │ Created: Sep 6, 2025           [Variant   ↗]   │
│                │ Variants: 10                   [Deploy    ↗]   │
│ ⚙ ORCHESTRATE  │ Accuracy: 81%                  [Performance↗]  │
│   ../Agents █  │                                                 │
│   Campaigns    │ VARIANT 9  DEPLOYED            [EDIT] [LAUNCH] │
│   Playbooks    ├─────────────────────────────────────────────────┤
│                │ Report Card        │ Requests (Live)           │
│ ⊕ DELEGATE     │ Accuracy     90%   │      2 ─╮                 │
│   Phone Numbers│ Quality     100%   │      1 ─┼─╮   ╭─          │
│   Voice Library│ Retrieval    84%   │      0 ─┴─┴───┴──         │
│   Integrations │ Trust        75%   │    01/07    01/14         │
│   Events       │                    │                           │
└────────────────┴─────────────────────────────────────────────────┘
```

### Agent Variants

Show model comparison with accuracy metrics:

```
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ NEW VARIANT       │ │ VARIANT 8         │ │ VARIANT 7         │
│ ○ GPT-4o          │ │ ○ GPT-4o          │ │ AI Claude 4.1     │
│   Accuracy: 80%   │ │   Accuracy: 86%   │ │    Accuracy: 90%  │
│ ▦ Moody's         │ │ ▦ Moody's         │ │ ▦ Moody's         │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

---

## Navigation

### Sidebar Structure

```
◆ Upstream

⊙ MONITOR
│ ../Activity Dashboard █
│ Call History
│ Live Calls

⚙ ORCHESTRATE
│ Agents
│ Campaigns
│ Playbooks

⊕ DELEGATE
│ Phone Numbers
│ Voice Library
│ Integrations
│ Events
```

**Specifications:**
- Width: 240px (expanded), 64px (collapsed)
- Section headers: Overline style, uppercase
- Active indicator: Left border accent + filled background
- Icons: 20px, aligned left

### Breadcrumbs

```
AGENTS > WEALTH MANAGEMENT
```

---

## Implementation

### CSS Custom Properties

```css
:root {
  /* Colors */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F7F7F7;
  --color-bg-tertiary: #E5E5E5;
  --color-bg-elevated: #FFFFFF;

  --color-text-primary: #000000;
  --color-text-secondary: #666666;
  --color-text-muted: #999999;

  --color-accent: #0568F6;
  --color-success: #288034;
  --color-attention: #D50B0B;
  --color-warning: #D97706;

  --color-border-default: #E5E5E5;
  --color-border-subtle: #F0F0F0;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;
  --space-6: 40px;
  --space-7: 48px;
  --space-8: 56px;
  --space-9: 64px;
  --space-10: 80px;
  --space-11: 96px;

  /* Typography */
  --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'Geist Mono', monospace;

  /* Shadows */
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-dropdown: 0 4px 12px rgba(0,0,0,0.12);
  --shadow-drawer: 0 8px 24px rgba(0,0,0,0.16);
  --shadow-modal: 0 16px 48px rgba(0,0,0,0.20);

  /* Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
}

[data-theme="dark"] {
  --color-bg-primary: #000000;
  --color-bg-secondary: #191919;
  --color-bg-tertiary: #363636;
  --color-bg-elevated: #191919;

  --color-text-primary: #FFFFFF;
  --color-text-secondary: #A3A3A3;
  --color-text-muted: #707070;

  --color-accent: #4D93FC;
  --color-success: #3CC14E;
  --color-attention: #FF5C5C;

  --color-border-default: #363636;
  --color-border-subtle: #262626;
}
```

### Tailwind Configuration

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', ...defaultTheme.fontFamily.sans],
        mono: ['Geist Mono', ...defaultTheme.fontFamily.mono],
      },
      colors: {
        accent: {
          DEFAULT: 'var(--color-accent)',
          // ... 100-800 scale
        },
        // ... other semantic colors
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '16px',
        '4': '24px',
        '5': '32px',
        '6': '40px',
        '7': '48px',
        '8': '56px',
        '9': '64px',
        '10': '80px',
        '11': '96px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        dropdown: 'var(--shadow-dropdown)',
        drawer: 'var(--shadow-drawer)',
        modal: 'var(--shadow-modal)',
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '8px',
        lg: '12px',
        xl: '16px',
      },
    },
  },
}
```

### Component Library Structure

```
components/
├── primitives/
│   ├── Button/
│   ├── Input/
│   ├── Select/
│   ├── Checkbox/
│   ├── Radio/
│   ├── Toggle/
│   ├── Slider/
│   └── Chip/
├── patterns/
│   ├── Card/
│   ├── MetricCard/
│   ├── Modal/
│   ├── Drawer/
│   ├── Sheet/
│   └── Dropdown/
├── navigation/
│   ├── Sidebar/
│   ├── Breadcrumb/
│   └── Tabs/
├── data-display/
│   ├── Table/
│   ├── Chart/
│   ├── ProgressBar/
│   └── Badge/
└── agentic/
    ├── ModelSelector/
    ├── AgentConfig/
    ├── AgentSheet/
    ├── ProcessingStatus/
    └── QuickActions/
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial release |

---

## References

- [Vercel Geist Design System](https://vercel.com/geist/introduction)
- [Dieter Rams: 10 Principles of Good Design](https://www.vitsoe.com/us/about/good-design)
- [Microsoft Agentic Design Principles](https://microsoft.github.io/ai-agents-for-beginners/03-agentic-design-patterns/)
- [Google A2UI: Agent-Driven Interfaces](https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/)
- [UX Design Institute: AI Agent Design](https://www.uxdesigninstitute.com/blog/design-experiences-for-ai-agents/)
