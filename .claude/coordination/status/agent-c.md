# Agent C — Admin UI

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: RightPanel standardization, declarative `BlockDef` schema (`fieldsTab`/`styleTab`), tab renderer, code-split, Canvas refactor, field-bound blocks, theme×state matrix.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentC-<task-id>` (e.g. `feature/agentC-F3.5.1`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentC-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR — especially `prd-blocks.md`, `prd-rightpanel.md`, `prd-builder-ui.md`, `prd-previews.md`.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` / `types-proposals.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-09 17:10 · F3.5.2 started

Branch: `feature/agentC-F3.5.2`. Worktree at latest `main` (`556a1ae`).
Migrating all 9 `BlockDef` instances (`container`, `text`, `image`,
`text-editor`, `video`, `button`, `icon`, `html`, `divider-spacer`)
to the declarative `fieldsTab` + `styleTab` schema introduced in
F3.5.1. Non-trivial Style logic (text-editor columns/dropCap, video
source picker, divider-spacer divider line) extracted into
`src/admin/right-panel/sections/`. The 9 imperative `block.type ===`
branches in `RightPanel.tsx` stay in place — F3.5.6 deletes them.

## 2026-05-09 15:30 · F3.5.1 started

Branch: `feature/agentC-F3.5.1`. Worktree at latest `main` (`ebf3347`).
Adding declarative `StyleSection` discriminated union and
`fieldsTab` / `styleTab` properties to `BlockDef`. Existing `fields` /
`styleFields` kept as deprecated aliases through the F3.5 transition.
No `BlockDef` instances migrated yet (F3.5.2); no `RightPanel.tsx`
rewrite yet (F3.5.6).

## In progress

*(see "Current task")*

## Done

## 2026-05-09 17:42 · F3.5.2 done

Branch: `feature/agentC-F3.5.2`. Single commit (see git log).

**Files changed**:
- `src/admin/blockDefinitions.ts` — all 9 `BlockDef` entries now declare `fieldsTab: FieldDef[]` + `styleTab: StyleSection[]`. `fields` and `fieldsTab` point at the same shared `*_FIELDS` arrays (alias contract preserved). Imports the 4 new section components.
- `src/admin/right-panel/sections/TextEditorDropCapSection.tsx` — new. Paragraph spacing + (conditional) drop-cap subgroup, bp-routed via `BREAKPOINT_DEFS` defaults.
- `src/admin/right-panel/sections/VideoSourceSection.tsx` — new. Aspect ratio (with custom W/H) + `CssFiltersControl`.
- `src/admin/right-panel/sections/DividerLineSection.tsx` — new. Full divider-line picker lifted from the Fields-tab branch (style/width/length/color/gradient editor with stops/preview/markers/align/IconGroup).
- `src/admin/right-panel/sections/IconBlockStyleSection.tsx` — new. Icon color (Normal/Hover) + size + rotate.
- `tests/blockDefinitions.test.ts` — extended. The two F3.5.1 transition assertions (`fieldsTab aliased from fields` / `styleTab undefined`) became `fieldsTab declared on every block` / `styleTab on every block except html`. New `F3.5.2` describe-block adds 9 per-block expected-shape tests + 4 spot-checks.
- `CHANGELOG.md` — F3.5.2 entry above F3.5.1.
- `.claude/prd-blocks.md` — added F3.5.2 instance-shape table + two example BlockDefs (`text`, `html`) + section component file list.
- `.claude/prd-rightpanel.md` — flipped F3.5.2 row to `✅ shipped`.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 139 tests pass (126 → 139, +13 new from the F3.5.2 expansion in `blockDefinitions.test.ts`).

**Style-tab declaration shapes** (length × kind):
- `text` — 5: alignment / typography / textStroke / textShadow / blendMode
- `image` — 6: imgVisual / alignment / opacity / borderRadius / border / boxShadow
- `text-editor` — 4: alignment / typography / textShadow / custom(TextEditorDropCapSection)
- `video` — 1: custom(VideoSourceSection)
- `button` — 6: typography / theme / background / borderRadius / border / boxShadow
- `icon` — 2: alignment / custom(IconBlockStyleSection)
- `html` — absent (Style tab hidden)
- `divider-spacer` — 1: custom(DividerLineSection)
- `container` — 5: theme / background / borderRadius / border / boxShadow

**Custom-section breakpoint handling**: `SectionRenderProps` does NOT include `breakpointsConfig`. Section components fall back to `BREAKPOINT_DEFS[bp].defaultPx` for the `_px` field on `styleBreakpoints[bpId]` writes. F3.5.4's `TabRenderer.tsx` may extend the prop shape if host-customised breakpoints need to flow in — until then the fallback matches default behavior.

**Fields-tab caveat**: container and video have `fieldsTab.length === 0` because their Fields-tab content is not yet expressible as plain `FieldDef[]` (no `kind: "custom"` on the `FieldType` union — only on `StyleSection`). The imperative branches in `RightPanel.tsx` keep ownership for those two blocks until F3.5.6 introduces a Fields-tab `kind: "custom"` hook (mirrors the Style-tab equivalent). No-op for users today; the Fields tab still renders the same content via the imperative path.

**No `src/types.ts` proposal**: no shared-type changes — all new code lives in `src/admin/right-panel/sections/` (Agent C's column) and `src/admin/blockDefinitions.ts`.

**No blockers.**

## 2026-05-09 15:34 · F3.5.1 done

Branch: `feature/agentC-F3.5.1`. Single commit (see git log).

**Files changed**:
- `src/admin/blockDefinitions.ts` — added `StyleSection` discriminated union (19 variants), `SectionRenderProps`, `BackgroundMode = BackgroundType` alias, `TypographyProp = keyof TypographyValue` alias. Extended `BlockDef` with optional `fieldsTab: FieldDef[]` + `styleTab: StyleSection[]`. Marked `fields` / `styleFields` `@deprecated`. Updated `getBlockDef()` to alias `fieldsTab → fields` until F3.5.2 migrates the 9 entries.
- `tests/blockDefinitions.test.ts` — new test file, 6 tests covering schema sanity + the alias contract.
- `CHANGELOG.md` — opened `## Unreleased — 0.9.5 prep` section above `0.9.0`.
- `.claude/prd-blocks.md` — documented new schema + deprecation timeline.
- `.claude/prd-rightpanel.md` — added F3.5 step table at top.
- `.claude/coordination/interfaces.md` — updated `BlockDef` row.
- `.claude/coordination/status/agent-c.md` — start + done entries.

**Pipeline**: `npm run lint && npm run typecheck && npm test && npm run build` all green. 126 tests pass (118 existing + 8 new across 1 new file).

**Backwards-compat strategy**: alias. `getBlockDef()` returns `fieldsTab` aliased from `fields` so existing callers (`RightPanel`, reducer, tests) keep reading `def.fields` and new declarative consumers can read `def.fieldsTab` cleanly. `styleTab` is opt-in until F3.5.6 — no auto-alias from `styleFields` because the shapes differ.

**No `src/types.ts` proposal**: all new types are admin-UI-only and live in `src/admin/blockDefinitions.ts` (Agent C's column). Frontend Astro and plugin runtime do not consume `StyleSection`.

**No blockers.**

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
