# empixel-builder — Admin Builder UI

## Role
React-based drag-and-drop editor for composing page layouts. Three-panel orchestration with state management.

## Architecture

```
BuilderPage.tsx (loader + entry: renders Builder)
  └─ Builder.tsx (state + all orchestration)
       ├─ builderReducer.ts (pure reducer + state types)
       ├─ BuilderStyles.tsx (CSS-in-JS styles injected into head)
       ├─ Canvas.tsx (drag-drop + tree rendering)
       ├─ LeftPanel.tsx (block palette + breakpoints settings)
       ├─ RightPanel.tsx (properties editor — 3 tabs)
       ├─ StructurePanel.tsx (layer tree panel, collapsible, drag-drop)
       ├─ BlockOverlay.tsx (hover/select feedback)
       ├─ ContextMenu.tsx (right-click menu)
       └─ components/
            ├─ ThemeToggle.tsx
            ├─ BreakpointSwitcher.tsx
            ├─ BreakpointIcons.tsx
            ├─ DragGhost.tsx
            └─ ToastContainer.tsx
```

## Files
- `src/admin/BuilderPage.tsx` — Entry point: loads plugin, routes to Builder or SettingsPage
- `src/admin/builder/Builder.tsx` — Main orchestrator (state, DnD context, panels layout)
- `src/admin/builder/builderReducer.ts` — Pure reducer + State/Action types
- `src/admin/builder/BuilderStyles.tsx` — Injects CSS custom properties
- `src/admin/Canvas.tsx` — @dnd-kit canvas, renders block tree
- `src/admin/LeftPanel.tsx` — Block palette + breakpoints config UI
- `src/admin/RightPanel.tsx` — Properties editor (3 tabs: Fields, Style, Advanced)
- `src/admin/StructurePanel.tsx` — Layer tree, collapsible, drag-drop reorder
- `src/admin/BlockOverlay.tsx` — Hover/selection feedback
- `src/admin/ContextMenu.tsx` — Right-click context menu
- `src/admin/SettingsPage.tsx` — Per-entry enable/disable UI
- `src/admin/blockDefinitions.ts` — Block schemas (source of truth)
- `src/admin/treeUtils.ts` — Tree operations
- `src/admin/epxVars.ts` — CSS custom properties map

## State (builderReducer.ts)

### State shape
```ts
type State = {
  sections: SectionBlock[];
  selectedId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  error: string | null;
  saveError: string | null;
};
```

Note: **no undo/redo history stack** yet — that is a planned feature.

### Action types
| Action | Effect |
|--------|--------|
| `LOAD_START` | isLoading = true |
| `LOAD_SUCCESS` | sections loaded, isDirty = false |
| `LOAD_ERROR` | error set |
| `ADD_BLOCK` | append to sections root |
| `UPDATE_BLOCK` | merge config patch into block |
| `REMOVE_BLOCK` | remove from tree (deselects if selected) |
| `REORDER` | replace root sections array |
| `SELECT` | set selectedId |
| `SAVE_START` / `SAVE_SUCCESS` / `SAVE_ERROR` | isSaving/saveError |
| `ADD_TO_CONTAINER` | add block into container's children/slot |
| `MOVE_BLOCK` | remove from source, insertAtPath to target |
| `REORDER_IN_CONTAINER` | reorder within a container/slot |
| `INSERT_AFTER` | insert block after a given block id |
| `DUPLICATE_BLOCK` | deep-clone block, insert after original |
| `PASTE_SETTINGS` | merge clipboard config into target block |

## State Lifecycle

1. Mount → fetch layout from API (`LOAD_START` → `LOAD_SUCCESS`)
2. Mount → fetch breakpoints config from API
3. User action → dispatch reducer
4. RightPanel onChange → `UPDATE_BLOCK`
5. Save → POST layout + (if dirty) POST breakpoints
6. `beforeunload` guard if `isDirty || isBreakpointsDirty`

## Builder.tsx — Local State

Beyond reducer state, Builder.tsx holds:

| State | Type | Purpose |
|-------|------|---------|
| `leftWidth / rightWidth` | number | Panel widths (drag resize) |
| `leftCollapsed / rightCollapsed` | boolean | Panel collapse |
| `structureHeight / structureCollapsed` | number/bool | Structure panel size |
| `overBlockId` | string \| null | Canvas drop hover target |
| `structureDropTarget` | StructureDropTarget | Structure panel drop indicator |
| `contextMenu` | { x, y, blockId } \| null | Active context menu |
| `clipboardBlock` | SectionBlock \| null | Copied full block |
| `clipboardSettings` | Record \| null | Copied block config |
| `activeBreakpoint` | BreakpointId | Current breakpoint view |
| `liveCanvasWidth` | number \| null | Real-time canvas width during resize |
| `breakpointsConfig` | BreakpointsConfig | Enabled BPs + px overrides |
| `isBreakpointsDirty` | boolean | Unsaved breakpoint changes |
| `showBackWarning` | boolean | Unsaved-changes modal |

## Canvas

### Drag-Drop Flow (@dnd-kit)
Three drag kinds:
1. `kind: "new-block"` — dragged from LeftPanel palette
2. `kind: "block"` — existing block reorder within canvas
3. `kind: "structure-block"` — drag within StructurePanel

Drop targets:
- `CANVAS_DROP_ID` — canvas background (only containers allowed at top level)
- `kind: "empty-zone"` — empty zone inside container/slot
- `kind: "block"` — existing block (insert after or move into container)

On drop → dispatches ADD_BLOCK, ADD_TO_CONTAINER, INSERT_AFTER, MOVE_BLOCK, REORDER, or REORDER_IN_CONTAINER.

### Canvas features
- Resizable via drag handles on left + right edges (double-click to collapse)
- Preview width constraint for non-desktop breakpoints (CSS max-width on inner wrapper)
- Live width display in topbar when resizing non-desktop breakpoint

## LeftPanel

- Lists BLOCK_DEFINITIONS grouped by category
- Each block card is a `useDraggable` source
- Click-to-add via `onAddBlock` callback (adds to selected container or root if container)
- Bottom section: breakpoints configuration (toggle on/off, px override)

## RightPanel

See [prd-rightpanel.md](prd-rightpanel.md) for full details.

Three tabs:
- **Fields** — Block-specific content fields from `def.fields[]`
- **Style** — Background, BorderRadius, Border, BoxShadow (each with Normal/Hover toggle)
- **Advanced** — Width/Height, Padding, Margin, Position, Offset, Z-Index, CSS ID/Classes, Custom CSS

Receives `activeBreakpoint` and `breakpointsConfig` props for per-breakpoint style writes.

## StructurePanel

Layer tree showing the full sections tree:
- Collapsible (toggle button, persists height via drag handle)
- Shows block icon + label for each block
- Click → select block
- Right-click → context menu
- Drag rows to reorder (`kind: "structure-block"`)
- Drop indicator shows before/after/inside position

## ContextMenu

Right-click menu on any block (canvas or structure panel):
- Edit (select block)
- Duplicate
- Copy (full block to clipboard)
- Copy Settings (config only)
- Paste (insert cloned clipboard block after)
- Paste Settings (merge clipboard config into block)
- Delete

Clipboard is per-session (React state in Builder.tsx).

## Tree Utilities (treeUtils.ts)

All operations return new arrays (immutable):

| Function | Signature | Purpose |
|----------|-----------|---------|
| `findBlockById` | `(id, sections)` | Locate block anywhere in tree |
| `findPath` | `(id, sections)` | Returns `{ level: "top", index }` or `{ level: "container", containerId, slotIndex, index }` |
| `updateBlockInTree` | `(id, config, sections)` | Merge config patch |
| `removeFromTree` | `(id, sections)` | Delete block |
| `addToContainer` | `(containerId, slotIndex, block, sections)` | Append to container |
| `insertAtPath` | `(block, path, sections)` | Insert at specific path |
| `reorderInContainer` | `(containerId, slotIndex, newOrder, sections)` | Replace container children |
| `isDescendant` | `(ancestorId, targetId, sections)` | Guard against dropping parent into child |
| `deepCloneBlock` | `(block)` | Deep clone with new UUIDs |

## Topbar

Left: Back button, ThemeToggle, page title link (opens in new tab)
Center: "Unsaved changes" badge, save error message
Right: Canvas width label, BreakpointSwitcher, Save button

Save button disabled when: isSaving OR (not isDirty AND not isBreakpointsDirty)

## Dirty State

- `isDirty` — layout sections changed
- `isBreakpointsDirty` — breakpoints config changed
- Both trigger `beforeunload` guard
- Back button shows warning modal if either is dirty

## TODO

- [ ] Add UNDO action + history stack (push before every mutation)
- [ ] Add undo/redo UI buttons in topbar
- [ ] Add keyboard shortcuts (Delete, Ctrl+Z, Ctrl+D)
- [ ] Add block search/filter in LeftPanel palette
- [ ] PageSelector: allow switching entry from within builder
