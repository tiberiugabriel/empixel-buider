# Agent A — Backend / Infra

Append-only log. Most recent entry on top. The orchestrator reads this to decide phase advancement.

## Identity

- **Domain**: plugin runtime, DB, storage abstraction, capabilities, peer deps, migrations, server-side hooks.
- **Owned files**: see `../ownership.md`.
- **Branch prefix**: `feature/agentA-<task-id>` (e.g. `feature/agentA-F1.1`).

## Workflow per task

1. Pull latest `main`. Create branch `feature/agentA-<task-id>`.
2. Read `../ownership.md` and `../interfaces.md`. If you need a change to `src/types.ts`, append to `../types-proposals.md` and stop until the orchestrator merges the type PR.
3. Update **Current task** below with task id + start timestamp.
4. Implement, test, run pipeline (`npm run lint && npm run typecheck && npm test && npm run build`).
5. Update `.claude/prd-*.md` (per `CLAUDE.md`) in the same PR.
6. Append a `## YYYY-MM-DD · F<x.y> done` entry under **Done** below.
7. Open PR, link `interfaces.md` / `types-proposals.md` rows that the change touches.
8. Move to the next task (only after the previous PR is merged).

## Current task

## 2026-05-09 13:05 · F1.1 started

## In progress

*(empty)*

## Done

## 2026-05-09 13:08 · F1.1 done
- Bumped peer deps (`emdash >=0.9.0`, `better-sqlite3 >=12.0.0`), version to 0.7.1, renamed capability `read:content` → `content:read` in both `src/plugin.ts` and `src/index.ts`. Added Node 20+ requirement to README. Pipeline green.
- Files: package.json, package-lock.json, src/plugin.ts, src/index.ts, README.md, CHANGELOG.md, .claude/prd-backend.md
- Pipeline: green (lint + typecheck + 73 tests + build all pass)

## Blocked

*(empty — when blocked, also drop a file under `../blocked/` so the orchestrator sees it on next sync)*
