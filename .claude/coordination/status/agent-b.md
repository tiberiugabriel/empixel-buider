# Agent B — Frontend Astro

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: render path (Astro components), CSS generation, theme selector, reset CSS, media URL resolver, cache hint, frontend `db.ts` reader.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentB-<task-id>` (e.g. `feature/agentB-F1.2`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentB-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR — especially `prd-frontend.md` and `prd-breakpoints.md` for any `styleUtils.ts` change.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-09 10:05 · F1.2 started

## In progress

*(empty)*

## Done

## 2026-05-09 10:08 · F1.2 done

- darkBlockSelector now emits a single compound selector via `:is(...)` covering Tailwind (`html.dark`), `html[data-theme="dark"]`, ancestor `[data-theme="dark"]`, EmDash admin `[data-mode="dark"]`, and self `[data-epx-block][data-theme="dark"]`. Plugin's `styleDark` variants apply regardless of host theme convention.
- Files: src/components/styleUtils.ts, tests/styleUtils.test.ts, .claude/prd-frontend.md, .claude/coordination/status/agent-b.md
- Pipeline: green (lint, typecheck, 74/74 tests, build)

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
