# `src/types.ts` change proposals (append-only)

`src/types.ts` is orchestrator-owned. Agents never modify it directly. To request a change, append a new entry at the bottom of this log. The orchestrator reviews, applies the change in a dedicated `chore: types — <summary>` PR, and notifies all consumers to rebase.

## Format

```
## YYYY-MM-DD · agent-{a|b|c} · <short title>

**Reason**: 1–3 sentences on why the change is needed and which task it unblocks.

**Proposed diff** (or signature):
\`\`\`ts
// before
...
// after
...
\`\`\`

**Consumers affected**: list of files/agents that import from `src/types.ts` and will need to rebase or adapt.

**Status**: open | accepted YYYY-MM-DD | rejected YYYY-MM-DD (reason)
```

## Proposals
