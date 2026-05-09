import { definePlugin } from "emdash";
import type { RouteContext, PluginContext, PluginStorageConfig } from "emdash";
import type { SectionBlock, BreakpointsConfig, BreakpointId } from "./types.js";
import { DEFAULT_BREAKPOINTS_CONFIG, stripUnknownBlocks } from "./types.js";
import type { LayoutRow, StorageLayoutsCollection } from "./storage-types.js";
import { ensureStorageMigrationRan } from "./migrations/toStorageV1.js";

const KV_ENABLED = "settings:enabledCollections";
const KV_BREAKPOINTS = "settings:breakpoints";

// KV key prefix for one-shot migration flags. F3.2 moved migration flags off
// the legacy `empixel_builder_meta` table; F3.5 dropped the legacy table
// from the plugin's hot path entirely. The
// `to_storage_v1` migration still consults the legacy meta row when KV
// is empty (for hosts that flipped the flag pre-F3.2) — that lookup runs
// inside `toStorageV1.ts` against its own dynamically-imported SQLite
// handle, not `plugin.ts`.
const KV_MIGRATION_PREFIX = "state:migration:";

const NON_REMOVABLE_BREAKPOINTS: BreakpointId[] = ["desktop", "tablet-portrait", "mobile-portrait"];

// When set to "1", caught-but-soft-failed errors escalate from warn → error so
// they're easier to spot during local debugging. The default (off) keeps the
// log volume sane in production while still leaving a breadcrumb (warn).
const EMPIXEL_DEBUG = process.env.EMPIXEL_DEBUG === "1";

/**
 * Log a caught exception without changing control flow. Soft-fail callers wrap
 * a fallback path around the exception; this helper just makes sure the
 * exception is *visible* (previously these were swallowed silently). Use
 * `ctx` for plugin routes / hooks so it routes through EmDash's logger; pass
 * `null` at module-load time and the helper falls back to `console`.
 */
function logCaught(
  ctx: { log: PluginContext["log"] } | null,
  message: string,
  err: unknown
): void {
  const data = { err: err instanceof Error ? err.message : String(err) };
  if (ctx) {
    if (EMPIXEL_DEBUG) ctx.log.error(message, data);
    else ctx.log.warn(message, data);
  } else {
    if (EMPIXEL_DEBUG) console.error(`[empixel-builder] ${message}:`, err);
    else console.warn(`[empixel-builder] ${message}:`, err);
  }
}

// Whitelist for SQL identifiers built from the `collection` user input. Used
// by the `/entries` and `/toggle` routes that still touch the host's
// `ec_<collection>` table via `ctx.db` for entry listings + flag mirror.
const COLLECTION_RE = /^[a-z0-9_]+$/;

function isValidCollection(name: unknown): name is string {
  return typeof name === "string" && COLLECTION_RE.test(name);
}

// EmDash ULIDs are 26-char Crockford base32 strings starting with `01` (the
// timestamp prefix for any current/future date). Used to distinguish a row
// keyed by ULID vs. one that still carries a slug at the route boundary
// (fresh-entry case where the host CMS hands us a slug for an entry that
// has never been saved through the builder).
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;

function isUlid(value: unknown): value is string {
  return typeof value === "string" && ULID_RE.test(value);
}

/**
 * Deterministic document id used for `ctx.storage.layouts.put / get / delete`.
 * The storage collection takes a single string `id`; we encode the composite
 * `(collection, entryId)` pair as `${collection}::${entryId}` so direct
 * point-lookups stay O(1) without going through `query({ where })`. Composite
 * indexes on `(collection, entryId)` (declared via `PLUGIN_STORAGE`) make
 * `query` lookups cheap too — the doc-id encoding is a perf detail, not a
 * correctness requirement.
 *
 * Exported for the F3.3 migration helper and unit tests.
 */
export function layoutDocId(collection: string, entryId: string): string {
  return `${collection}::${entryId}`;
}

/**
 * Narrow `ctx.storage.layouts` from EmDash's generic `PluginStorage<...>` map
 * to the typed `StorageLayoutsCollection` we declared in
 * `src/storage-types.ts`. The runtime shape is identical; this cast just
 * carries the row-type through to the call site so writes and reads stay
 * type-safe. PLUGIN_STORAGE guarantees the `layouts` key exists.
 */
function getLayouts(ctx: { storage: PluginContext["storage"] }): StorageLayoutsCollection {
  return ctx.storage.layouts as StorageLayoutsCollection;
}

/**
 * F3.5 read helper. Storage-only — `ctx.storage.layouts.get(layoutDocId)`
 * is the entire read path. The legacy SQLite fallback that lived here in
 * F3.2/F3.3 was dropped in F3.5; the `runMigrationToStorageV1` migration
 * (still triggered through the lazy gate) handles the one-shot copy from
 * the legacy table on cold start.
 *
 * Exported for unit tests only.
 */
export async function readLayoutFromStorage(
  ctx: { log: PluginContext["log"]; storage: PluginContext["storage"] },
  collection: string,
  entryId: string
): Promise<LayoutRow | null> {
  try {
    return await getLayouts(ctx).get(layoutDocId(collection, entryId));
  } catch (err) {
    logCaught(
      ctx,
      `readLayoutFromStorage: ctx.storage.layouts.get failed for ${collection}/${entryId}`,
      err
    );
    return null;
  }
}

/**
 * Read a one-shot migration flag. F3.2 moved migration flags into `ctx.kv`;
 * legacy values in the host's `empixel_builder_meta` table are still
 * honored during the F3.3 → F3.5 transition. After F3.5 the plugin no
 * longer has direct SQLite access; the legacy-meta sync-forward branch
 * lives inside `toStorageV1.ts` where the migration owns its own
 * dynamically-imported SQLite handle. Once the migration sets the flag
 * in KV, every other caller (the lazy gate, future migrations) just
 * reads from KV.
 *
 * Returns `true` if the migration has run. Errors are logged and treated as
 * "not migrated" so the caller can re-run safely.
 *
 * Exported for the F3.3 ctx.storage migration helper, which gates on the
 * `migration_to_storage_v1` flag.
 */
export async function getMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  key: string
): Promise<boolean> {
  try {
    const kvValue = await ctx.kv.get<string>(KV_MIGRATION_PREFIX + key);
    if (kvValue) return true;
  } catch (err) {
    logCaught(ctx, `getMigrationFlag: ctx.kv.get failed for ${key}`, err);
  }
  return false;
}

/**
 * Set a one-shot migration flag in `ctx.kv`.
 *
 * Pre-F3.5 this also mirrored to the legacy `empixel_builder_meta`
 * SQLite table so synchronous cold-start migrations could see the flag.
 * Post-F3.5 the plugin holds no SQLite handle, so the mirror is gone —
 * the only remaining cold-start migration (`runMigrationToStorageV1`)
 * runs through the async lazy gate and consults `ctx.kv` directly via
 * `getMigrationFlag`.
 *
 * Exported for the F3.3 migration that copies legacy rows into ctx.storage.
 */
export async function setMigrationFlag(
  ctx: { log: PluginContext["log"]; kv: PluginContext["kv"] },
  key: string,
  value: string = String(Date.now())
): Promise<void> {
  try {
    await ctx.kv.set(KV_MIGRATION_PREFIX + key, value);
  } catch (err) {
    logCaught(ctx, `setMigrationFlag: ctx.kv.set failed for ${key}`, err);
  }
}

function badRequest(message: string): Response {
  return new Response(
    JSON.stringify({ error: { message } }),
    { status: 400, headers: { "Content-Type": "application/json" } }
  );
}

/**
 * Plugin storage declaration. Maps to the legacy `empixel_builder_layouts`
 * data model — composite identity `(collection, entryId)`, enforced as a
 * unique composite index so EmDash's storage layer can serve `findOne`-style
 * lookups without a full scan.
 *
 * As of F3.5, **this is the entire data model** — the legacy
 * `empixel_builder_layouts` SQLite table is no longer touched by the
 * plugin runtime (the `runMigrationToStorageV1` cold-start migration
 * still consults it via dynamic-import on the very first request after
 * upgrade, but the route handlers never go near it).
 *
 * Declared `as const satisfies PluginStorageConfig` so TS keeps the literal
 * types intact for the `StorageLayoutsCollection` consumer side, while still
 * widening the value to the shape `definePlugin` expects.
 */
const PLUGIN_STORAGE = {
  layouts: {
    indexes: [["collection", "entryId"]],
    uniqueIndexes: [["collection", "entryId"]],
  },
} as const satisfies PluginStorageConfig;

/**
 * Resolve a slug → ULID against the host's `ec_<collection>` table via
 * `ctx.db` (Kysely) when available. Returns the original input on any
 * miss. Used at the route boundary for the fresh-entry case (host CMS
 * hands the builder a slug for an entry that has never been saved
 * through the builder before).
 *
 * Pre-F3.5 this used a synchronous `better-sqlite3` SELECT; post-F3.5
 * the plugin no longer holds a SQLite handle, so we route through
 * EmDash's `ctx.db` (Kysely) instead. Hosts on Postgres / libSQL get
 * the same behaviour through their respective drivers.
 */
async function resolveSlugToUlid(
  ctx: RouteContext,
  collection: string,
  pageId: string
): Promise<string> {
  if (isUlid(pageId)) return pageId;
  // Fallback: slug-shaped pageId. Try Kysely first; on any miss return
  // the original input (the layout simply won't be found and the route
  // returns null).
  const kdb = (ctx as RouteContext & { db?: unknown }).db as
    | { selectFrom: (t: string) => { select: (cols: string[]) => { where: (f: string, op: string, v: unknown) => { executeTakeFirst: () => Promise<{ id?: string } | undefined> } } } }
    | undefined;
  if (!kdb || typeof kdb.selectFrom !== "function") return pageId;
  try {
    const row = await kdb
      .selectFrom(`ec_${collection}`)
      .select(["id"])
      .where("slug", "=", pageId)
      .executeTakeFirst();
    if (row && typeof row.id === "string" && row.id.length > 0) return row.id;
  } catch (err) {
    logCaught(ctx, `resolveSlugToUlid: ec_${collection} lookup failed for slug=${pageId}`, err);
  }
  return pageId;
}

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.9.0",
    capabilities: ["content:read"],
    storage: PLUGIN_STORAGE,
    routes: {
      // GET  ?pageId=&collection=  → load layout
      // POST { pageId, collection, sections } → save layout
      layout: {
        handler: async (ctx: RouteContext) => {
          const method = ctx.request.method;
          const url = new URL(ctx.request.url);

          if (method === "GET") {
            let pageId = url.searchParams.get("pageId");
            const collection = url.searchParams.get("collection");
            if (!pageId || !collection) {
              return badRequest("pageId and collection are required");
            }
            if (!isValidCollection(collection)) {
              return badRequest("Invalid collection name");
            }

            // F3.3 lazy gate — migrate legacy SQLite rows into ctx.storage
            // on first request post-upgrade. After the KV flag is set this
            // is O(1). On non-SQLite hosts (Postgres / libSQL) the
            // migration is a graceful no-op (the legacy table never
            // existed) and the flag is set so future calls are free.
            await ensureStorageMigrationRan(ctx);

            // Fresh-entry case: the host CMS may pass a slug for an entry
            // that has never been saved through the builder before.
            // Resolve through `ctx.db` (Kysely) — works across SQLite,
            // Postgres, libSQL, etc.
            pageId = await resolveSlugToUlid(ctx, collection, pageId);

            // Storage-only read. The legacy SQLite fallback was removed
            // in F3.5; `runMigrationToStorageV1` is the bridge for old
            // installs.
            const row = await readLayoutFromStorage(ctx, collection, pageId);
            if (!row) return { data: null };
            const sections = stripUnknownBlocks(row.sections);
            return { data: { sections } };
          }

          if (method === "POST") {
            const body = ctx.input as { pageId?: string; collection?: string; sections?: SectionBlock[] } | undefined;
            let pageId = body?.pageId;
            const { collection, sections } = body ?? {};
            if (!pageId || !collection || !sections) {
              return badRequest("pageId, collection and sections are required");
            }
            if (!isValidCollection(collection)) {
              return badRequest("Invalid collection name");
            }

            // F3.3 lazy gate — same as GET. Idempotent + cached after first run.
            await ensureStorageMigrationRan(ctx);
            // Same as GET: slug → ULID at the route boundary so the row is
            // always written under its canonical ULID key.
            pageId = await resolveSlugToUlid(ctx, collection, pageId);

            // Preserve the per-entry `enabled` flag if the row already exists
            // (POST /toggle owns it, POST /layout shouldn't clobber it).
            const existing = await readLayoutFromStorage(ctx, collection, pageId);
            const enabled: 0 | 1 = existing && (existing.enabled === true || existing.enabled === 1) ? 1 : 0;
            const now = new Date().toISOString();
            const next: LayoutRow = {
              collection,
              entryId: pageId,
              enabled,
              sections,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            };

            await getLayouts(ctx).put(layoutDocId(collection, pageId), next);
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },

      // GET → returns list of collections with builder enabled
      collections: {
        handler: async (ctx: RouteContext) => {
          const enabled = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          return { data: enabled };
        },
      },

      // POST { collection, enabled } → toggle builder on/off for a collection
      settings: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
          }
          const body = ctx.input as { collection?: string; enabled?: boolean } | undefined;
          if (!body?.collection) {
            return new Response(
              JSON.stringify({ error: { message: "collection is required" } }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          if (!isValidCollection(body.collection)) {
            return badRequest("Invalid collection name");
          }

          // The pre-F3.5 implementation auto-augmented the host's
          // `ec_<collection>` table with an `empixel_builder INTEGER`
          // column on first enable. Hosts on EmDash 0.9.x are expected
          // to declare the column in `seed.json` (or accept that the
          // plugin's mirror UPDATE in `/toggle` is best-effort). The
          // automatic ALTER required direct SQLite access; with the
          // multi-driver storage abstraction the schema-augmentation
          // step is back to seed-driven.
          const current = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          const updated = body.enabled
            ? (current.includes(body.collection) ? current : [...current, body.collection])
            : current.filter((c) => c !== body.collection);
          await ctx.kv.set(KV_ENABLED, updated);
          return { success: true };
        },
      },

      // GET ?collection=pages&limit=50 → list entries for page selector
      entries: {
        handler: async (ctx: RouteContext) => {
          const url = new URL(ctx.request.url);
          const collection = url.searchParams.get("collection") ?? "pages";
          const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);

          if (!isValidCollection(collection)) {
            return { error: "Invalid collection name" };
          }

          // F3.3 lazy gate — `/entries` is a heavy read so make sure the
          // storage side is fully populated before merging. Idempotent.
          await ensureStorageMigrationRan(ctx);

          // Pull per-entry metadata (enabled flag + timestamps) from
          // ctx.storage.layouts. Storage is the only source of truth as
          // of F3.5 — the legacy SQLite fallback that merged in
          // unmigrated rows is gone.
          interface LayoutMeta {
            created_at?: string;
            updated_at?: string;
            enabled: number;
          }
          const meta: Record<string, LayoutMeta> = {};

          try {
            // The storage `query` API paginates with a 100-row default cap.
            // Loop until `hasMore` clears so collections larger than one page
            // still produce complete metadata.
            let cursor: string | undefined;
            for (;;) {
              const page = await getLayouts(ctx).query({
                where: { collection },
                limit: 100,
                cursor,
              });
              for (const item of page.items) {
                const row = item.data;
                meta[row.entryId] = {
                  created_at: row.createdAt,
                  updated_at: row.updatedAt,
                  enabled: row.enabled === true || row.enabled === 1 ? 1 : 0,
                };
              }
              if (!page.hasMore || !page.cursor) break;
              cursor = page.cursor;
            }
          } catch (err) {
            logCaught(ctx, `entries: ctx.storage.layouts.query failed for collection=${collection}`, err);
          }

          let items: { id: string; slug?: string; title?: string; created_at: string; updated_at: string; builder_enabled: boolean }[] = [];
          // Read host entries via Kysely (`ctx.db`). Pre-F3.5 this used a
          // synchronous `better-sqlite3` SELECT through the shared
          // singleton; post-F3.5 we go through EmDash's multi-driver
          // database handle so the listing works on Postgres / libSQL too.
          const kdb = (ctx as RouteContext & { db?: unknown }).db as
            | { selectFrom: (t: string) => { selectAll: () => { orderBy: (f: string, dir: string) => { limit: (n: number) => { execute: () => Promise<Array<{ id: string; slug?: string; title?: string; name?: string; data?: string; created_at: string; updated_at: string }>> } } } } }
            | undefined;
          if (kdb && typeof kdb.selectFrom === "function") {
            try {
              const contentRows = await kdb
                .selectFrom(`ec_${collection}`)
                .selectAll()
                .orderBy("created_at", "desc")
                .limit(limit)
                .execute();

              items = contentRows.map((entry) => {
                const id = entry.id;
                const slug = entry.slug ?? id;
                let title = slug;

                if (entry.title) {
                  title = entry.title;
                } else if (entry.name) {
                  title = entry.name;
                } else if (entry.data) {
                  try {
                    const dataObj = JSON.parse(entry.data);
                    if (dataObj && dataObj.title) {
                      title = dataObj.title;
                    }
                  } catch (err) {
                    logCaught(ctx, `entries: failed to parse data JSON for entry ${entry.id}`, err);
                  }
                }

                return {
                  id,
                  slug,
                  title,
                  created_at: meta[id]?.created_at ?? entry.created_at,
                  updated_at: meta[id]?.updated_at ?? entry.updated_at,
                  builder_enabled: (meta[id]?.enabled ?? 0) === 1,
                };
              });
            } catch (e: unknown) {
              logCaught(ctx, `entries: failed to fetch entries from ec_${collection}`, e);
            }
          }

          return { data: items, collection };
        },
      },

      // POST { entryId, collection, enabled } → toggle builder on/off for a specific entry
      toggle: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method !== "POST") {
            return { error: "Method Not Allowed" };
          }
          const body = ctx.input as { entryId?: string; collection?: string; enabled?: boolean } | undefined;
          let entryId = body?.entryId;
          const collection = body?.collection;

          if (!entryId || !collection) {
            return { error: "entryId and collection are required" };
          }
          if (!isValidCollection(collection)) {
            return { error: "Invalid collection name" };
          }

          // F3.3 lazy gate — toggle is one of the first writes a host hits
          // post-upgrade, so we want the migration to have run before we
          // start putting fresh rows alongside un-migrated legacy rows.
          await ensureStorageMigrationRan(ctx);
          // Resolve slug → ULID at the route boundary for fresh entries.
          entryId = await resolveSlugToUlid(ctx, collection, entryId);

          // Storage-only write. Preserves any existing `sections` (or seeds an
          // empty array on first toggle) and flips `enabled`.
          const existing = await readLayoutFromStorage(ctx, collection, entryId);
          const now = new Date().toISOString();
          const next: LayoutRow = {
            collection,
            entryId,
            enabled: body?.enabled ? 1 : 0,
            sections: existing?.sections ?? [],
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          await getLayouts(ctx).put(layoutDocId(collection, entryId), next);

          // Mirror the enable bit onto the host's `ec_<collection>.empixel_builder`
          // column for downstream consumers (host queries that filter by it).
          // Best-effort — pre-F3.5 the plugin auto-augmented the column via
          // ALTER TABLE; with the multi-driver storage abstraction the
          // column has to be declared in `seed.json` (or the UPDATE will
          // simply log + continue).
          const kdb = (ctx as RouteContext & { db?: unknown }).db as
            | { updateTable: (t: string) => { set: (s: Record<string, unknown>) => { where: (f: string, op: string, v: unknown) => { execute: () => Promise<unknown> } } } }
            | undefined;
          if (kdb && typeof kdb.updateTable === "function") {
            try {
              await kdb
                .updateTable(`ec_${collection}`)
                .set({ empixel_builder: body?.enabled ? 1 : 0 })
                .where("id", "=", entryId)
                .execute();
            } catch (err) {
              logCaught(ctx, `toggle: UPDATE ec_${collection} failed (column may be missing from seed.json)`, err);
            }
          }

          return { success: true };
        },
      },

      // GET → returns breakpoints config; POST { enabled, overrides } → saves it
      breakpoints: {
        handler: async (ctx: RouteContext) => {
          if (ctx.request.method === "GET") {
            const stored = await ctx.kv.get<BreakpointsConfig>(KV_BREAKPOINTS);
            const config: BreakpointsConfig = {
              enabled: Array.isArray(stored?.enabled) ? stored!.enabled : DEFAULT_BREAKPOINTS_CONFIG.enabled,
              overrides: Array.isArray(stored?.overrides) ? stored!.overrides : [],
            };
            return { data: config };
          }
          if (ctx.request.method === "POST") {
            const body = ctx.input as Partial<BreakpointsConfig> | undefined;
            if (!body || !Array.isArray(body.enabled)) {
              return new Response(
                JSON.stringify({ error: { message: "enabled array is required" } }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            // Non-removable breakpoints are always included
            const enabled = Array.from(new Set([...NON_REMOVABLE_BREAKPOINTS, ...body.enabled])) as BreakpointId[];
            const config: BreakpointsConfig = {
              enabled,
              overrides: Array.isArray(body.overrides) ? body.overrides : [],
            };
            await ctx.kv.set(KV_BREAKPOINTS, config);
            return { success: true, data: config };
          }
          return new Response("Method Not Allowed", { status: 405 });
        },
      },
    },
    hooks: {
      "content:afterDelete": {
        handler: async (
          event: { id?: string; entry?: { id: string }; collection?: string },
          ctx: PluginContext
        ) => {
          const entryId = event.id ?? event.entry?.id;
          if (!event.collection || !entryId) return;

          // F3.3 lazy gate — make sure any legacy row for the about-to-be-
          // deleted entry has already been migrated to storage so the
          // cascade delete below removes it from the canonical layer too.
          // Idempotent + cached.
          await ensureStorageMigrationRan(ctx);

          // Cascade delete from `ctx.storage.layouts`. The legacy DELETE
          // that lived here pre-F3.5 is gone — once F3.3 has copied
          // every legacy row into storage (or cleared a non-SQLite host
          // through a no-op), the legacy table is effectively dead from
          // the plugin's perspective.
          try {
            await getLayouts(ctx).delete(layoutDocId(event.collection, entryId));
          } catch (err) {
            logCaught(
              ctx,
              `content:afterDelete: ctx.storage.layouts.delete failed for ${event.collection}/${entryId}`,
              err
            );
          }
        },
      },
    },
    admin: {
      entry: "empixel-builder/admin",
      pages: [
        { path: "/editor", label: "EmPixel Builder" },
      ],
      fieldWidgets: [
        { name: "page-builder", label: "EmPixel Builder", fieldTypes: ["boolean"] },
      ],
    },
  });
}
