# empixel-builder — RightPanel Controls & Fields

## Role
Reusable UI components for editing block properties: fields, controls, and styling inputs.

## Architecture

```
RightPanel.tsx (3 tabs: Fields, Style, Advanced)
├─ fields/
│  ├─ FieldRenderer.tsx         # Generic field dispatcher
│  ├─ JsonArrayField.tsx        # Expandable item list
│  └─ PageBuilderField.tsx      # Drag-drop layout field
└─ controls/
   ├─ ColorPicker.tsx
   ├─ SpacingControl.tsx        # Padding / Margin / Offset
   ├─ BorderRadiusControl.tsx
   ├─ BorderControl.tsx
   ├─ BoxShadowControl.tsx      # Box shadow (x, y, blur, spread, color, inset)
   ├─ BackgroundControl.tsx     # Color / gradient / image
   ├─ GapControl.tsx            # Column + row gap
   ├─ LayoutControl.tsx         # Flex direction + wrap + align + justify
   ├─ OverflowControl.tsx       # Overflow x/y
   ├─ LinkControl.tsx           # href + target for <a> containers
   ├─ MediaPicker.tsx           # Image/media selector (UI exists, not wired to FieldRenderer)
   ├─ ThemeStyleToggle.tsx      # Light / Dark / Accent theme selector
   └─ FieldRow.tsx              # NumberRow, TextRow, SelectRow, DimensionControl, FieldGroup
```

## Tabs

### Tab 1: Fields
Block-specific content from `def.fields[]`.
- Uses `FieldRenderer` to dispatch each field type
- Container block adds: LayoutControl, GapControl, OverflowControl, HTML Tag selector, LinkControl

### Tab 2: Style
Visual styling. Each section has a **Normal / Hover state toggle** (IconStateNormal / IconStateHover).

| Section | Controls | State toggle |
|---------|----------|--------------|
| Background | BackgroundControl + ThemeStyleToggle | ✅ Normal/Hover |
| Border Radius | BorderRadiusControl | ✅ Normal/Hover |
| Border | BorderControl | ✅ Normal/Hover |
| Box Shadow | BoxShadowControl | ✅ Normal/Hover |

Hover styles are written to `block.config.styleHover`.
Theme styles are written to `block.config.style` / `block.config.styleDark` / `block.config.styleAccent` via `getThemeStyleKey(theme)`.
Breakpoint styles are written to `block.config.styleBreakpoints[bpId]` / `block.config.styleHoverBreakpoints[bpId]`.

### Tab 3: Advanced
Layout & positioning. **No** Normal/Hover toggle here.

| Control | Stored in |
|---------|-----------|
| DimensionControl (Width) | `block.config.style.width/minWidth/maxWidth` |
| DimensionControl (Height) | `block.config.style.height/minHeight/maxHeight` |
| SpacingControl (Padding) | `block.config.style.paddingTop/Right/Bottom/Left` |
| SpacingControl (Margin) | `block.config.style.marginTop/Right/Bottom/Left` |
| SelectRow (Position) | `block.config.advanced.position` |
| SpacingControl (Offset) | `block.config.advanced.top/right/bottom/left` |
| NumberRow (Z-Index) | `block.config.advanced.zIndex` |
| TextRow (CSS ID) | `block.config.advanced.cssId` |
| TextRow (CSS Classes) | `block.config.advanced.cssClasses` |
| CodeEditor (Custom CSS) | `block.config.advanced.customCss` |

## FieldRenderer (fields/FieldRenderer.tsx)

Routes `FieldDef.type` to appropriate input:

| type | Component | Value |
|------|-----------|-------|
| `text` | `<input type="text">` | string |
| `url` | `<input type="url">` | string |
| `textarea` | `<textarea rows=3>` | string |
| `number` | `<input type="number">` | number |
| `select` | `<select>` | string |
| `toggle` | checkbox + label | boolean |
| `json-array` | JsonArrayField | array |

## JsonArrayField

Expandable list of items. Each item is a collapsible card with sub-fields from `itemFields`.
- Add / Remove item buttons
- Stores as JSON array in `block.config[key]`

## ColorPicker

Floating color picker:
- Hex/RGB/HSL format tabs
- Opacity slider
- Recent colors
- Format persisted alongside value

## SpacingControl

4-side spacing editor (Padding, Margin, Offset):

**Collapsed:** single scrub (all sides uniform). Shows "Mixed" if sides differ.
**Expanded:** 2×2 grid, each side has label + scrub input + unit (px, rem, %).

Props: `label`, `value: SpacingValue`, `onChange`, `sides`, `forceExpanded`

CSS key mapping:
- `padding` → `paddingTop/Right/Bottom/Left`
- `margin` → `marginTop/Right/Bottom/Left`
- `offset` → `top/right/bottom/left`

## BorderRadiusControl

Corner radius editor. Collapsed (single) / Expanded (2×2 corners).
Supports px, rem, %.
CSS keys: `borderTopLeftRadius`, `borderTopRightRadius`, `borderBottomRightRadius`, `borderBottomLeftRadius`.

Accepts `breakpointIndicator` prop (JSX icon shown in label when non-desktop breakpoint active).

## BorderControl

4-side border editor. Collapsed (single width) / Expanded (4 sides).
- Style dropdown: none / solid / dashed / dotted / double
- Color via ColorPicker
CSS keys: `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`, `borderStyle`, `borderColor`.

Accepts `breakpointIndicator` prop.

## BoxShadowControl

Box shadow editor:
- X offset, Y offset, Blur radius, Spread radius (each SideInput with unit)
- Color via ColorPicker
- Inset toggle
- Stored as CSS `box-shadow` string in `block.config.style.boxShadow` / `styleHover.boxShadow`

Accepts `breakpointIndicator` prop.

## BackgroundControl

- Solid color picker (ColorPicker)
- Gradient editor (via CSS gradient string)
- Image picker (MediaPicker)
- Background size: cover / contain / repeat
- Background position: center / top / bottom / left / right
- Opacity slider

`allowedTypes` prop: restricts to subset (e.g. hover state restricts nothing, normal state allows all).

## GapControl

Column + row gap for flex/grid containers.
- Single scrub (uniform) or expanded (column / row independently)
CSS keys: `columnGap`, `rowGap`

## LayoutControl

Flex layout properties for container blocks:
- Direction: row / column
- Wrap: nowrap / wrap
- Align items: start / center / end / stretch / baseline
- Justify content: start / center / end / space-between / space-around / space-evenly

## OverflowControl

Overflow x/y selector: visible / hidden / scroll / auto

## LinkControl

Link properties for `<a>` container blocks:
- `href` text input
- `target` select: _self / _blank / _parent / _top

Shown only when container's HTML Tag is `a`.

## ThemeStyleToggle

Segmented toggle: Light / Dark / Accent
Sets `block.config.theme` and determines which style key is written to:
- `"light"` → `style`
- `"dark"` → `styleDark`
- `"accent"` → `styleAccent`

## DimensionControl (FieldRow.tsx)

Width or Height editor with 3 sub-fields: Fix / Min / Max.
Each is a SideInput (scrub + number + unit).
Reset button clears all 3.

## FieldRow / FieldGroup

Wrappers for Advanced tab rows:
- `FieldGroup` — border + reset button, `isDirty` prop lightens label
- `NumberRow` — scrub label + number input
- `TextRow` — text input
- `SelectRow` — custom dropdown

## CodeEditor (inline in RightPanel.tsx)

Custom CSS textarea:
- Dark-only theme (Catppuccin Mocha palette via CSS vars)
- Line numbers column (synced scroll)
- Tab key inserts 4 spaces
- Header shows CSS selector (`[data-epx-block="<id>"]`) with copy button
- Height: min 140px, vertically resizable

## Hover State System

Each stateful control (Background, Radius, Border, Shadow) has its own `mode: "normal" | "hover"` local state.
- Mode resets to "normal" when selected block changes.
- Normal writes to base style key (or breakpoint overlay key).
- Hover writes to `styleHover` (or `styleHoverBreakpoints[bpId]`).

## Breakpoint-Aware Writes

When `activeBreakpoint !== "desktop"`:
- Style reads from merged `{ ...activeStyle, ...bpStyleRaw }` (base + breakpoint override)
- Writes go to `block.config.styleBreakpoints[bpId]` (includes `_px` for media query generation)
- Hover writes go to `block.config.styleHoverBreakpoints[bpId]`

See [prd-breakpoints.md](prd-breakpoints.md) for the full breakpoint architecture.

## Label Styling System

| Context | Class | Color | Uppercase |
|---------|-------|-------|-----------|
| Field label | `epx-field__label` | `--epx-text-faint` | no |
| Row label (scrub) | `epx-side-input__label--scrub` | faint | no |
| Section header | `epx-row-label--section` | faint | YES |
| Side label (T/R/B/L) | `epx-side-input__label` | faint | YES (9px) |

Dirty label: `color-mix(in srgb, var(--epx-text-faint), white 45%)`

## Props Summary

`RightPanel` receives:
- `block: SectionBlock | null`
- `onChange: (config: Record<string, any>) => void`
- `activeBreakpoint: BreakpointId`
- `breakpointsConfig: BreakpointsConfig`

## TODO

- [ ] Wire MediaPicker into FieldRenderer (`image` field type)
- [ ] Add rich-text field type (Portable Text editor)
- [ ] Add typography control (font-family, weight, size, line-height)
- [ ] Add gradient editor (currently only solid/image for hover mode)
- [ ] Keyboard shortcuts within controls (Escape to cancel, Enter to confirm)
