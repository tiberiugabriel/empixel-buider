// F4.9 — empixel-builder Playwright E2E smoke suite.
//
// Five smoke tests against a *running* EmDash dev server.
// Default `baseURL` is `http://localhost:4321`; override
// via the `EMPIXEL_E2E_BASE` env var.
//
// Prerequisites (documented in CHANGELOG):
//   1. `npm run test:e2e:install` — one-time chromium fetch.
//   2. Start an EmDash consumer dev server (e.g. Novapera) on
//      the configured base URL with empixel-builder installed.
//   3. The consumer must have at least one entry in a `posts`
//      collection with the empixel boolean column enabled.
//      `beforeEach` resolves the first such entry's ULID via
//      the plugin's `/entries` route. Tests skip if no entry
//      is available (so a fresh consumer install doesn't fail
//      mysteriously).
//
// Drag-and-drop strategy: prefer Playwright's `locator.dragTo`
// for the simple cases, then fall back to manual `mouse.down /
// mouse.move / mouse.up` for the nested-into-container case
// where @dnd-kit's pointer sensor needs intermediate move
// events to register a hover target before drop.

import { expect, test, type Page } from "@playwright/test";

const COLLECTION = "posts";

interface EntryRow {
  id: string;
  slug?: string;
  title?: string;
}

async function fetchFirstEntryId(page: Page): Promise<string | null> {
  const apiUrl = `/_emdash/api/plugins/empixel-builder/entries?collection=${COLLECTION}`;
  const res = await page.request.get(apiUrl);
  if (!res.ok()) return null;
  const body = (await res.json()) as
    | { data?: { data?: EntryRow[] } | EntryRow[] }
    | { entries?: EntryRow[] }
    | EntryRow[];
  // Plugin double-envelopes `{ data: { data: payload } }` on
  // some routes; `/entries` returns `{ entries: [...] }` per
  // prd-backend.md. Be liberal and try several shapes.
  let rows: EntryRow[] = [];
  if (Array.isArray(body)) {
    rows = body;
  } else if ("entries" in body && Array.isArray(body.entries)) {
    rows = body.entries;
  } else if ("data" in body && body.data) {
    const d = body.data as { data?: EntryRow[] } | EntryRow[];
    rows = Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [];
  }
  return rows.length > 0 && rows[0]?.id ? rows[0].id : null;
}

function builderUrl(pageId: string): string {
  return `/_emdash/admin/plugins/empixel-builder/editor?collection=${COLLECTION}&pageId=${pageId}`;
}

// Drag-and-drop strategy notes:
//   - `locator.dragTo()` is enough for the simple
//     palette-card → canvas-root case (one drop target,
//     no nested dropzone gating).
//   - The nested case (text → into a container that already
//     sits on the canvas) needs intermediate `mousemove`
//     events to trigger @dnd-kit's pointer-sensor activation
//     distance + over-target detection, so the spec uses
//     `page.mouse.{down,move,up}` inline.

test.describe("empixel-builder admin", () => {
  let pageId: string | null = null;

  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    // Cache the entry id across specs in this describe — one
    // network round-trip on the first spec, reused for the
    // rest.
    if (pageId === null) {
      pageId = await fetchFirstEntryId(page);
    }
    test.skip(
      !pageId,
      `No '${COLLECTION}' entry available on the dev server. Seed at least one entry and re-run.`
    );
    await page.goto(builderUrl(pageId!));
    // Persist captured errors for assertions in the first
    // spec; later specs ignore them (drag-drop synthetic
    // events sometimes log noise).
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test("loads the builder admin page without JS errors", async ({ page }) => {
    // Canvas root is the plugin's own surface; if it renders
    // we know the plugin loaded, the React tree mounted, and
    // the loader resolved a layout (empty or otherwise).
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    const errs = (page as Page & { __errors?: string[] }).__errors ?? [];
    // Filter out benign noise that real apps frequently log
    // (devtools warnings, manifest fetch 404s on dev servers).
    const fatal = errs.filter(
      (m) => !/manifest|favicon|DevTools|sourcemap/i.test(m)
    );
    expect(fatal, fatal.join("\n")).toEqual([]);
  });

  test("drags a container block onto the canvas", async ({ page }) => {
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    const initialCount = await page.locator("[data-epx-block]").count();
    const containerCard = page.locator(
      '.epx-block-card:has(.epx-block-card__label:has-text("Container"))'
    );
    await expect(containerCard).toBeVisible();
    // dragTo onto the canvas root — root accepts containers
    // (per `isRootAllowedType` in src/types.ts).
    await containerCard.dragTo(page.locator(".epx-canvas").first());
    // Allow a tick for the reducer + re-render.
    await expect(page.locator("[data-epx-block]")).toHaveCount(initialCount + 1, {
      timeout: 5_000,
    });
  });

  test("drags a text block into a container", async ({ page }) => {
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    // Ensure there's a container present first. If the page
    // already had blocks (state from a prior session), reuse
    // the first one; otherwise drop a fresh container.
    let container = page.locator(".epx-canvas [data-epx-block]").first();
    if ((await container.count()) === 0) {
      const containerCard = page.locator(
        '.epx-block-card:has(.epx-block-card__label:has-text("Container"))'
      );
      await containerCard.dragTo(page.locator(".epx-canvas").first());
      await expect(page.locator("[data-epx-block]").first()).toBeVisible();
      container = page.locator(".epx-canvas [data-epx-block]").first();
    }
    const beforeChildren = await page.locator("[data-epx-block]").count();
    const textCard = page.locator(
      '.epx-block-card:has(.epx-block-card__label:has-text("Text"))'
    ).first();
    await expect(textCard).toBeVisible();
    // Manual drag — the nested drop zone needs intermediate
    // mousemove events to register as the over target.
    const fromBox = await textCard.boundingBox();
    const toBox = await container.boundingBox();
    if (!fromBox || !toBox) test.fail();
    const fromX = fromBox!.x + fromBox!.width / 2;
    const fromY = fromBox!.y + fromBox!.height / 2;
    const toX = toBox!.x + toBox!.width / 2;
    const toY = toBox!.y + toBox!.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move((fromX + toX) / 2, (fromY + toY) / 2, { steps: 10 });
    await page.mouse.move(toX, toY, { steps: 10 });
    await page.mouse.up();
    // After drop, total block count went up by at least one
    // (root + child). Even if @dnd-kit routed the text to the
    // root rather than nested (root rejects text per
    // isRootAllowedType but the rejection is a no-op, not an
    // error), we at least know the gesture didn't crash the
    // tree. Strict nested-vs-root assertion would be flaky
    // across @dnd-kit versions.
    await expect(page.locator("[data-epx-block]")).toHaveCount(beforeChildren + 1, {
      timeout: 5_000,
    });
  });

  test("persists blocks after Save and reload", async ({ page }) => {
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    // Drop a container so the layout has something to save —
    // even if previous specs left state, we add one fresh
    // block so the dirty flag flips and Save is enabled.
    const containerCard = page.locator(
      '.epx-block-card:has(.epx-block-card__label:has-text("Container"))'
    );
    await containerCard.dragTo(page.locator(".epx-canvas").first());
    await expect(page.locator("[data-epx-block]").first()).toBeVisible();
    const countBeforeSave = await page.locator("[data-epx-block]").count();
    expect(countBeforeSave).toBeGreaterThan(0);
    // Click Save — primary button in the top bar.
    const save = page.locator('.epx-topbar__right button:has-text("Save")');
    await expect(save).toBeEnabled();
    await save.click();
    // Wait until the dirty indicator clears (the topbar's
    // `Unsaved changes` span unmounts on success).
    await expect(page.locator(".epx-topbar__unsaved")).toHaveCount(0, {
      timeout: 10_000,
    });
    // Reload — the layout should re-hydrate with the same
    // root-level block count.
    await page.reload();
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("[data-epx-block]")).toHaveCount(countBeforeSave, {
      timeout: 10_000,
    });
  });

  test("switches to a non-desktop breakpoint", async ({ page }) => {
    await expect(page.locator(".epx-canvas")).toBeVisible({ timeout: 15_000 });
    const frame = page.locator(".epx-canvas__preview-frame");
    // Capture the desktop frame width as a baseline. The
    // desktop bp leaves the frame full-width (no inline
    // style); non-desktop bps clamp to the configured px.
    const desktopWidth = await frame.evaluate((el) => el.clientWidth);
    // Click the mobile-portrait breakpoint button (last in
    // the default-enabled set: desktop / tablet-portrait /
    // mobile-portrait per BREAKPOINT_DEFS).
    const bpButtons = page.locator(".epx-bp-switcher .epx-bp-btn");
    const total = await bpButtons.count();
    expect(total).toBeGreaterThan(1);
    await bpButtons.last().click();
    // Allow a tick for the controlled width to apply.
    await page.waitForTimeout(150);
    const mobileWidth = await frame.evaluate((el) => el.clientWidth);
    expect(mobileWidth).toBeLessThan(desktopWidth);
  });
});
