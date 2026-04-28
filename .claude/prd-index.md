# empixel-builder — Documentation Index

Detailed PRDs split by subsystem. Start here to understand the plugin architecture.

## Quick Links

| Module | File | Purpose |
|--------|------|---------|
| **Backend/API** | [prd-backend.md](prd-backend.md) | REST routes, hooks, database schema |
| **Block System** | [prd-blocks.md](prd-blocks.md) | Block types, definitions, type interfaces |
| **Admin Builder UI** | [prd-builder-ui.md](prd-builder-ui.md) | State management, Canvas, panels, tree ops |
| **RightPanel Controls** | [prd-rightpanel.md](prd-rightpanel.md) | Field renderers, styling controls, CodeEditor |
| **Frontend Components** | [prd-frontend.md](prd-frontend.md) | Astro components, rendering, DB queries |
| **Block Previews** | [prd-previews.md](prd-previews.md) | Live preview system, React components |

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Admin UI (BuilderPage)                     │
├──────────────┬────────────────────────┬──────────────────────────┤
│  LeftPanel   │     Canvas (dnd-kit)   │     RightPanel           │
│ (Palette)    │  (Tree Rendering)      │  (Fields/Style/Advanced) │
└──────────────┼────────────────────────┼──────────────────────────┘
                       ↓
        ┌─────────────────────────────┐
        │   State (sections tree)     │
        │   Reducer (actions)         │
        └──────────┬──────────────────┘
                   ↓
        ┌─────────────────────────────┐
        │   Backend API (/layout)     │
        │   Routes (GET/POST/DELETE)  │
        └──────────┬──────────────────┘
                   ↓
        ┌─────────────────────────────┐
        │   Database (SQLite)         │
        │   empixel_builder_layouts   │
        └─────────────────────────────┘
                   ↑
        ┌─────────────────────────────┐
        │  Frontend (Astro Pages)     │
        │  BlockRenderer + Components │
        └─────────────────────────────┘
```

## Data Flow

### Editing
1. User drags block from LeftPanel → Canvas
2. Canvas dispatches `ADD_BLOCK` action
3. Reducer updates state.sections
4. Canvas re-renders tree with new block
5. RightPanel shows properties for selected block
6. User edits config → `UPDATE_BLOCK` action
7. RightPanel previews update in real time
8. User clicks Save → `SAVE_LAYOUT` action
9. Backend POST /layout → SQLite updated

### Rendering
1. Frontend page queries builder layout via `getBuilderLayout(pageId)`
2. Layout loaded from SQLite
3. Page renders `<BlockRenderer layout={layout} />`
4. BlockRenderer recursively renders sections
5. Each block renders via its Astro component
6. Styles injected from block.config (colors, spacing, etc.)

## Key Concepts

### SectionBlock (Tree Node)
```ts
{
  id: string;                    // Unique per layout
  type: BlockType;               // "testimonials", "container", etc.
  config: Record<string, any>;   // Configuration object
  children?: SectionBlock[];     // For nested blocks
  slots?: SectionBlock[][];      // For columns
}
```

### BlockDef (Schema Definition)
```ts
{
  type: BlockType;
  label: string;
  icon: string;
  category: "core" | "general";
  defaultConfig: {};             // Default values
  fields: FieldDef[];            // Content field schema
  styleFields?: FieldDef[];      // Style field schema
}
```

### State Reducer
Actions: SELECT_BLOCK, ADD_BLOCK, REMOVE_BLOCK, UPDATE_BLOCK, MOVE_BLOCK, LOAD_LAYOUT, SAVE_LAYOUT, UNDO

## File Organization

```
src/
├─ index.ts                         # Plugin descriptor (emdash integration)
├─ plugin.ts                        # Routes + hooks
├─ types.ts                         # All TypeScript interfaces
├─ add.js                           # CLI install script
│
├─ admin/                           # Builder UI (React)
│  ├─ index.tsx                     # Plugin page entry
│  ├─ BuilderPage.tsx               # Orchestrator + reducer
│  ├─ Canvas.tsx                    # @dnd-kit canvas
│  ├─ LeftPanel.tsx                 # Block palette
│  ├─ RightPanel.tsx                # Properties editor
│  ├─ BlockOverlay.tsx              # Hover/selection feedback
│  ├─ SettingsPage.tsx              # Enable/disable per collection
│  ├─ blockDefinitions.ts           # Block schemas (source of truth)
│  ├─ treeUtils.ts                  # Tree operations
│  ├─ epxVars.ts                    # CSS custom properties
│  │
│  ├─ controls/                     # Styling/property controls
│  │  ├─ ColorPicker.tsx
│  │  ├─ SpacingControl.tsx
│  │  ├─ BorderRadiusControl.tsx
│  │  ├─ BorderControl.tsx
│  │  ├─ BackgroundControl.tsx
│  │  ├─ MediaPicker.tsx
│  │  └─ FieldRow.tsx
│  │
│  ├─ fields/                       # Field renderers
│  │  ├─ FieldRenderer.tsx          # Dispatcher
│  │  ├─ JsonArrayField.tsx
│  │  └─ PageBuilderField.tsx
│  │
│  └─ previews/                     # Live preview components
│     ├─ index.ts                   # PREVIEW_MAP export
│     ├─ TestimonialsPreview.tsx
│     ├─ FaqPreview.tsx
│     ├─ PricingPreview.tsx
│     ├─ ContainerPreview.tsx
│     └─ SpacerPreview.tsx
│
└─ components/                      # Frontend (Astro)
   ├─ index.ts                      # Export all components
   ├─ BlockRenderer.astro           # Root layout renderer
   ├─ styleUtils.ts                 # CSS generation
   ├─ db.ts                         # Database queries
   ├─ Testimonials.astro
   ├─ Faq.astro
   ├─ Pricing.astro
   ├─ Spacer.astro
   ├─ Container.astro
   └─ [13 total block components]
```

## Roadmap

### Immediate (v0.2.x)
1. **Complete blockDefinitions.ts** — Add schemas for remaining 8 blocks
2. **Create missing previews** — 8 preview components
3. **Live preview wiring** — Preview components reflect real-time config changes
4. **Canvas UI polish** — Overlay interactions, "add column" button, visual feedback
5. **Undo/Redo** — History stack in reducer + UI buttons

### Short-term (v0.3.x)
- Responsive breakpoints (mobile/tablet/desktop overrides)
- Rich-text field type (Portable Text editor)
- Image field type + MediaPicker
- Block search/filter in LeftPanel
- Keyboard shortcuts (delete, duplicate, undo/redo)

### Later (v0.4+)
- Layout templates/presets
- Responsive visual editor
- Export/import layouts
- Version history / audit trail
- Collaborative editing
- Role-based access control

## Rules (from rules.md)

- **Output**: Short, no filler. Run tools first, show result, stop.
- **Never rewrite files** — Edit specific lines only.
- **No summaries** after changes.
- **blockDefinitions.ts is source of truth** for editor
- **Previews must be live** — Reflect config changes in real time
- **No hardcoded values** in previews
- **No duplicate logic** between admin and frontend
- **Read file before editing**
- **Never hallucinate emdash API** — Check plugin.ts first

## Quick Start

1. Understand block types → [prd-blocks.md](prd-blocks.md)
2. Understand builder UI → [prd-builder-ui.md](prd-builder-ui.md)
3. Understand controls → [prd-rightpanel.md](prd-rightpanel.md)
4. Understand frontend → [prd-frontend.md](prd-frontend.md)
5. Understand previews → [prd-previews.md](prd-previews.md)
6. Understand backend → [prd-backend.md](prd-backend.md)

## Terms

- **Block** — A page element (testimonials, faq, cta, etc.)
- **Layout** — Tree of blocks for a page
- **SectionBlock** — In-memory block representation (id, type, config, children)
- **BlockDef** — Schema definition (fields, defaults, label)
- **Canvas** — The drag-drop editor area
- **Preview** — Live React component showing block in admin UI
- **Component** — Astro server-rendered component for frontend
- **Config** — Block-specific settings (colors, text, layout options)
- **Style** — CSS properties (padding, margin, colors, etc.)
- **Advanced** — Positioning, z-index, CSS classes, custom CSS
