# empixel-builder — Backend/API

## Role
RESTful API layer for layout persistence and integration with EmDash plugin system.

## Files
- `src/index.ts` — Plugin descriptor (entry point)
- `src/plugin.ts` — 4 REST routes + content hooks
- `src/types.ts` — Block interfaces + type definitions

## API Routes

### `GET /api/plugins/empixel-builder/layout?pageId=<id>`
Fetch layout for a page. Returns `PageLayout` from `empixel_builder_layouts` table or 404.

### `POST /api/plugins/empixel-builder/layout`
Save layout. Body: `{ pageId, sections: SectionBlock[] }`. Returns `{ success, layout }`.
- Validates `pageId` is UUID/slug
- Updates `updatedAt` timestamp

### `GET /api/plugins/empixel-builder/blocks`
List all available blocks (block definitions + metadata). Used by admin UI to populate LeftPanel.
Returns: `{ blocks: BlockDef[] }`

### DELETE `?pageId=<id>`
Delete layout for a page. Called by `content:afterDelete` hook.
Returns: `{ success }`

## Hooks

### `content:afterDelete`
On entry delete, cascade-delete layout from `empixel_builder_layouts`.
Prevents orphaned layouts.

## Database

Table: `empixel_builder_layouts`
```sql
CREATE TABLE empixel_builder_layouts (
  id TEXT PRIMARY KEY,                 -- UUID
  page_id TEXT NOT NULL,               -- Foreign key: page slug
  collection_id TEXT NOT NULL,         -- Collection name
  layout JSONB NOT NULL,               -- { sections: SectionBlock[] }
  updated_at TEXT NOT NULL,            -- ISO 8601 timestamp
  created_at TEXT NOT NULL             -- ISO 8601 timestamp
);
CREATE INDEX idx_page_id ON empixel_builder_layouts(page_id);
```

## Data Flow

1. Admin UI calls `POST /layout` with sections tree
2. Backend validates, serializes as JSONB, updates DB
3. Frontend (`getBuilderLayout()`) fetches via `GET /layout`, deserializes
4. On delete, hook cleans up DB row
5. CLI install script creates table schema

## TODO

- [ ] Add validation for section IDs (must be UUID v4)
- [ ] Add rate limiting to POST route
- [ ] Add audit logging (who edited, when)
- [ ] Add batch layout export/import
