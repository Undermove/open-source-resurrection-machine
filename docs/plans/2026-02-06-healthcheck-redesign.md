# Team Health Check Redesign — "Hearthstone"

**Date:** 2026-02-06
**Status:** Design approved, ready for implementation

## Problem

The current health check UI is a spreadsheet-like matrix (indicators as rows, participants as columns). It is cramped, visually generic, and does not match how the tool is actually used: a facilitator drives a session indicator-by-indicator while the team discusses. The UI should reflect that flow.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout model | Card-by-card, one indicator at a time | Matches real session flow: team discusses one indicator, then moves on |
| Who drives | Facilitator on shared screen, quick-input mode | Single-user app optimized for fast entry during live discussion |
| Fields per participant | Status + trend + note, all visible upfront | All three are required; no progressive disclosure, no hiding |
| Visual direction | Warm and human, distinctive | The tool facilitates vulnerable team conversations; it should feel like a shared space, not a spreadsheet |
| Responsive target | Desktop-first | Primarily used on laptop/projector in meetings |
| Multi-file summary | Separate view, not part of session flow | Two distinct use cases: running sessions vs comparing teams afterwards |
| Design system | Fresh direction | No reuse of existing "Midnight Forge" system |
| Bilingual | Keep RU/EN support | Existing requirement, carried forward |

---

## Visual Identity

### Typography

- **Display:** Fraunces (Google Fonts) — variable serif with optical size axis and "wonk" feature. Handcrafted personality without being childish.
- **Body:** DM Sans (Google Fonts) — geometric with softly rounded terminals. Clean, warm, readable.

### Color Palette

| Role | Color | Hex | Notes |
|------|-------|-----|-------|
| Background | Warm cream | `#FAF6F1` | Not white, not beige. The color of good paper. |
| Text | Dark umber | `#2D2319` | Warm black, not cold gray |
| Accent | Terracotta | `#C4593A` | Earthy, confident. Used for actions and focus states |
| Status: Green | Forest | `#5A8A58` | Healthy, growing |
| Status: Yellow | Honey | `#C9963A` | Caution, warmth |
| Status: Red | Clay | `#BE4D3A` | Attention, grounded |
| Card surface | White | `#FFFFFF` | Warm diffused shadows: `rgba(45,35,25,0.08)` |
| Subtle texture | Canvas grain | — | Barely visible background grain for tactility |

### Shape Language

- Border-radius: 16-20px throughout
- Soft shadows, no hard borders
- Elements feel resting on the surface, not trapped in boxes

---

## Application Structure

Two top-level modes, toggled via header:

1. **Run Session** — the card-by-card flow (Setup → Cards → Results)
2. **Compare Teams** — multi-file summary view

### Header

- Left: App title in Fraunces
- Center: Mode toggle ("Run Session" / "Compare Teams")
- Right: Language toggle (EN / RU), simple text, current language in bold

---

## Screen 1: Setup

A single centered card on the warm cream background. Feels like writing names on index cards before a workshop.

### Layout

```
┌─────────────────────────────────────┐
│                                     │
│  Team Name        [____________]    │
│  Date             [____/____]       │
│  Facilitator      [____________]    │
│                                     │
│  Participants                       │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Anna ×│ │ Bob ×│ │ + Add│        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│        [ Start Session ]            │
│                                     │
└─────────────────────────────────────┘
```

### Behavior

- Participant chips: rounded, removable (× button). Inline-editable name.
- "Add participant" button appends a new chip with focus on the name field.
- "Start Session" button: large, terracotta. Disabled until at least one participant exists.
- Session metadata autosaves to localStorage.
- If a previous session exists in localStorage, offer to resume or start fresh.

---

## Screen 2: Card Flow (Core Interaction)

One indicator fills the viewport. This is where the facilitator spends 90% of their time.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  ● ● ● ◉ ○ ○ ○ ○ ○ ○          3 / 10              │
│                                                     │
│              Fun                                    │
│         (large, Fraunces)                           │
│                                                     │
│  ┌─────────────────┬──────────────────────┐         │
│  │ Healthy:        │ Unhealthy:           │         │
│  │ We love going   │ Ugh, boring.         │         │
│  │ to work.        │                      │         │
│  └─────────────────┴──────────────────────┘         │
│                                                     │
│  ┌─────────────────────────────────────────┐        │
│  │ Anna    (●)(●)(●)  (↗)(→)(↘)  [note__] │        │
│  │ Bob     (●)(●)(●)  (↗)(→)(↘)  [note__] │        │
│  │ Charlie (●)(●)(●)  (↗)(→)(↘)  [note__] │        │
│  └─────────────────────────────────────────┘        │
│                                                     │
│  [ ← Previous ]                    [ Next → ]       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Progress Strip

- Row of dots at the top, one per indicator.
- Filled terracotta = completed. Hollow = remaining. Current = pulsing glow.
- Dots are clickable — allows non-linear navigation (jump to any indicator).

### Indicator Description

- Title: large Fraunces heading, centered.
- Below: two-column layout showing the "healthy" (green) and "unhealthy" (red) descriptions. Helps the team calibrate before voting.

### Participant Rows

Each row contains, left to right:

1. **Name** — left-aligned, DM Sans medium weight.
2. **Status buttons** — three circles (~44px), colored forest/honey/clay.
   - Unselected: subtle inner shadow, "pressed into surface" look.
   - Selected: lifts with soft shadow, scales to 1.1x. Others dim to 30% opacity.
   - Transition: 150ms ease-out.
3. **Trend buttons** — three smaller buttons with arrow icons (↗ → ↘).
   - Rounded stroke caps to match warm aesthetic.
   - Same select/dim behavior as status buttons.
4. **Note field** — single-line input with warm bottom-border only (no box).
   - On focus: expands to 2-line textarea with full soft border.
   - Placeholder: "Add a note..." in light umber.

### Navigation

- "Previous" and "Next" buttons at the bottom, flanking.
- "Next" button highlights (solid terracotta fill) when all participants in the current card have status + trend filled.
- Keyboard shortcuts: ← → for prev/next. Tab to move between participant rows.

---

## Screen 3: Results

Shown after completing the 10th indicator. Summary of the session.

### Layout

Each indicator displayed as a compact row:

```
┌──────────────────────────────────────────────────┐
│  Fun               ●● ●   ↗↗→                   │
│  Value             ●●●    →→→                   │
│  Speed             ● ●●   ↘→↗                   │
│  ...                                             │
│                                                  │
│  Overall Notes     [________________________]    │
│                                                  │
│  [ ← Back to Review ]        [ Export CSV ]      │
└──────────────────────────────────────────────────┘
```

- Each indicator row shows participant votes as colored dots (forest/honey/clay) and trend arrows.
- Hovering a dot shows participant name + note in a tooltip.
- "Back to Review" allows jumping to any card for corrections.
- "Export CSV" downloads the session data.
- Overall notes textarea for facilitator's summary.
- Autosaved to localStorage like everything else.

---

## Compare Teams View

Accessed via the header mode toggle. Completely separate from the session flow.

### File Upload

- Drag-and-drop zone: warm dashed border, centered.
- "Drop CSV files here" in Fraunces.
- Also accepts click-to-browse.
- Each loaded file appears as a removable chip above the table.

### Comparison Table

- Rows: 10 indicators
- Columns: one per team (team name + date as header)
- Cells: worst-case status dot + worst-case trend arrow
- Tooltip on hover: individual participant vote breakdown
- Warm styling: no cold data-table borders. Subtle row-hover highlight in warm cream.
- Export summary CSV button at top right.

---

## Interactions and Polish

### Autosave

- Persists to localStorage after every interaction (debounced 250ms).
- Status indicator in footer: small warm-toned "Saved" text that fades in/out.
- Key: `teamHealthCheck_v2` (new key, does not conflict with v1 data).

### Language Toggle

- Top-right header area.
- Simple "EN / RU" text toggle, current language in bold.
- Persists to localStorage and URL param.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← | Previous indicator |
| → | Next indicator |
| Tab | Next participant row |
| Shift+Tab | Previous participant row |
| 1 / 2 / 3 | Set status (green/yellow/red) for focused row |

### Animations

- Card transitions: crossfade with subtle horizontal slide (150ms).
- Status/trend button selection: scale + shadow lift (150ms ease-out).
- Progress dots: current dot has gentle terracotta pulse.
- Note field focus: smooth height expansion.
- All animations respect `prefers-reduced-motion`.

### Canvas Texture

- Subtle SVG noise filter on the background.
- Barely visible — adds tactility without distraction.

---

## Technical Constraints

- **Single HTML file** — maintain the existing single-file architecture (HTML + inline CSS + inline JS).
- **No frameworks** — vanilla JS, no build step.
- **Fonts** — loaded from Google Fonts CDN (Fraunces, DM Sans).
- **Browser support** — modern browsers (Chrome, Firefox, Safari, Edge).
- **Data format** — CSV export must remain compatible with existing format for backward compatibility with the Compare Teams import.

---

## Migration

- New localStorage key (`teamHealthCheck_v2`) to avoid conflicts.
- Offer one-time migration from v1 data if detected.
- CSV export format remains the same — existing CSVs can still be imported into Compare Teams view.

---

## What's NOT Changing

- The 10 Spotify indicators and their descriptions
- CSV export/import format
- Bilingual support (RU/EN)
- localStorage persistence
- Single-file architecture
- Multi-file summary functionality (just moved to a separate view)

## What's NEW

- Card-by-card session flow instead of matrix
- Setup screen with participant chips
- Results summary screen
- Quick-input participant rows (all fields visible)
- Progress dots with non-linear navigation
- Keyboard shortcuts for fast facilitation
- Warm, distinctive visual identity (Fraunces + DM Sans, cream/terracotta palette)
- Canvas grain texture
