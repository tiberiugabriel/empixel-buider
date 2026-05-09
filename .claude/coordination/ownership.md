# File ownership

Generated from `git ls-files` at the start of the refactor. **Orchestrator-only writes** — agents propose changes via `interfaces.md` or `types-proposals.md`, never edit this file directly.

Legend: ✅ exists today · 🆕 to be created during the refactor · 🔒 orchestrator-owned (never edited by an agent).

## Agent A — Backend / Infra

| File | Status | Notes |
|------|--------|-------|
| `src/plugin.ts` | ✅ | Routes, hooks, capabilities, server-side migrations |
| ~~`src/components/db.ts`~~ | ✅ | **Handed off to B at F3.4 (2026-05-09).** See Agent B section. |
| `src/dbShared.ts` | 🆕 | F1.5 — singleton DB factory |
| `src/migrations/toStorageV1.ts` | 🆕 | F3.3 — ctx.storage migration |
| `src/migrations/legacySpacing.ts` | 🆕 | F3.6.4 — legacy `none/sm/md/lg/xl` → px |
| `src/storage-types.ts` | 🆕 | F3 — exposes `StorageLayoutsCollection` shape to B |
| `package.json` | ✅ | Peer deps, scripts, version |
| `src/index.ts` | ✅ | Plugin entry, options shape |
| `src/add.js` | ✅ | CLI install — keep minimal, do not extend |
| `tests/sectionsCleanup.test.ts` | ✅ | Tests `plugin.ts` cleanup logic |

## Agent B — Frontend Astro

| File | Status | Notes |
|------|--------|-------|
| `src/components/BlockRenderer.astro` | ✅ | Leaf dispatcher |
| `src/components/BuilderWrapper.astro` | ✅ | Wrapper used by host pages |
| `src/components/db.ts` | ✅ | Frontend reader. **B — fully owned post-F3.4** (handoff complete 2026-05-09). Async, Astro-aware (`getBuilderLayout(astro, collection, entryId, enabled?) → Promise<BuilderLayoutResult>`). Storage-first via `Astro.locals.emdash.db`; legacy `empixel_builder_layouts` SQLite fallback via `getDb()` from `dbShared.ts`, kept until F3.5 drops it. |
| `src/components/Button.astro` | ✅ | |
| `src/components/DividerSpacer.astro` | ✅ | |
| `src/components/Html.astro` | ✅ | |
| `src/components/Icon.astro` | ✅ | |
| `src/components/Image.astro` | ✅ | F2.2 — switch to `<Image image={...} />` from `emdash/ui` |
| `src/components/LayoutRenderer.astro` | ✅ | F1.3 — emit reset CSS once per page |
| `src/components/PortableTextImage.astro` | ✅ | |
| `src/components/SectionContainer.astro` | ✅ | F3.6.4 — drop spacing fallback |
| `src/components/Text.astro` | ✅ | |
| `src/components/TextEditor.astro` | ✅ | |
| `src/components/Video.astro` | ✅ | |
| `src/components/styleUtils.ts` | ✅ | F1.2 — universal dark selector. F3.6.3 — export `buildBlockChromeCss` |
| `src/components/media.ts` | 🆕 | F2.2 — `resolveMediaUrl(key)` helper |
| `src/components/index.ts` | ✅ | Public exports + `blockComponents` map |
| `tests/styleUtils.test.ts` | ✅ | |

## Agent C — Admin UI

| File | Status | Notes |
|------|--------|-------|
| `src/admin/RightPanel.tsx` | ✅ | F3.5.6 — drop hardcoded `block.type ===` branches |
| `src/admin/blockDefinitions.ts` | ✅ | F3.5.2, F3.6.1 — `fieldsTab`/`styleTab` + full `defaultConfig.style` |
| `src/admin/right-panel/icons.tsx` | ✅ | |
| `src/admin/right-panel/types.ts` | ✅ | Local panel types — **does not shadow `src/types.ts`** |
| `src/admin/right-panel/SectionRenderer.tsx` | 🆕 | F3.5.3 |
| `src/admin/right-panel/TabRenderer.tsx` | 🆕 | F3.5.4 |
| `src/admin/right-panel/AdvancedTab.tsx` | 🆕 | F3.5.5 |
| `src/admin/right-panel/sections/*` | 🆕 | F3.5.2 — extracted custom renderers |
| `src/admin/right-panel/blocks/*` | 🆕 | F4.6 — per-block panels |
| `src/admin/Canvas.tsx` | ✅ | F3.6.3 — call `buildBlockChromeCss`. F3.6.5 — full-width root host |
| `src/admin/BuilderPage.tsx` | ✅ | |
| `src/admin/BlockOverlay.tsx` | ✅ | |
| `src/admin/ContextMenu.tsx` | ✅ | |
| `src/admin/LeftPanel.tsx` | ✅ | F4.4 — bound-fields palette |
| `src/admin/PageSelector.tsx` | ✅ | |
| `src/admin/SettingsPage.tsx` | ✅ | |
| `src/admin/StructurePanel.tsx` | ✅ | |
| `src/admin/builder/Builder.tsx` | ✅ | |
| `src/admin/builder/BuilderStyles.tsx` | ✅ | |
| `src/admin/builder/builderReducer.ts` | ✅ | F3.6.2 — `ADD_BLOCK` fills defaults |
| `src/admin/builder/hooks/*` | ✅ | useBlockClipboard, useBuilderPersistence, useDragHandlers, useResizeHandle |
| `src/admin/builder/styles/builder.css` | ✅ | F3.6.5 — canvas root host CSS |
| `src/admin/builder/styles/vars.css` | ✅ | |
| `src/admin/components/*` | ✅ | BlockErrorBoundary, BreakpointIcons, BreakpointSwitcher, DragGhost, ThemeToggle, ToastContainer |
| `src/admin/controls/*` | ✅ | All 24 control files. F4.7 — split BackgroundControl |
| `src/admin/fields/*` | ✅ | FieldRenderer, JsonArrayField, PageBuilderField, RichTextField |
| `src/admin/previews/*` | ✅ | 9 previews + index. F3.6.6 — parity audit |
| `src/admin/epxVars.ts` | ✅ | |
| `src/admin/index.tsx` | ✅ | |
| `src/admin/treeUtils.ts` | ✅ | |
| `tests/builderReducer.test.ts` | ✅ | |
| `tests/treeUtils.test.ts` | ✅ | |

## Orchestrator-owned (🔒)

| File | Reason |
|------|--------|
| `src/types.ts` | Shared by A, B, C. Changes go through `types-proposals.md`. |
| `src/astro-shim.d.ts` | Build infra. Edit only via dedicated orchestrator PR. |
| `tsconfig.json`, `tsconfig.check.json`, `vitest.config.ts`, `eslint.config.js` | Toolchain. |
| `.github/workflows/*` | CI. |
| `.github/ISSUE_TEMPLATE/*`, `.github/pull_request_template.md` | Repo meta. |
| `.gitignore`, `LICENSE`, `CONTRIBUTING.md`, `README.md`, `CHANGELOG.md`, `CLAUDE.md` | Repo docs. CHANGELOG entry per agent PR is added by the agent. |
| `.claude/prd-*.md`, `.claude/rules.md` | PRDs are written by whichever agent owns the change (per CLAUDE.md). Orchestrator polices. |
| `.claude/coordination/*` | This directory. Orchestrator-only writes except `status/agent-*.md` (each agent writes its own) and `types-proposals.md` (append-only by any agent). |
| `package-lock.json` | Regenerated by whoever changes `package.json` — committed in the same PR. |

## File locks during the refactor

These files attract multi-agent edits and need explicit serialization:

- `src/index.ts` — A bumps options shape (F1.5), but Agent C may export new admin types from here later. Serialize.
- `src/components/index.ts` — B exports new helpers; C imports `blockComponents` indirectly. B owns; C consumes via stable name.
- `package.json` — A owns; B/C touch only when adding a new dependency that A approves.
- `CHANGELOG.md` — every agent appends. Append-only with phase headers (`## 0.7.1`). Conflicts resolve trivially.
- `.claude/prd-blocks.md`, `.claude/prd-rightpanel.md`, `.claude/prd-frontend.md` — multi-task touches. Whoever opens the PR first wins; second rebases.
