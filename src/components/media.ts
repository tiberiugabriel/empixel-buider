// Storage-agnostic media URL resolution for the frontend.
//
// EmDash exposes a synchronous URL builder on the request locals:
// `Astro.locals.emdash.getPublicMediaUrl(storageKey)` returns a fetchable URL
// produced by whichever storage adapter is active (local, S3, R2, …).
// Plugin layouts persist `storageKey` references and this helper turns
// those keys into URLs without hardcoding the local-runtime path.
//
// In Astro frontmatter, pass `Astro.locals` (or any object with the same
// shape). Outside an Astro request — tests, edge cases — the resolver
// falls back to the legacy `/_emdash/api/media/file/<key>` URL so older
// integrations don't break mid-rollout. The fallback is the only place
// the legacy path remains in `src/components/`.
//
// Rationale: Section 5 Q3 / Section 4 T4 of `raport-empixel-emdash.html` —
// the plugin must adapt to the host's storage adapter, not assume one.
//
// The shape mirrors EmDash's own typing
// (node_modules/emdash/dist/astro/types.d.mts):
//   `getPublicMediaUrl?: (storageKey: string) => string`
// so consumers can pass `Astro.locals` directly.

interface EmDashMediaLocals {
  getPublicMediaUrl?: (storageKey: string) => string | undefined;
}

interface EmDashLocals {
  emdash?: EmDashMediaLocals;
}

export interface ResolveMediaUrlOptions {
  /**
   * Astro `Astro.locals` (or any object with `.emdash.getPublicMediaUrl`).
   * Pass `Astro.locals` from a `*.astro` frontmatter; everything else is
   * read-only.
   */
  locals?: EmDashLocals;
}

/**
 * Resolve an EmDash storage key to a public, fetchable URL.
 *
 * Returns `null` only when `key` is empty / falsy; an unresolvable key
 * (no adapter, no fallback) still yields a string so `<img src=…>` doesn't
 * break in transitional setups.
 *
 * @param key       Storage key persisted in the layout JSON (e.g. `image.storageKey`).
 * @param opts.locals  Astro request locals — pass `Astro.locals` from `.astro` frontmatter.
 */
export function resolveMediaUrl(
  key: string | undefined | null,
  opts?: ResolveMediaUrlOptions,
): string | null {
  if (!key) return null;

  const adapter = opts?.locals?.emdash;
  if (adapter?.getPublicMediaUrl) {
    const url = adapter.getPublicMediaUrl(key);
    if (url) return url;
  }

  // Legacy fallback — the local-runtime route. Keeps the helper safe to
  // call from unit tests and from older host installations that haven't
  // wired `getPublicMediaUrl` onto `Astro.locals.emdash` yet.
  return `/_emdash/api/media/file/${encodeURIComponent(key)}`;
}

/**
 * Sync resolver type used by `styleUtils.ts` so CSS generation can keep
 * its synchronous shape. Astro components build a closure
 * `(key) => resolveMediaUrl(key, { locals: Astro.locals })` and pass it via
 * the helper's `opts.resolveMediaUrl`.
 */
export type MediaUrlResolver = (key: string) => string | null;
