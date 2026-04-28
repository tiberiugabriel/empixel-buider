# empixel-builder — RightPanel Controls & Fields

## Role
Reusable UI components for editing block properties: fields, controls, and styling inputs.

## Architecture

```
RightPanel.tsx (3 tabs: Fields, Style, Advanced)
├─ FieldRenderer.tsx (generic field UI)
├─ JsonArrayField.tsx (expandable item list)
├─ controls/ (specialized editors)
│  ├─ ColorPicker.tsx
│  ├─ SpacingControl.tsx (padding/margin/offset)
│  ├─ BorderRadiusControl.tsx
│  ├─ BorderControl.tsx
│  ├─ BackgroundControl.tsx
│  ├─ MediaPicker.tsx
│  └─ FieldRow.tsx (NumberRow, TextRow, SelectRow)
└─ fields/ (field types)
   ├─ FieldRenderer.tsx (dispatcher for all types)
   └─ PageBuilderField.tsx (drag-drop layout field)
```

## FieldRenderer (fields/FieldRenderer.tsx)

Generic renderer for `FieldDef[]`. Routes field type to appropriate UI:

| FieldDef.type | Component | Input | Notes |
|---|---|---|---|
| `text` | `<input type="text">` | String | Fallback default |
| `url` | `<input type="url">` | String | Same as text, diff type attr |
| `textarea` | `<textarea rows=3>` | String | Resizable via CSS |
| `number` | `<input type="number">` | Number | |
| `select` | `<select>` | String | Requires options array |
| `toggle` | Checkbox + label | Boolean | Label inline, not above |
| `json-array` | `JsonArrayField` | Array | Uses itemFields schema |

## JsonArrayField (fields/JsonArrayField.tsx)

Renders `FieldDef` with type `json-array`.
- List of expandable items
- Each item has sub-fields (from `itemFields`)
- Add/remove item buttons
- Stores as array in `block.config[key]`

Example: testimonials block → items array with quote/author/role/company/avatarUrl fields.

## ColorPicker (controls/ColorPicker.tsx)

Floating color picker:
- Hex, RGB, HSL format tabs
- Eyedropper (optional)
- Recent colors
- Opacity slider
- Display format persisted alongside value

Usage: fill controls, text color, border color.

## SpacingControl (controls/SpacingControl.tsx)

4-side spacing editor (padding, margin, offset):

### Collapsed state
- Single scrub input (applies to all sides uniformly)
- Shows "Mixed" label when sides differ
- Expand button (▾)

### Expanded state
- 2×2 grid for 4 sides (Top/Right/Bottom/Left)
- `SideInput`: scrub label + number input + unit dropdown (px, rem, %)
- Reset button when any side is set

### Modes
- **Padding**: CSS keys `paddingTop/Right/Bottom/Left`
- **Margin**: CSS keys `marginTop/Right/Bottom/Left`
- **Offset**: CSS keys `top/right/bottom/left` (for positioned elements)

### Props
- `label` — "Padding", "Margin", "Offset"
- `value` — current spacing object
- `onChange` — callback with new spacing
- `forceExpanded` — skip collapsed state (used for Offset)

## BorderRadiusControl (controls/BorderRadiusControl.tsx)

Corner radius editor:

### Collapsed
- Single "Radius" scrub input (applies to all corners equally)
- Expand button

### Expanded
- 2×2 grid: top-left, top-right, bottom-right, bottom-left
- Each is a scrub input with unit support (px, rem, %)
- Reset button

### CSS Keys
- `borderTopLeftRadius`
- `borderTopRightRadius`
- `borderBottomRightRadius`
- `borderBottomLeftRadius`

## BorderControl (controls/BorderControl.tsx)

Border editor:

### Collapsed
- Single "Border" width scrub input (all sides equally)
- Expand button

### Expanded
- 2×2 grid of side widths (Top/Right/Bottom/Left)
- Style dropdown: none / solid / dashed / dotted / double
- Color swatch (opens `ColorPicker`)
- Reset button

### CSS Keys
- `borderTopWidth`, `borderRightWidth`, `borderBottomWidth`, `borderLeftWidth`
- `borderStyle`
- `borderColor`

## BackgroundControl (controls/BackgroundControl.tsx)

Background styling:

- Solid color picker
- Image upload (`MediaPicker`)
- Background size select (cover / contain / repeat)
- Background position select (center / top / bottom)
- Opacity slider

## MediaPicker (controls/MediaPicker.tsx)

Image/media selection:
- Browse EmDash media library (or fetch from API)
- Upload new image
- Select from recent
- Crop/resize (future)

Returns: `{ src, alt }` object.

## FieldRow (controls/FieldRow.tsx)

Single-line control row for Advanced tab:

### NumberRow
- Scrub label + number input
- Drag label to scrub value
- Stored in `advanced`

### TextRow
- Text input
- Stored in `advanced`

### SelectRow
- Custom dropdown (not `<select>`)
- Options passed as prop
- Stored in `advanced`

All wrapped in `FieldGroup` (border + reset button).

## Label Styling System

All labels follow consistent visual rules:

| Context | Class | Color | Uppercase | Hover |
|---|---|---|---|---|
| Field label (above input) | `epx-field__label` | `--epx-text-faint` | no | none |
| Row label (non-scrub) | `epx-side-input__label--row` | `--epx-text-faint` | no | none |
| Row label (scrub) | `epx-side-input__label--scrub` | `--epx-text-faint` | no | blue accent |
| Section header | `epx-row-label--section` | `--epx-text-faint` | YES | none |
| Side label (T/R/B/L) | `epx-side-input__label` | `--epx-text-faint` | YES (9px) | blue accent |
| Collapsed scrub | `epx-side-input__label--full` | `--epx-text-faint` | YES | blue accent |
| Expanded section | `epx-spacing-ctrl__label` | `--epx-text-faint` 65% opacity | YES | none |

### Dirty State
When modified, label lightens toward white:
```css
color: color-mix(in srgb, var(--epx-text-faint), white 45%)
```

Applied via parent class `is-dirty` on control elements.

## CodeEditor (inline in RightPanel.tsx)

Custom CSS editor:
- Dark-only theme (Catppuccin Mocha)
- Line numbers column (synced scroll)
- Tab key inserts 4 spaces
- Header shows block selector with copy button
- Height: min 140px, no max, vertically resizable

## Props Passed to Controls

From `RightPanel`:
- `value` — current config value
- `onChange` — update handler
- `isDirty` — whether field differs from default (for label color)
- `block` — full SectionBlock (for preview context)

## TODO

- [ ] Add image field type + MediaPicker integration
- [ ] Add rich-text field type (Portable Text editor)
- [ ] Add responsive breakpoint toggle (show mobile/tablet overrides)
- [ ] Add gradient editor for backgrounds
- [ ] Add typography control (font-family, weight, size, line-height)
- [ ] Add shadow control (text-shadow, box-shadow)
