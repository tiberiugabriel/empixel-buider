---
trigger: always_on
---

# empixel-builder — Rules

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
  plugin.ts             # Routes + hooks
  types.ts              # All block interfaces
  add.js                # CLI install script
  admin/
    BuilderPage.tsx     # State + orchestration
    Canvas.tsx          # Drag-drop rendering
    LeftPanel.tsx       # Block palette
    RightPanel.tsx      # Properties editor
    blockDefinitions.ts # Block schemas (source of truth for editor)
    treeUtils.ts        # Recursive tree ops
    previews/           # Live preview components (React)
    controls/           # ColorPicker, Spacing, Border, etc.
    fields/             # FieldRenderer, JsonArrayField
  components/           # Astro frontend components (zero JS)
```

## Rules

### Adding a new block
1. Add interface to `src/types.ts`
2. Add definition to `src/admin/blockDefinitions.ts`
3. Add preview component in `src/admin/previews/`
4. Register preview in `src/admin/previews/index.ts`
5. Add Astro component in `src/components/`
6. Register in `src/components/index.ts` + `BlockRenderer.astro`

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
- State reducer lives in `BuilderPage.tsx`
- Undo/redo: push to history stack before every mutation

## DON'Ts
- No `db push` or direct schema edits outside plugin.ts
- No duplicate block logic between admin previews and Astro components
- No relative imports out of `src/`
- Read file before editing
- Never hallucinate emdash plugin API — check `src/index.ts` + `src/plugin.ts` first
