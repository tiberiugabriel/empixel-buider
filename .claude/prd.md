# empixel-builder — PRD

## What It Is
Drag-and-drop page builder plugin for EmDash (Astro CMS). Users visually compose pages using pre-built blocks. Layouts stored as JSON in SQLite, rendered via Astro components.

## Architecture
- **Backend** (`src/plugin.ts`) — 4 REST routes + `content:afterDelete` hook → SQLite table `empixel_builder_layouts`
- **Admin UI** (`src/admin/`) — React, 3-panel: LeftPanel (block palette) + Canvas (drag-drop) + RightPanel (properties)
- **Frontend** (`src/components/`) — Astro components, zero JS, `getBuilderLayout()` reads DB

## Current State (v0.1.2)

### Done
- 3-panel builder UI with drag-drop (`@dnd-kit`)
- Theme toggle (light/dark/system)
- Styling controls: ColorPicker, SpacingControl, BorderRadiusControl, BorderControl, custom CSS
- SQLite persistence (GET/POST layout routes)
- Auto-cleanup on entry delete
- CLI install script (`add.js`) — patches astro.config, creates DB table, patches pages
- Settings page — enable builder per collection
- Tree utilities (`treeUtils.ts`) — findPath, insert, remove, update (recursive)
- 13 Astro frontend block components

### Block Types (keep)
Section (container), Columns, Hero, Features Grid, Image-Text, CTA, Testimonials, Stats, FAQ, Pricing, Gallery, Video, Spacer

**Core blocks to add:** Heading, Paragraph, RichText/Editor, HTML, Image

### Block definitions (`blockDefinitions.ts`)
Only 5 blocks defined: testimonials, faq, pricing, container, spacer.
Remaining 8 blocks exist in types + components but definitions missing — add them.

---

## Roadmap

### Next Up (active)
1. **Complete `blockDefinitions.ts`** — add missing blocks (hero, features-grid, image-text, cta, stats, gallery, video, columns)
2. **Core blocks** — new block types: Heading, Paragraph, RichText/Editor, HTML, Image (with Astro components + definitions + previews)
3. **Live previews** — preview components reflect real config changes (color, spacing, text) in real time
4. **Canvas UI fixes** — overlay interactions, columns "add column" button, visual polish
5. **Undo/Redo stack** — history in builder state reducer

### Later (v0.x)
- Responsive breakpoints (mobile/tablet/desktop styling overrides)
- Frontend Astro components audit (verify all props from types.ts are wired)

### Not in scope (for now)
- Version history / audit trail
- Collaborative editing
- Layout templates/presets
- Export/import layouts
- Role-based access

---

## RightPanel — Fields System

The RightPanel has three tabs. Each tab is a single scrollable `epx-right-panel__fields` column.

### Tab: Fields
Block-specific content fields, driven by `FieldDef[]` in `blockDefinitions.ts` and rendered by `FieldRenderer.tsx`.

#### FieldDef schema
```ts
{
  key: string;           // maps to block.config[key]
  label: string;
  type: FieldType;
  options?: { value, label }[];   // select only
  placeholder?: string;
  required?: boolean;
  itemFields?: FieldDef[];        // json-array only — schema for each item
}
```

#### Field types (FieldRenderer.tsx)
| Type | UI | Notes |
|------|----|-------|
| `text` | `<input type="text">` | Default fallback |
| `url` | `<input type="url">` | Same as text, different type attr |
| `textarea` | `<textarea rows=3>` | Vertically resizable via CSS |
| `number` | `<input type="number">` | |
| `select` | `<select>` with options | Requires `options` array |
| `toggle` | Checkbox + inline label | Label sits beside the checkbox, not above |
| `json-array` | Expandable item list | Each item's sub-fields defined in `itemFields` |

All field types render a `epx-field__label` above the input, except `toggle` (label is inline).

---

### Tab: Style
Visual styling controls, stored in `block.config.style` (flat CSS-key record).

#### BorderRadiusControl (`controls/BorderRadiusControl.tsx`)
- Collapsed: single "Radius" scrub input (sets all four corners equally)
- Expanded: 2×2 grid — top-left, top-right, bottom-right, bottom-left
- CSS keys: `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`
- Supports all spacing units

#### BorderControl (`controls/BorderControl.tsx`)
- Collapsed: single "Border" width scrub input (sets all four sides equally)
- Expanded: 2×2 grid of side widths (T/R/B/L) + style dropdown (none/solid/dashed/dotted/double) + color swatch
- Color swatch opens a floating `ColorPicker`; display format (HEX/RGB/HSL/etc.) is persisted alongside
- CSS keys: `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `borderStyle`, `borderColor`

#### Misc style fields (MISC_STYLE_FIELDS in RightPanel.tsx)
Additional `FieldDef`-typed fields rendered at the bottom of the Style tab (below a separator). Saved into `block.config.style` keyed by `field.key`.

---

### Tab: Advanced
Layout and positioning controls, stored in `block.config.style` (dimensions/spacing) and `block.config.advanced` (position/z-index/identifiers/CSS).

#### DimensionControl (`controls/FieldRow.tsx`)
Used for Width and Height.
- Collapsed: single scrub input for the fixed value (`width` / `height`), with a `▾` expand button
- Expanded: three rows — Fix, Min, Max — mapping to e.g. `width` / `minWidth` / `maxWidth`
- Has reset button when any of the three values is non-zero
- Supports all spacing units

#### SpacingControl (`controls/SpacingControl.tsx`)
Used for Padding, Margin, and Offset (position offsets).
- Collapsed: single scrub input for the first side (applies to all sides uniformly). Shows "Mixed" label when sides differ.
- Expanded: grid of individual side inputs — 2-column for 4 sides (T/R/B/L), 1-column for 1–2 sides. `forceExpanded` prop skips the collapsed state entirely (used for Offset).
- Each `SideInput` has a scrub label + number input + unit button (opens `UnitDropdown`)
- CSS keys (Padding): `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`
- CSS keys (Margin): `marginTop`, `marginRight`, `marginBottom`, `marginLeft`
- CSS keys (Offset): `top`, `right`, `bottom`, `left` (stored in `advanced`, not `style`)

#### Row controls — single-line field rows (`controls/FieldRow.tsx`)
Used for simple properties in the Advanced tab, wrapped in a `FieldGroup` (adds border + reset button).

| Component | Input | Stored in | Notes |
|-----------|-------|-----------|-------|
| `SelectRow` | Custom dropdown (not `<select>`) | `advanced` | Options list passed as prop |
| `NumberRow` | `<input type="number">` with scrub label | `advanced` | Drag label to scrub value |
| `TextRow` | `<input type="text">` | `advanced` | |

#### Advanced config fields
| Field | Control | `advanced` key | Notes |
|-------|---------|----------------|-------|
| Position | `SelectRow` | `position` | Default / Relative / Absolute / Fixed / Sticky |
| Offset | `SpacingControl` (forceExpanded) | `top`, `right`, `bottom`, `left` | Only visible when position is set |
| Z-Index | `NumberRow` | `zIndex` | Scrubable |
| CSS ID | `TextRow` | `cssId` | Applied as `id` on the block element |
| CSS Classes | `TextRow` | `cssClasses` | Space-separated, appended to block element |
| Custom CSS | `CodeEditor` | `customCss` | Scoped to block selector; vertically resizable |

#### CodeEditor (inline in RightPanel.tsx)
Custom CSS textarea with:
- Dark-only theme (Catppuccin Mocha) regardless of builder theme
- Line numbers column (synced scroll)
- Tab key inserts 4 spaces
- Header shows the block's CSS selector (`[data-epx-block="<id>"]`) with copy button
- Height: min 140px, no max, vertically resizable by dragging

---

### Label styling rules
All labels across tabs follow the same visual system:

| Context | Class | Color | Uppercase | Hover |
|---------|-------|-------|-----------|-------|
| Field label (above input) | `epx-field__label` | `--epx-text-faint` | no | none |
| Row label (inline, non-scrub) | `epx-side-input__label--row` | `--epx-text-faint` | no | none |
| Row label, scrub (Z-Index) | `+ epx-side-input__label--scrub` | `--epx-text-faint` | no | blue accent |
| Section header (Position, Z-Index) | `+ epx-row-label--section` | `--epx-text-faint` | YES | none |
| Compact side labels (T/R/B/L) | `epx-side-input__label` | `--epx-text-faint` | YES (9px) | blue accent |
| Collapsed scrub label (Width, Padding…) | `+ epx-side-input__label--full` | `--epx-text-faint` | YES | blue accent |
| Expanded section header (Width expanded…) | `epx-spacing-ctrl__label` | `--epx-text-faint` at 0.65 opacity | YES | none |

#### Dirty state label color
When a control has been modified (is dirty), the label lightens toward white:
```css
color: color-mix(in srgb, var(--epx-text-faint), white 45%)
```
Applied via parent class `is-dirty`:
- `epx-spacing-ctrl.is-dirty` → `.epx-side-input__label--full` and `.epx-spacing-ctrl__label`
- `epx-field-group.is-dirty` → `.epx-side-input__label--row`
- `epx-field.is-dirty` → `.epx-field__label`

Controls that set `is-dirty` automatically: `SpacingControl`, `DimensionControl`, `BorderRadiusControl`, `BorderControl`, `FieldGroup`.
`FieldRenderer` receives `isDirty` as prop from `RightPanel` (compared via `JSON.stringify` against `def.defaultConfig[field.key]`).

---

## Key Files

| File | Role |
|------|------|
| `src/plugin.ts` | Routes + hooks |
| `src/types.ts` | All block type interfaces |
| `src/admin/BuilderPage.tsx` | UI orchestrator + state reducer |
| `src/admin/Canvas.tsx` | Drag-drop canvas |
| `src/admin/blockDefinitions.ts` | Block schemas (incomplete) |
| `src/admin/treeUtils.ts` | Recursive tree ops |
| `src/admin/previews/` | Preview components (need live wiring) |
| `src/components/` | Astro frontend components |
