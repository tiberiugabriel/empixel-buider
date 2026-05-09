import type { SectionBlock } from "../types.js";
import { stripUnknownBlocks } from "../types.js";
import type { LayoutRow } from "../storage-types.js";

// Same regex as plugin.ts. Collection names are interpolated into SQL
// identifiers (`ec_${collection}`) on the plugin side; the frontend
// reader doesn't construct any identifiers itself, but we still
// validate to short-circuit obviously bad input before hitting the
// database.
const COLLECTION_RE = /^[a-z0-9_]+$/;

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
 * - `lastModified` — Parsed from the layout row's `updatedAt` ISO
 *                    timestamp set by the storage layer. Lets HTTP
 *                    caches that look at `Last-Modified` short-circuit
 *                    304s without going through tag invalidation.
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
 * request via `Astro.locals.emdash`. Post-F3.5 it's the **only** read
 * path — there is no longer a legacy `better-sqlite3` fallback. Hosts
 * upgrading from a pre-0.9 EmDash that doesn't expose `db` on
 * `Astro.locals` will get null sections (and the cache tag, so a future
 * EmDash upgrade still busts cleanly).
 */
export interface BuilderLayoutContext {
  locals?: {
    emdash?: {
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
 * Parse a stored `updatedAt` value into a `Date` for the
 * `cacheHint.lastModified` field. Returns `undefined` when parsing fails
 * so the hint stays valid (caller still has the tag).
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
 */
async function readFromStorage(
  db: MinimalKysely,
  collection: string,
  entryId: string,
): Promise<LayoutRow | null> {
  try {
    const row = await db
      .selectFrom("_plugin_storage")
      .select(["data", "updated_at"])
      .where("plugin_id", "=", PLUGIN_ID)
      .where("collection", "=", STORAGE_COLLECTION)
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
      // `collection`; the inner `data` payload identifies the row.
      return null;
    }
    if (parsed.updatedAt === undefined && typeof row.updated_at === "string") {
      parsed.updatedAt = row.updated_at;
    }
    return parsed;
  } catch {
    // Database missing the `_plugin_storage` table (pre-EmDash 0.9 hosts),
    // permission errors, etc. — return null so the page renders with no
    // layout rather than throwing.
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
 * Read a layout for `(collection, entryId)` and return the section tree
 * plus a `cacheHint` the caller passes to `Astro.cache.set(...)`.
 *
 * **v0.9 — F3.4/F3.5 final shape.** Async, takes `Astro` (or any
 * `BuilderLayoutContext`) as the first argument. Reads route through
 * EmDash's plugin storage (`_plugin_storage`, partitioned under
 * `plugin_id="empixel-builder", collection="layouts"`) via
 * `Astro.locals.emdash.db`. The legacy `better-sqlite3` fallback that
 * existed transitionally between F3.4 and F3.5 was dropped — the
 * frontend reader is storage-only. Hosts upgrading from a pre-0.9
 * EmDash that doesn't yet expose `db` on `Astro.locals.emdash` get
 * `null` sections (and the cache tag so a future upgrade still busts
 * cleanly).
 *
 * The plugin runtime's lazy `runMigrationToStorageV1` migration takes
 * care of copying any legacy `empixel_builder_layouts` rows into
 * `ctx.storage.layouts` on the first request after upgrade — by the
 * time the host page renders, the storage side is populated.
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

  // Storage path (EmDash multi-driver via `Astro.locals.emdash.db`).
  // No fallback as of F3.5 — pre-0.9 EmDash hosts that don't expose `db`
  // on locals get null sections.
  const handle = astro?.locals?.emdash?.db;
  if (!isMinimalKysely(handle)) return { sections: null, cacheHint };

  // Try the single-row fast path first. The `PluginStorageRepository`
  // assigns a stable `id` per row; when the row's `id` happens to match
  // EmDash's hashing convention `executeTakeFirst()` returns the row
  // straight away; otherwise the multi-row scan picks it up.
  let storageRow = await readFromStorage(handle, collection, entryId);
  if (!storageRow) {
    storageRow = await findStorageRow(handle, collection, entryId);
  }
  if (!storageRow) return { sections: null, cacheHint };

  const lastModified = parseUpdatedAt(storageRow.updatedAt);
  if (lastModified) cacheHint.lastModified = lastModified;
  // Storage rows that were saved disabled still carry sections —
  // disabled-row → null sections, hint intact (so a future enable still
  // busts the cache).
  const enabledFlag = storageRow.enabled === 1 || storageRow.enabled === true;
  if (!enabledFlag) return { sections: null, cacheHint };
  const sections = Array.isArray(storageRow.sections)
    ? stripUnknownBlocks(storageRow.sections)
    : null;
  return { sections, cacheHint };
}
