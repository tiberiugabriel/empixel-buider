---
trigger: always_on
---

# empixel-builder — Rules

## Session Start
At the beginning of every new chat, read these two files before doing anything else:
1. `.claude/prd-index.md` — full architecture, file tree, data flow, terminology
2. `.claude/prd.md` — current status, completed features, what's missing, next priorities

Then load the sub-PRD for whichever subsystem the task touches:
| Task area | Sub-PRD |
|-----------|---------|
| Block types, BlockDef, config schema | `prd-blocks.md` |
| Builder UI, reducer, panels, drag-drop | `prd-builder-ui.md` |
| RightPanel controls, hover states | `prd-rightpanel.md` |
| Astro frontend components | `prd-frontend.md` |
| Preview components | `prd-previews.md` |
| API routes, database | `prd-backend.md` |
| Breakpoints, canvas resize | `prd-breakpoints.md` |

## Output Style
- Short sentences. No filler.
- Run tools first, show result, stop.
- No explanations unless asked.
- Never rewrite full files — edit specific lines.
- No summaries after changes.

## Stack
TypeScript strict · React (admin UI) · Astro (frontend components) · SQLite (`better-sqlite3`) · `@dnd-kit` (drag-drop) · emdash plugin API

## Structure
```
src/
  index.ts              # Plugin descriptor
  plugin.ts             # Routes + hooks (6 routes)
  types.ts              # All block interfaces + breakpoint types
  add.js                # CLI install script
  admin/
    BuilderPage.tsx     # Entry loader → Builder or SettingsPage
    Canvas.tsx          # Drag-drop rendering (@dnd-kit)
    LeftPanel.tsx       # Block palette + breakpoints config
    RightPanel.tsx      # Properties editor (3 tabs)
    StructurePanel.tsx  # Layer tree (collapsible)
    BlockOverlay.tsx    # Hover/selection feedback
    ContextMenu.tsx     # Right-click menu
    SettingsPage.tsx    # Per-entry enable/disable
    PageSelector.tsx    # Entry picker
    blockDefinitions.ts # Block schemas (source of truth for editor)
    treeUtils.ts        # Recursive tree ops (immutable)
    epxVars.ts          # CSS custom properties
    builder/
      Builder.tsx         # Main orchestrator + all state
      builderReducer.ts   # Pure reducer + State/Action types
      BuilderStyles.tsx   # CSS injection
    components/           # Shared UI components
      ThemeToggle.tsx
      BreakpointSwitcher.tsx
      BreakpointIcons.tsx
      DragGhost.tsx
      ToastContainer.tsx
    previews/           # Live preview components (React)
    controls/           # ColorPicker, Spacing, Border, BoxShadow, Gap, Layout, etc.
    fields/             # FieldRenderer, JsonArrayField
  components/           # Astro frontend components (zero JS)
```

## Rules

### Adding a new block
1. Add `BlockType` to union in `src/types.ts`
2. Add config interface to `src/types.ts`
3. Add `BlockDef` to `src/admin/blockDefinitions.ts`
4. Add preview component in `src/admin/previews/`
5. Register preview in `src/admin/previews/index.ts` (`PREVIEW_COMPONENTS` map)
6. Add Astro component in `src/components/`
7. Register in `src/components/index.ts` (`blockComponents` map) + `BlockRenderer.astro`

### Block definitions
- `blockDefinitions.ts` is the source of truth for the editor (fields, defaults, label)
- Every block in `types.ts` must have a matching definition
- Defaults must match the type interface exactly

### Previews
- Previews must be live — reflect config props in real time
- No hardcoded values in previews — always use `block.config`
- Keep preview components small; no business logic

### Types
- No `any` — use `unknown` + type guards
- Block config interfaces live in `types.ts`
- Union type `SectionBlock` must include every block

### Frontend (Astro)
- All components are server-rendered, zero client JS
- Image fields: `{ src, alt }` object, use `<Image>` from `emdash/ui`
- Props come directly from the block config interface

### State / tree
- All tree mutations go through `treeUtils.ts`
- State reducer lives in `src/admin/builder/builderReducer.ts`
- All orchestration lives in `src/admin/builder/Builder.tsx`
- Undo/redo: NOT YET IMPLEMENTED — no UNDO action exists yet

## DON'Ts
- No `db push` or direct schema edits outside plugin.ts
- No duplicate block logic between admin previews and Astro components
- No relative imports out of `src/`
- Read file before editing
- Never hallucinate emdash plugin API — check `src/index.ts` + `src/plugin.ts` first
