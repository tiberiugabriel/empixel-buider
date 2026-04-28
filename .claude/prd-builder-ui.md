# empixel-builder — Admin Builder UI

## Role
React-based drag-and-drop editor for composing page layouts. Three-panel orchestration with state management.

## Architecture

```
BuilderPage.tsx (state + reducer)
  ├─ Canvas.tsx (drag-drop + tree rendering)
  ├─ LeftPanel.tsx (block palette)
  ├─ RightPanel.tsx (properties editor)
  └─ BlockOverlay.tsx (hover/select feedback)
```

## Files
- `src/admin/index.tsx` — Plugin page entry point (loader)
- `src/admin/BuilderPage.tsx` — Main orchestrator, state reducer, API calls
- `src/admin/Canvas.tsx` — DnD canvas, renders tree via @dnd-kit
- `src/admin/LeftPanel.tsx` — Block palette (type list + drag source)
- `src/admin/RightPanel.tsx` — Properties panel (3 tabs: Fields, Style, Advanced)
- `src/admin/BlockOverlay.tsx` — Hover/selection feedback
- `src/admin/treeUtils.ts` — Recursive tree mutation functions
- `src/admin/epxVars.ts` — CSS custom properties (colors, spacing)

## State

### BuilderPageState
```ts
{
  sections: SectionBlock[];        // Root-level blocks
  selectedId: string | null;       // Currently selected block ID
  editingParentId: string | null;  // For nested editing mode
  isDirty: boolean;                // Unsaved changes
  history: PageLayout[];           // Undo stack
}
```

### Reducer Actions
- `SELECT_BLOCK` — Set selectedId
- `ADD_BLOCK` — Insert at root or into parent
- `REMOVE_BLOCK` — Delete from tree
- `UPDATE_BLOCK` — Modify config
- `MOVE_BLOCK` — Drag-drop position change
- `LOAD_LAYOUT` — Initialize from API
- `SAVE_LAYOUT` — Persist to API
- `UNDO` — Pop history stack

## State Lifecycle

1. **Mount** → `LOAD_LAYOUT` (fetch from backend)
2. **User action** → dispatch reducer (e.g., `ADD_BLOCK`, `UPDATE_BLOCK`)
3. **Config changes** → `UPDATE_BLOCK` (from RightPanel)
4. **Save** → `SAVE_LAYOUT` (POST to backend)
5. **Error** → show toast, revert state

## Canvas

### Drag-Drop Flow (@dnd-kit)
1. LeftPanel blocks are drag sources (dnd id = `block-template-{type}`)
2. Canvas has drop zones:
   - Root drop area (sections level)
   - Block hover → highlight droppable area
   - Nested zone (inside containers)
3. On drop → `ADD_BLOCK` reducer action

### Rendering
- Recursively renders SectionBlock tree
- Each block shows preview component + selection outline
- SelectedId block gets `data-selected` for CSS styling
- BlockOverlay shows hover/selection feedback

## LeftPanel

### Block Palette
- Lists all BlockDef[] from backend
- Grouped by category (core, general)
- Drag-enabled for canvas
- Search/filter (future)

## RightPanel

Three tabs for property editing:

### Tab 1: Fields
Block-specific content fields (from `blockDefinitions.ts` → `fields[]`).
- Uses `FieldRenderer.tsx` to render each field
- Updates `block.config[key]` on change
- Dirty state tracking per field

### Tab 2: Style
Visual styling controls (colors, spacing, borders, radius).
- `ColorPicker` for color fields
- `SpacingControl` for padding/margin/offset
- `BorderRadiusControl` for corner radius
- `BorderControl` for border styling
- Custom CSS editor
- All stored in `block.config.style`

### Tab 3: Advanced
Layout & positioning (width, height, position, z-index, CSS classes).
- `DimensionControl` for width/height with min/max
- Position select (relative/absolute/fixed/sticky)
- `SpacingControl` for offset (top/right/bottom/left)
- Z-index scrubber
- CSS ID and classes
- All stored in `block.config.advanced`

## Tree Utilities (treeUtils.ts)

Immutable tree operations:

- `findPath(sections, id)` → path array (indices to block)
- `insert(sections, parentPath, type, index)` → sections with new block
- `remove(sections, path)` → sections with block deleted
- `update(sections, path, patch)` → sections with config merged
- `move(sections, fromPath, toPath)` → sections with block moved

All return new arrays (no mutation).

## Dirty State Tracking

- Compare current config against `blockDefinitions.defaultConfig[type]`
- Used for label styling (lighter color when dirty)
- Form reset button appears when dirty

## TODO

- [ ] Add undo/redo stack to reducer + UI buttons
- [ ] Add block search/filter in LeftPanel
- [ ] Add "Add Column" button in canvas for columns block
- [ ] Add live preview feedback (color/spacing changes update preview in real time)
- [ ] Add keyboard shortcuts (delete, duplicate, undo/redo)
- [ ] Add responsive breakpoint editor
