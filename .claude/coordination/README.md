# Multi-agent coordination

Three sub-agents (A, B, C) work in parallel on separate Git branches and rebase off `main` after every phase merge. The orchestrator (this thread) splits tasks, mediates boundary conflicts, owns `src/types.ts`, and merges agent branches at phase boundaries.

Source of truth for the plan: `../../../raport-empixel-emdash.html` (sections 5 + 6, including the multi-agent table). This README is a working summary — when it conflicts with the report, the report wins.

## Roles

| Agent | Domain | Primary files |
|-------|--------|---------------|
| **A — Backend / Infra** | Plugin runtime, DB, storage abstraction, capabilities, peer deps, migrations, server-side hooks | `src/plugin.ts`, `src/components/db.ts`, `src/dbShared.ts` (new), `src/migrations/*` (new), `package.json`, `src/index.ts` |
| **B — Frontend Astro** | Render path, CSS generation, theme selector, reset, media URL resolver, cache hint | `src/components/*.astro`, `src/components/styleUtils.ts`, `src/components/media.ts` (new), `src/components/index.ts` |
| **C — Admin UI** | RightPanel standardization, declarative schema, tab renderer, code-split, Canvas, field-bound blocks | `src/admin/RightPanel.tsx`, `src/admin/blockDefinitions.ts`, `src/admin/right-panel/*` (new), `src/admin/controls/*`, `src/admin/previews/*`, `src/admin/builder/*`, `src/admin/Canvas.tsx` |

Full ownership table: [`ownership.md`](ownership.md).

## Phase order

`F1 → F2 → F3 → F3.5 → F3.6 → F4`. A phase advances **only** when all three agents have reported `Done` for their tasks in `status/agent-{a,b,c}.md` and the orchestrator has run `npm run lint && npm run typecheck && npm test && npm run build` green on the merged branch.

| Phase | Release | Lead split |
|-------|---------|------------|
| F1 | 0.7.1 | A: F1.1, F1.4, F1.5. B: F1.2, F1.3. C: idle / F3.5 prep |
| F2 | 0.8.0 | A: F2.1, F2.3. B: F2.2, F2.4. C: optional F3.5 prep (extract `AdvancedTab.tsx`) |
| F3 | 0.9.0 | A: F3.1, F3.2, F3.3, F3.5(drop peer). B: F3.4. C: F3.5 prep |
| F3.5 | 0.9.5 | C exclusive (F3.5.1–F3.5.8). A and B in support mode |
| F3.6 | 0.9.6 | A: F3.6.4 migration. B: F3.6.3 helper export, F3.6.4 drop fallback, F3.6.7 partial. C: F3.6.1, .2, .3, .5, .6, .7 partial, .8 |
| F4 | 1.0.0 | A: F4.2. B: F4.1, F4.10. C: F4.3, F4.4, F4.5, F4.6, F4.7, F4.8, F4.9 |

## Communication mechanism

File-based check-ins, not chat. Each agent reads `ownership.md` + `interfaces.md` first, then writes to its own `status/agent-{a,b,c}.md` when starting and finishing each task. The log under `status/` is append-only — nothing gets edited in place.

```
.claude/coordination/
├── README.md           # this file
├── ownership.md        # who owns which files (orchestrator-only writes)
├── interfaces.md       # cross-agent contracts (signatures, shapes)
├── types-proposals.md  # append-only log of types.ts change requests
├── status/
│   ├── agent-a.md      # append-only progress log
│   ├── agent-b.md
│   └── agent-c.md
└── blocked/            # one file per blocker; orchestrator clears them
```

## Hard rules

1. **Never modify theme code.** `emdash_wpx/wpx-em-novapera/` and any other EmDash site is off-limits. All fixes live inside `emdash_plugins/empixel-buider/`. The only exception is `src/add.js` (the `npx empixel-builder add` install script) — keep it minimal.
2. **One PR per task.** F1.1, F1.2, ... each ships its own PR. No combined PRs across tasks. No phase-N+1 PR before phase N is fully merged.
3. **Pipeline green before every PR**: `npm run lint && npm run typecheck && npm test && npm run build`.
4. **PRD sync mandatory.** Every PR updates the relevant `.claude/prd-*.md` files in the same change. Pick the file from the table in `../CLAUDE.md`. No "I'll update PRDs later" follow-ups.
5. **`src/types.ts` is orchestrator-owned.** Sub-agents never edit it. They append a proposal to `types-proposals.md`; the orchestrator reviews, applies in a small dedicated PR, and notifies consumers to rebase.
6. **No direct push to `main`.** Agents work on `feature/agent{A|B|C}-<task-id>` branches. Only the orchestrator merges, and only at phase boundaries.
7. **KISS.** When two solutions work, pick the simpler one.

## Conflict resolution

- **Boundary clash** — agent A wants to change a signature consumed by B → A appends to `interfaces.md` (or `types-proposals.md` if it's a type), orchestrator notifies B, consensus or orchestrator decision, then A implements.
- **File lock** — two agents need the same file → serialize. First agent finishes and merges, second rebases. Communicated via a file under `blocked/`.
- **Type drift** — only `types-proposals.md` plus the orchestrator's `types.ts` PR. No agent commit may touch `types.ts`.
- **Red pipeline at phase boundary** — do not advance. Open a `blocked/` file naming the failing test/task and which agent introduced it. Route back.

## Daily standup

After each phase boundary (or end of day during long phases), the orchestrator aggregates from `status/agent-*.md` and posts to the user:

```
## Daily standup — YYYY-MM-DD
### Agent A: <last completed> — <currently in progress>
### Agent B: ...
### Agent C: ...
### Blockers: <list or "none">
### ETA next phase: <X days>
```
