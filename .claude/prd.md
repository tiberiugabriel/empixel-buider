# empixel-builder — PRD (Master)

Drag-and-drop page builder plugin for EmDash. Users visually compose pages using pre-built blocks. Layouts stored as JSON in SQLite, rendered via Astro components.

**Documentation split by subsystem** — See [prd-index.md](prd-index.md) for full architecture.

## At a Glance

| Component | Tech | Files | Status |
|-----------|------|-------|--------|
| Backend | Node.js + SQLite | `src/plugin.ts` | ✅ Done |
| Block System | TypeScript | `src/types.ts`, `blockDefinitions.ts` | 🟡 5/13 blocks defined |
| Admin UI | React + @dnd-kit | `src/admin/` | ✅ 90% done |
| Previews | React | `src/admin/previews/` | 🟡 5/13 components |
| Frontend | Astro | `src/components/` | 🟡 13 components exist, need audit |
| RightPanel | React | `src/admin/` controls + fields | ✅ Done |

## Current State (v0.1.2)

### Completed
✅ 3-panel builder UI with drag-drop (`@dnd-kit`)
✅ Theme toggle (light/dark/system)
✅ Styling controls (ColorPicker, SpacingControl, BorderControl, BorderRadiusControl, custom CSS)
✅ SQLite persistence (layout routes)
✅ Auto-cleanup on entry delete (hook)
✅ CLI install script
✅ Settings page (enable/disable per collection)
✅ Tree utilities (findPath, insert, remove, update)
✅ 13 Astro frontend components
✅ RightPanel with 3 tabs (Fields, Style, Advanced)

### In Progress
🟡 Complete blockDefinitions.ts (5/13 blocks defined)
🟡 Create missing previews (5/13 components exist)
🟡 Live preview wiring (reflect config changes in real time)

### Not Started
⬜ Undo/Redo stack
⬜ Responsive breakpoints
⬜ Rich-text field type
⬜ Image field type

## Block Inventory

**Defined (5):**
- testimonials, faq, pricing, container, spacer

**Implemented frontend (13):**
- testimonials, faq, pricing, spacer, container, section, columns, hero, features, image-text, cta, stats, gallery (+video)

**Missing definitions (8):**
- hero, features, image-text, cta, stats, gallery, video, columns

**Missing previews (8):**
- Same 8 as above

**To add later:**
- heading, paragraph, rich-text, html, image

## Detailed Docs

Split by feature area:

- **[prd-backend.md](prd-backend.md)** — API routes, database, hooks
- **[prd-blocks.md](prd-blocks.md)** — Block types, BlockDef schema, type interfaces
- **[prd-builder-ui.md](prd-builder-ui.md)** — BuilderPage, Canvas, state reducer, tree ops
- **[prd-rightpanel.md](prd-rightpanel.md)** — Controls (ColorPicker, SpacingControl, etc.), field renderers
- **[prd-frontend.md](prd-frontend.md)** — Astro components, BlockRenderer, rendering flow
- **[prd-previews.md](prd-previews.md)** — Live preview components, PREVIEW_MAP

**Start here:** [prd-index.md](prd-index.md)

## Next Priorities

1. **Complete blockDefinitions.ts** — Add missing 8 block definitions
2. **Create missing previews** — 8 preview components
3. **Live preview wiring** — Ensure previews update with config changes
4. **Canvas polish** — Overlay interactions, "add column" button
5. **Undo/Redo** — History stack in reducer
