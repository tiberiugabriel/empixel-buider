// Playwright config — F4.9 (1.0.6).
//
// Minimal config for the smoke suite under `tests/e2e/`. The
// suite runs against a *user-running* EmDash dev server (the
// brief deferred bundling a host fixture); the consumer kicks
// off `npm run test:e2e` after starting `npx emdash dev` on
// their consumer site.
//
// Default `baseURL` matches Astro's default dev port. Override
// via `EMPIXEL_E2E_BASE` for non-default hosts (CI, alternate
// port, remote staging).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: process.env.EMPIXEL_E2E_BASE ?? "http://localhost:4321",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
