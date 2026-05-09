# empixel-builder — E2E Test Suite

## Role
Browser-driven smoke tests that exercise the admin Builder
end-to-end against a *running* EmDash dev server. Complements
the vitest unit suite (414 tests on pure functions) — covers
the gap that vitest cannot: drag-and-drop wiring, save/load
persistence, breakpoint canvas resize, and JS-error-free page
load.

## Stack

Playwright (`@playwright/test ^1.50.0`), chromium-only via
`Desktop Chrome` device profile. List reporter,
`fullyParallel: true`, `trace: "on-first-retry"`.

## Files

- `playwright.config.ts` — minimal config; `testDir:
  ./tests/e2e`, `baseURL` from `EMPIXEL_E2E_BASE` env or
  `http://localhost:4321`.
- `tests/e2e/builder.spec.ts` — 5 smoke specs.

## How to run

The plugin does **not** ship a bundled host fixture (deferred
during the F4 refactor — see `REMAINING.md` item 5). E2E runs
against a user-controlled dev server.

```sh
# 1. (Once per machine) fetch the chromium binary.
npm run test:e2e:install

# 2. In another terminal, start your EmDash consumer site
#    (e.g. Novapera) which has empixel-builder installed:
#    cd ~/path/to/consumer-site && npx emdash dev

# 3. Back in the plugin checkout, run the suite:
npm run test:e2e

# Override the base URL if your dev server isn't on :4321.
EMPIXEL_E2E_BASE=http://localhost:5173 npm run test:e2e
```

`test:e2e` is **separate** from `npm run test` (which stays
vitest-only) and is **not** wired into `prepublishOnly`.
Publishing the package never blocks on a running dev server.

## Spec inventory

`test.describe("empixel-builder admin")`:

| Spec | What it asserts |
|---|---|
| `loads the builder admin page without JS errors` | `.epx-canvas` renders within 15s; no fatal `pageerror` (after filtering benign manifest/favicon noise). |
| `drags a container block onto the canvas` | After `dragTo()` from the LeftPanel `Container` card to the canvas root, `[data-epx-block]` count increments by 1. |
| `drags a text block into a container` | After a manual pointer drag (with intermediate moves) from the `Text` card to a canvas-rooted block, the block-count increments. |
| `persists blocks after Save and reload` | Drop a container → click `Save` → wait for `.epx-topbar__unsaved` to clear → `page.reload()` → `[data-epx-block]` count matches pre-reload. |
| `switches to a non-desktop breakpoint` | Click the last `.epx-bp-btn` (mobile-portrait by default) → `.epx-canvas__preview-frame` clientWidth shrinks below the desktop baseline. |

## Conventions

### Locating UI

Selectors target the existing CSS class hierarchy (`.epx-*`
prefix). No new `data-test-id` attrs were added — the existing
class structure is stable enough for smoke tests, and adding
test-only attrs would inflate the bundle that real users ship.

If a future spec needs to disambiguate (e.g. "find the
container at depth 2 in the tree"), prefer adding a
`data-block-type` attribute on the canvas wrapper over a
test-only id.

### Drag-and-drop

Two flavors:

1. **Palette → canvas root** — use `locator.dragTo()`. Single
   drop target, no nested gating. Fast and stable.
2. **Palette → nested container** — use manual
   `page.mouse.{move, down, move, move, up}` with `{ steps: 8
   }` and an intermediate midpoint move. @dnd-kit's pointer
   sensor needs the activation-distance threshold + over-target
   detection to fire, which `dragTo` sometimes elides.

### Test data

Specs ask the plugin's own `/entries?collection=posts` route
for the first available entry id and use it as the `pageId`
URL param. `beforeEach` skips (not fails) if the route returns
empty so a fresh consumer install — or one that doesn't seed a
`posts` collection — doesn't fail mysteriously.

### Why no `webServer` config?

Playwright's `webServer` would auto-start a process before the
suite. We don't ship one because the plugin alone can't be
served — it needs a consumer EmDash site that has integrated
it. Once a host fixture exists (deferred), `webServer` is the
right place to wire it; until then the user starts their own
dev server.

## Future work

- Bundle a host fixture (`tests/e2e/fixtures/host-site/`) with
  Astro + emdash + a seeded `posts` collection so the suite is
  truly hermetic. The original F4.9 brief in `REMAINING.md`
  scoped this; deferred to keep 1.0.6 small.
- Add a `webServer` block to `playwright.config.ts` that
  `cd`s into the bundled host and runs `npx emdash dev` on
  spec start.
- Wire `test:e2e` into a CI job separate from the main
  test/lint/typecheck/build workflow (still not in
  `prepublishOnly`).
- Cover hover state, theme dark / light, and breakpoint
  spacing overrides — all four are open browser-test items
  in `REMAINING.md` that vitest can't reach.
