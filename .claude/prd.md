# empixel-builder — PRD (Master)

Drag-and-drop page builder plugin for EmDash. Users visually compose pages using pre-built blocks. Layouts stored as JSON in SQLite, rendered via Astro components.

**Documentation split by subsystem** — See [prd-index.md](prd-index.md) for full architecture.

## At a Glance

| Component | Tech | Files | Status |
|-----------|------|-------|--------|
| Backend | Node.js + SQLite | `src/plugin.ts` | ✅ Done (6 routes) |
| Block System | TypeScript | `src/types.ts`, `blockDefinitions.ts` | 🟡 5/5+ blocks defined |
| Admin UI | React + @dnd-kit | `src/admin/` | ✅ Done |
| Previews | React | `src/admin/previews/` | 🟡 5 preview components |
| Frontend | Astro | `src/components/` | 🟡 ~6 block components |
| RightPanel | React | `src/admin/RightPanel.tsx` + controls | ✅ Done |
| Breakpoints | React | `src/admin/components/BreakpointSwitcher.tsx` | ✅ Done |

## Current State (v0.5.0)

### Completed
✅ 3-panel builder UI with drag-drop (`@dnd-kit`)
✅ Theme toggle (light/dark/system)
✅ Styling controls: ColorPicker, SpacingControl, BorderControl, BorderRadiusControl, BoxShadowControl, BackgroundControl, GapControl, LayoutControl, OverflowControl, LinkControl
✅ SQLite persistence (composite PK: collection + entry_id)
✅ Auto-cleanup on entry delete (hook)
✅ CLI install script
✅ Settings page (enable/disable per entry)
✅ Tree utilities (findPath, findBlockById, insert, remove, update, deepClone, isDescendant)
✅ ~6 Astro frontend block components
✅ RightPanel with 3 tabs (Fields, Style, Advanced)
✅ Responsive breakpoints (6 presets, live canvas resize, per-breakpoint style overrides)
✅ StructurePanel (layer tree, collapsible, drag-drop reorder)
✅ ContextMenu (right-click: copy, paste, duplicate, copy settings, paste settings, delete)
✅ Block clipboard (copy full block, paste, copy settings, paste settings)
✅ Hover state styling (normal/hover toggle per control: background, radius, border, shadow)
✅ ThemeStyleToggle (light/dark/accent per block)
✅ HTML Tag selector for container blocks
✅ Duplicate block action
✅ DragGhost custom overlay
✅ Resizable panels (left, right, structure — drag handles)
✅ Back warning modal (unsaved changes)
✅ ToastContainer for save/error feedback
✅ Canvas width preview for non-desktop breakpoints

### In Progress
🟡 Block definitions (5 defined: testimonials, faq, pricing, container, spacer)
🟡 Preview components (5: same 5 as definitions)
🟡 Frontend Astro components (~6: testimonials, faq, pricing, spacer + LayoutRenderer, BlockRenderer)

### Not Started
⬜ Undo/Redo stack (no UNDO action in reducer)
⬜ Rich-text field type
⬜ Image field type (MediaPicker UI exists but not wired)
⬜ Block search/filter in LeftPanel
⬜ Additional block types (hero, features-grid, image-text, cta, stats, gallery, video, columns)

## Block Inventory

**Defined in types.ts + blockDefinitions.ts (5):**
- testimonials, faq, pricing, container, spacer

**Preview components (5):**
- TestimonialsPreview, FaqPreview, PricingPreview, ContainerPreview, SpacerPreview

**Frontend Astro components (~6):**
- Testimonials.astro, FaqSection.astro, PricingSection.astro, SpacerSection.astro
- LayoutRenderer.astro (root renderer), BlockRenderer.astro (block dispatcher)

**To add:**
- hero, features-grid, image-text, cta, stats, gallery, video, columns
- heading, paragraph, rich-text, html, image

## Detailed Docs

- **[prd-backend.md](prd-backend.md)** — API routes, database, hooks
- **[prd-blocks.md](prd-blocks.md)** — Block types, BlockDef schema, type interfaces
- **[prd-builder-ui.md](prd-builder-ui.md)** — Builder, Canvas, state reducer, tree ops
- **[prd-rightpanel.md](prd-rightpanel.md)** — Controls, field renderers, hover states, breakpoints
- **[prd-frontend.md](prd-frontend.md)** — Astro components, BlockRenderer, rendering flow
- **[prd-previews.md](prd-previews.md)** — Live preview components, PREVIEW_MAP
- **[prd-breakpoints.md](prd-breakpoints.md)** — Breakpoint system, canvas resize, per-bp overrides

**Start here:** [prd-index.md](prd-index.md)

## Next Priorities

1. **Add block definitions** — hero, features-grid, image-text, cta, stats, gallery, video, columns
2. **Create preview components** — 1:1 with new block definitions
3. **Create Astro frontend components** — 1:1 with new block definitions
4. **Undo/Redo** — UNDO action + history stack in reducer + topbar buttons
5. **Rich-text field type** — Portable Text / markdown editor
6. **Image field type** — Wire MediaPicker into FieldRenderer
