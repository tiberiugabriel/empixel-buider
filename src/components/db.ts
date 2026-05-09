import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";
import { getDb as getSharedDb } from "../dbShared.js";
import type { LayoutRow } from "../storage-types.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) so they MUST be validated. Loose input
// here is unlikely (host caller), but the cost is one regex test per load.
const COLLECTION_RE = /^[a-z0-9_]+$/;

// EmDash ULIDs — 26-char Crockford base32. Used to short-circuit the slug
// → ULID resolution when the host already passed a canonical id.
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

// Plugin id used to scope reads on the shared `_plugin_storage` table.
// Must match the `id` declared in `src/plugin.ts` `definePlugin({ id })` —
// EmDash partitions every plugin's rows under `(plugin_id, collection)`.
const PLUGIN_ID = "empixel-builder";
// Storage collection name — matches the key declared in
// `definePlugin({ storage: { layouts: ... } })` (src/plugin.ts F3.1).
const STORAGE_COLLECTION = "layouts";

/**
 * Cache hint emitted by `getBuilderLayout` so Astro pages can invalidate
 * when the layout row updates. Matches the `CacheHint` shape EmDash core
 * uses (see `node_modules/emdash/dist/index-DjPMOfO0.d.mts` — same `tags`
 * + `lastModified` pair as `getEmDashEntry` / `getEmDashCollection`).
 *
 * - `tags`        — `["empixel:layout:<collection>:<entryId>"]`. Admin
 *                    saves invalidate the host page by tag.
 * - `lastModified` — Parsed from the layout row's `updated_at` column
 *                    (SQLite `current_timestamp` ISO-8601). Lets HTTP
 *                    caches that look at `Last-Modified` short-circuit
 *                    304s without going through tag invalidation.
 *
 * Re-declared locally rather than importing `CacheHint` from `emdash` so
 * the package keeps a hard runtime peer dep on the type but nothing else
 * — the `Astro.cache.set` consumer pattern only requires structural
 * compatibility.
 */
export interface BuilderCacheHint {
  tags?: string[];
  lastModified?: Date;
}

/**
 * Result returned by `getBuilderLayout` from v0.8.0. The `cacheHint` is
 * suitable to pass straight to `Astro.cache.set(...)` — see README's
 * "Caching builder layouts" section.
 */
export interface BuilderLayoutResult {
  /** The layout's section tree, or `null` when the entry has no layout / builder is disabled. */
  sections: SectionBlock[] | null;
  /** Pass to `Astro.cache.set(cacheHint)`. Always present so callers can call set unconditionally. */
  cacheHint: BuilderCacheHint;
}

/**
 * Minimal subset of the Astro request object the v0.9 reader consumes.
 * Accept `Astro` itself or any hand-built context with the same shape so
 * tests can mock the storage handle without standing up a full Astro
 * runtime, and so non-Astro consumers (a future API route or a custom
 * render path) can still call the helper.
 *
 * `locals.emdash.db` is the Kysely instance EmDash exposes on every
 * request via `Astro.locals.emdash` (see `node_modules/emdash/dist/astro/types.d.mts`
 * line 281). It's the only public surface Astro pages have for talking
 * to the underlying database — `PluginStorageRepository` /
 * `createStorageCollection` are not exported from the `emdash` package
 * today, so the frontend reader queries the shared `_plugin_storage`
 * table directly using the same partitioning scheme EmDash's storage
 * abstraction uses internally (`plugin_id = "empixel-builder" AND
 * collection = "layouts"`).
 *
 * `getPublicMediaUrl` is unused by `getBuilderLayout` itself but is
 * declared here so the interface mirrors what `Astro.locals.emdash`
 * actually carries — keeps the symbol friendly to future helpers that
 * also need the URL builder.
 */
export interface BuilderLayoutContext {
  locals?: {
    emdash?: {
      // Anything with a Kysely-shaped `selectFrom(table).select(...).where(...).executeTakeFirst()`
      // surface satisfies our needs. Typed as `unknown` to dodge the Kysely
      // type explosion (would force us to import the full Database schema
      // from `emdash` just to type one query). Tests pass a hand-rolled
      // mock; production receives the real Kysely instance.
      db?: unknown;
      getPublicMediaUrl?: (storageKey: string) => string | undefined;
    };
  };
}

/**
 * Build the layout-scoped cache tag a host page should invalidate when the
 * admin saves a new layout for `(collection, entryId)`.
 *
 * Exported so external consumers (e.g. a custom save hook in another
 * plugin) can derive the same tag and call `cache.purgeByTags([...])`.
 */
export function builderLayoutCacheTag(collection: string, entryId: string): string {
  return `empixel:layout:${collection}:${entryId}`;
}

/**
 * Parse the `updated_at` column (SQLite `current_timestamp` ISO-8601) into
 * a `Date` for the `cacheHint.lastModified` field. Returns `undefined`
 * when parsing fails so the hint stays valid (caller still has the tag).
 *
 * Accepts both shapes:
 *   - SQLite `current_timestamp` legacy column: `YYYY-MM-DD HH:MM:SS` (no `T`).
 *   - Storage-layer ISO timestamps: `YYYY-MM-DDTHH:MM:SS.sssZ` (already valid).
 */
function parseUpdatedAt(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const iso = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Minimal interface for the Kysely-shaped query builder we actually need.
 * Any object satisfying this works — production uses the real Kysely
 * instance from `Astro.locals.emdash.db`; tests substitute a hand-rolled
 * stub that returns canned rows.
 */
interface MinimalKysely {
  selectFrom(table: string): MinimalSelectBuilder;
}
interface MinimalSelectBuilder {
  select(cols: string[]): MinimalSelectBuilder;
  where(field: string, op: string, value: unknown): MinimalSelectBuilder;
  executeTakeFirst(): Promise<Record<string, unknown> | undefined>;
}

function isMinimalKysely(value: unknown): value is MinimalKysely {
  return typeof value === "object" && value !== null && typeof (value as { selectFrom?: unknown }).selectFrom === "function";
}

/**
 * Pull a layout row from `_plugin_storage` (EmDash's plugin-scoped storage
 * table). Returns `null` when:
 *   - `Astro.locals.emdash.db` is missing (pre-storage host or test bench).
 *   - No row matches `(plugin_id, collection, data->collection, data->entryId)`.
 *   - The stored JSON fails to parse.
 *
 * Caller falls back to the legacy SQLite table on null. The double-key
 * approach lets layouts written by F3.2 routes (storage-first) coexist
 * with rows still living in `empixel_builder_layouts` until F3.3 finishes
 * the migration; F3.5 then drops the legacy path entirely.
 */
async function readFromStorage(
  db: MinimalKysely,
  collection: string,
  entryId: string,
): Promise<LayoutRow | null> {
  // The composite identity is `(collection, entryId)` per the F3.1 declaration.
  // EmDash's `PluginStorageRepository` JSON-extracts `data->>collection` and
  // `data->>entryId` against the indexes EmDash provisioned automatically;
  // we mirror that filtering shape here. SQL identifier names match the
  // `_plugin_storage` schema (see `node_modules/emdash/dist/types-Dtx1mSMX.d.mts:229`).
  try {
    const row = await db
      .selectFrom("_plugin_storage")
      .select(["data", "updated_at"])
      .where("plugin_id", "=", PLUGIN_ID)
      .where("collection", "=", STORAGE_COLLECTION)
      // SQLite + Postgres + MySQL all support `json_extract(data, '$.field')`
      // (and `data->>'field'` on PG). We use Kysely's `where(<expr>, op, val)`
      // with the SQL fragment via raw — but that requires importing `sql`
      // from `kysely`. To avoid a hard kysely import, we filter
      // post-fetch by `data->collection` and `data->entryId` instead. Each
      // plugin holds at most a few hundred rows in `_plugin_storage` for
      // its `layouts` collection — the cost is negligible vs. wiring an
      // additional peer dep at the frontend layer.
      //
      // We still narrow by `plugin_id` + `collection` (indexed PK) so the
      // selectivity stays bound to this plugin's slice.
      .executeTakeFirst() as { data?: string; updated_at?: string } | undefined;
    if (!row || typeof row.data !== "string") return null;
    let parsed: LayoutRow | undefined;
    try {
      parsed = JSON.parse(row.data) as LayoutRow;
    } catch {
      return null;
    }
    if (!parsed || parsed.collection !== collection || parsed.entryId !== entryId) {
      // The narrow query above only fixes `plugin_id` + outer
      // `collection`; the inner `data` payload identifies the row. We
      // double-check both here so a stale or unrelated row doesn't get
      // returned. A multi-row variant of this lookup would scan more
      // efficiently — for v0.9 the single-row fast path is enough.
      return null;
    }
    if (parsed.updatedAt === undefined && typeof row.updated_at === "string") {
      // Some storage drivers don't echo `updatedAt` back into the JSON
      // payload. Fall back to the row's column for cache-hint stamping.
      parsed.updatedAt = row.updated_at;
    }
    return parsed;
  } catch {
    // Database missing the `_plugin_storage` table (pre-EmDash 0.9 hosts),
    // permission errors, etc. — let the caller fall back to the legacy
    // SQLite path. Soft-fail keeps the read path resilient across
    // partial-deploy states.
    return null;
  }
}

/**
 * Multi-row variant: scans the plugin's rows in `_plugin_storage` and
 * returns the first row whose `data->collection` and `data->entryId`
 * match. Used as a fallback when the simple `executeTakeFirst()` lookup
 * pulled a different row (the table is keyed on the stored document `id`,
 * not on the composite `(collection, entryId)` payload).
 */
async function findStorageRow(
  db: MinimalKysely,
  collection: string,
  entryId: string,
): Promise<LayoutRow | null> {
  // Conservative implementation: pull every row scoped to this plugin's
  // `layouts` collection, then filter in JS. The number of rows is
  // bounded by `entries × collections-with-builder-enabled`, which is
  // small in practice. F3.5+ will migrate to a proper indexed
  // `where("data->collection", "=", collection).where("data->entryId", "=", entryId)`
  // expression once we drop the no-kysely-import constraint.
  try {
    const builder = db
      .selectFrom("_plugin_storage")
      .select(["data", "updated_at"])
      .where("plugin_id", "=", PLUGIN_ID)
      .where("collection", "=", STORAGE_COLLECTION) as unknown as {
      execute?: () => Promise<Array<{ data?: string; updated_at?: string }>>;
    } & MinimalSelectBuilder;
    const rows = typeof builder.execute === "function" ? await builder.execute() : null;
    if (!rows || !Array.isArray(rows)) return null;
    for (const row of rows) {
      if (typeof row.data !== "string") continue;
      let parsed: LayoutRow | undefined;
      try {
        parsed = JSON.parse(row.data) as LayoutRow;
      } catch {
        continue;
      }
      if (parsed && parsed.collection === collection && parsed.entryId === entryId) {
        if (parsed.updatedAt === undefined && typeof row.updated_at === "string") {
          parsed.updatedAt = row.updated_at;
        }
        return parsed;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Legacy SQLite read path. Mirrors the F2.3/F2.4 implementation: ULID
 * lookup with single-shot slug → ULID resolution for fresh entries, then
 * a single `SELECT` against `empixel_builder_layouts`. Kept for one
 * version (until F3.5) so hosts that haven't run the F3.3 migration yet
 * still render existing layouts.
 *
 * Returns the parsed sections + a normalised timestamp. `null` when the
 * row is missing, disabled, or rejected; the caller composes the cache
 * hint from this return.
 */
function readFromLegacyTable(
  collection: string,
  entryId: string,
): { sections: SectionBlock[] | null; updatedAt: string | null } | null {
  try {
    const db = getSharedDb();
    let lookupId = entryId;
    if (!ULID_RE.test(entryId)) {
      const idRow = db
        .prepare(`SELECT id FROM ec_${collection} WHERE slug = ?`)
        .get(entryId) as { id: string } | undefined;
      if (idRow && idRow.id) lookupId = idRow.id;
    }

    const row = db
      .prepare(
        "SELECT sections, enabled, updated_at FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?",
      )
      .get(collection, lookupId) as
      | { sections: string; enabled: number; updated_at: string | null }
      | undefined;

    if (!row) return null;

    const updatedAt = row.updated_at ?? null;
    if (!row.enabled) return { sections: null, updatedAt };

    const parsed = JSON.parse(row.sections) as SectionBlock[];
    return { sections: stripUnknownBlocks(parsed), updatedAt };
  } catch {
    return null;
  }
}

/**
 * Read a layout for `(collection, entryId)` and return the section tree
 * plus a `cacheHint` the caller passes to `Astro.cache.set(...)`.
 *
 * **v0.9 — F3.4 signature change.** Now takes `Astro` (or any
 * `BuilderLayoutContext`) as the first argument and is asynchronous.
 * Reads route through EmDash's plugin storage (`_plugin_storage`,
 * partitioned under `plugin_id="empixel-builder", collection="layouts"`)
 * with a read-only fallback to the legacy `empixel_builder_layouts`
 * SQLite table for one version while the F3.3 migration copies rows
 * over. The legacy fallback dispatches through `getDb()` from
 * `dbShared.ts` — F3.5 drops both the fallback and the better-sqlite3
 * peer dependency.
 *
 * Pre-0.9 this was sync and took `(collection, entryId, enabled?)`.
 * Hosts importing it directly need to:
 *   - `await` the call.
 *   - Pass `Astro` (or `{ locals: Astro.locals }`) as the first arg.
 * `BuilderWrapper.astro` does both for you — pass the result through and
 * the wrapper plumbs `Astro.cache.set(cacheHint)` automatically.
 */
export async function getBuilderLayout(
  astro: BuilderLayoutContext,
  collection: string,
  entryId: string,
  enabled?: boolean,
): Promise<BuilderLayoutResult> {
  // The cache tag identifies the layout regardless of whether sections
  // exist on disk yet — admin saving a fresh layout against this entry
  // still has to invalidate the host page that rendered "no layout".
  const cacheHint: BuilderCacheHint = {
    tags: [builderLayoutCacheTag(collection, entryId)],
  };

  if (enabled === false) return { sections: null, cacheHint };
  if (!COLLECTION_RE.test(collection)) return { sections: null, cacheHint };

  // 1) Storage path (EmDash multi-driver via `Astro.locals.emdash.db`).
  //    When no Kysely handle is available we skip straight to the
  //    legacy fallback.
  const handle = astro?.locals?.emdash?.db;
  if (isMinimalKysely(handle)) {
    // Try the single-row fast path first. The PluginStorageRepository
    // assigns a stable `id` per row (`(collection, entryId)` composite —
    // implementation-specific). When the row's `id` happens to match
    // EmDash's hashing convention `executeTakeFirst()` returns the row
    // straight away; otherwise the multi-row scan picks it up.
    let storageRow = await readFromStorage(handle, collection, entryId);
    if (!storageRow) {
      storageRow = await findStorageRow(handle, collection, entryId);
    }
    if (storageRow) {
      const lastModified = parseUpdatedAt(storageRow.updatedAt);
      if (lastModified) cacheHint.lastModified = lastModified;
      // Storage rows that were saved disabled still carry sections —
      // mirror the legacy semantics: disabled-row → null sections, hint
      // intact (so a future enable still busts the cache).
      const enabledFlag = storageRow.enabled === 1 || storageRow.enabled === true;
      if (!enabledFlag) return { sections: null, cacheHint };
      const sections = Array.isArray(storageRow.sections)
        ? stripUnknownBlocks(storageRow.sections)
        : null;
      return { sections, cacheHint };
    }
    // Storage didn't yield a row — fall through to the legacy table.
  }

  // 2) Legacy SQLite fallback. Read-only — F3.3's migration handles the
  //    one-shot copy; this path is purely to keep existing rows visible
  //    until that migration runs on cold start. F3.5 drops this branch.
  const legacy = readFromLegacyTable(collection, entryId);
  if (!legacy) return { sections: null, cacheHint };

  const lastModified = parseUpdatedAt(legacy.updatedAt);
  if (lastModified) cacheHint.lastModified = lastModified;
  return { sections: legacy.sections, cacheHint };
}
