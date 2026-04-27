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
