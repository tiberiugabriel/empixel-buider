# empixel-builder — Plugin for EmDash

Drag-and-drop page builder plugin. Layouts stored as JSON in SQLite, rendered via Astro components.

## Session Start — Required Reading

Read these two files at the start of every chat before doing any work:

1. **`.claude/prd-index.md`** — architecture overview, full file tree, data flow, key concepts, terminology
2. **`.claude/prd.md`** — current version (v0.5.0), completed features, what's in progress, next priorities

Then load the relevant sub-PRD based on the task:

| Task area | File |
|-----------|------|
| Block types, BlockDef, config schema | `.claude/prd-blocks.md` |
| Builder UI, reducer, Canvas, panels | `.claude/prd-builder-ui.md` |
| RightPanel controls, hover states, breakpoint writes | `.claude/prd-rightpanel.md` |
| Astro frontend components, rendering | `.claude/prd-frontend.md` |
| Preview components, PREVIEW_COMPONENTS map | `.claude/prd-previews.md` |
| API routes, database schema | `.claude/prd-backend.md` |
| Breakpoints system, canvas resize | `.claude/prd-breakpoints.md` |

Rules and coding conventions are in **`.claude/rules.md`** (always-on).

## Stack

TypeScript strict · React (admin UI) · Astro (frontend) · SQLite (`better-sqlite3`) · `@dnd-kit` · emdash plugin API

## Key Constraint

Only 5 block types exist right now: `testimonials`, `faq`, `pricing`, `container`, `spacer`.
Only container blocks can be placed at the canvas root level — all others must be inside a container.
