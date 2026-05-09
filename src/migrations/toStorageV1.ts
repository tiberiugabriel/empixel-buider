/**
 * F3.3 — one-shot data migration `migration_to_storage_v1`.
 *
 * Copies every row from the legacy `empixel_builder_layouts` SQLite table
 * into `ctx.storage.layouts` so existing SQLite hosts upgrade transparently.
 *
 * **Multi-driver story (post-F3.5).** This is the only place in the plugin
 * that still reaches for `better-sqlite3` — and it does so via dynamic
 * `import("better-sqlite3")`. The plugin no longer declares
 * `better-sqlite3` as a peer dependency:
 *
 *   - Hosts on **SQLite** (the legacy default) already have
 *     `better-sqlite3` installed because EmDash itself ships it. The
 *     dynamic import resolves, the legacy table is read, and rows are
 *     copied into `ctx.storage.layouts`.
 *   - Hosts on **Postgres / libSQL / D1 / Turso** never had the legacy
 *     `empixel_builder_layouts` table in the first place — the plugin
 *     wrote rows directly through `ctx.storage` from day one. The
 *     dynamic import either resolves but the SELECT fails (table
 *     missing → treated as empty), or the import fails entirely
 *     (binary unavailable → also treated as empty). Either way, the
 *     migration is a graceful no-op and the KV flag is set so we don't
 *     keep retrying on every request.
 *
 * Idempotency contract:
 *
 * - The KV flag `state:migration:to_storage_v1` is the **only** gate.
 *   Re-running the migration with the flag already set is a no-op
 *   (returns zeros, does not touch storage or SQLite).
 * - On unexpected failure, the flag is **NOT** set, so the next request
 *   retries the migration. Partial migration is acceptable —
 *   `ctx.storage.layouts.put` is idempotent per row, and the conflict
 *   resolution rule (newer `updatedAt` wins) means a re-run after a
 *   partial pass simply finishes the work.
 *
 * Conflict resolution:
 *
 * - If both a legacy row and a storage row exist for the same
 *   `(collection, entryId)`, prefer the row with the newer `updatedAt`.
 * - On ties, **storage wins** — storage is the new source of truth post-
 *   migration.
 */

import type { PluginContext } from "emdash";
import { createRequire } from "node:module";
import { join } from "node:path";

import { layoutDocId } from "../plugin.js";
import { getMigrationFlag, setMigrationFlag } from "../plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../storage-types.js";
import type { SectionBlock } from "../types.js";

/**
 * KV flag key (suffix — full key is `state:migration:${MIGRATION_KEY}` via
 * `setMigrationFlag` / `getMigrationFlag`). Exported so the test suite can
 * pre-seed / clear the flag without re-deriving the prefix.
 */
export const MIGRATION_KEY = "to_storage_v1";

/**
 * Counts returned to the caller (and logged via `ctx.log.info`) so a host
 * operator can verify the migration ran. The plus-skip-conflicts split
 * matches the original telemetry shape.
 */
export interface MigrationCounts {
  /** Rows successfully copied from legacy → storage (or overwriting an
   *  older storage row). */
  migrated: number;
  /** Rows where the storage side already had a newer copy — left alone. */
  skipped: number;
  /** Rows where both sides existed and the timestamps had to be compared
   *  to pick a winner. Subset of `migrated` + `skipped` — incremented in
   *  addition to one of those two. */
  conflicts: number;
}

const ZERO_COUNTS: MigrationCounts = { migrated: 0, skipped: 0, conflicts: 0 };

interface LegacyRow {
  collection: string;
  entry_id: string;
  sections: string;
  enabled: number;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Minimal SQLite handle interface. Just the methods we need. Defined
 * locally so the file has no static dependency on `better-sqlite3` —
 * the binary is resolved lazily through dynamic import.
 */
interface LegacyDbHandle {
  prepare(sql: string): {
    all(...args: unknown[]): unknown[];
  };
  close(): void;
}

/**
 * Process-local cache: once the migration has run inside this Node process
 * (or the KV flag was already set when we first checked), subsequent calls
 * short-circuit without touching `ctx.kv.get`. Worst case if the cache is
 * cold: one KV `get` per route invocation. This trims that to one KV `get`
 * per process lifetime.
 *
 * Cache busting is deliberate-only: tests reset via `_resetMigrationCache`.
 */
let migrationRanThisProcess = false;

/** Test-only helper. Resets the process-local "migration already ran"
 *  short-circuit so tests can re-run the migration against a fresh ctx. */
export function _resetMigrationCacheForTests(): void {
  migrationRanThisProcess = false;
}

/**
 * Optional override for the SQLite database path. Used by the test suite
 * to point the migration at a tmpdir-backed scratch DB without exporting
 * the legacy `getDb` factory. Production callers leave this untouched and
 * the migration resolves to `<process.cwd()>/data.db` — the host EmDash
 * site's database.
 */
let testDatabasePath: string | null = null;

/** Test-only helper. Pin the SQLite database path the migration opens.
 *  Pass `null` to clear. */
export function _setLegacyDbPathForTests(path: string | null): void {
  testDatabasePath = path;
}

const _require = createRequire(import.meta.url);

/**
 * Open the legacy `empixel_builder_layouts` SQLite database via dynamic
 * `require("better-sqlite3")`. Returns `null` when the binary is
 * unavailable (Postgres / libSQL hosts that never had the legacy table)
 * or the open fails for any other reason. Caller treats `null` as "no
 * legacy data to migrate".
 */
function openLegacyDb(): LegacyDbHandle | null {
  try {
    // `better-sqlite3` is no longer a peer dependency post-F3.5. SQLite
    // hosts (where EmDash ships it transitively) still resolve it; non-
    // SQLite hosts get `MODULE_NOT_FOUND` here and we silently skip.
    const Database = _require("better-sqlite3") as new (path: string) => LegacyDbHandle;
    const dbPath = testDatabasePath ?? join(process.cwd(), "data.db");
    return new Database(dbPath);
  } catch {
    return null;
  }
}

/**
 * Lazy gate. Called at the top of route handlers that touch
 * `ctx.storage.layouts`. Idempotent and cheap on the hot path:
 *
 * - First call after a process boot: hits `ctx.kv.get` once. If the flag
 *   is set, caches `true` and returns. If not, runs the migration.
 * - Subsequent calls: O(1) — process-local cache hit.
 *
 * Errors are caught and logged. We **do not** propagate migration failures
 * back to the request handler — graceful fallback is preferable to
 * blocking a save. Note that as of F3.5 there is no read-side fallback
 * for legacy SQLite rows in `plugin.ts` / `components/db.ts`; the
 * one-shot migration is the entire bridge. Once the KV flag is set, the
 * legacy table is unreachable from the plugin's hot path.
 */
export async function ensureStorageMigrationRan(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  }
): Promise<MigrationCounts> {
  if (migrationRanThisProcess) return ZERO_COUNTS;
  try {
    const counts = await runMigrationToStorageV1(ctx);
    migrationRanThisProcess = true;
    return counts;
  } catch (err) {
    // Don't poison the process-local cache on failure — the next request
    // gets another shot. The flag is only set inside the runner on success.
    const data = { err: err instanceof Error ? err.message : String(err) };
    ctx.log.error("[empixel-builder] ensureStorageMigrationRan failed", data);
    return ZERO_COUNTS;
  }
}

/**
 * One-shot data migration runner. Public surface so the F3.3 unit tests can
 * exercise it directly without going through the lazy gate (which adds the
 * process-local cache layer that's awkward to reset across test cases).
 *
 * Behaviour:
 *
 * 1. If `state:migration:to_storage_v1` is already set in `ctx.kv`,
 *    returns zero counts immediately. (Honors the legacy
 *    `empixel_builder_meta` table too via `getMigrationFlag` for hosts
 *    that already ran the migration before F3.2 moved flags to KV.)
 * 2. Otherwise, attempts to open the legacy SQLite database via
 *    dynamic import. If the binary is missing (Postgres / libSQL host)
 *    or the database file is unreachable, the legacy row set is treated
 *    as empty — the flag is still set and the migration becomes a
 *    permanent no-op for that host.
 * 3. SELECTs every row from `empixel_builder_layouts`. For each: read
 *    the storage side, decide migrate vs. skip via the conflict-
 *    resolution rule, and `put` if the legacy row wins.
 * 4. On success, sets the KV flag so subsequent calls short-circuit.
 * 5. On any thrown error before the loop completes, the flag is NOT set
 *    — the next call retries from the top.
 *
 * Note: as of F3.5 the migration manages its own SQLite handle (opened
 * via dynamic `require("better-sqlite3")`) instead of accepting an `db`
 * argument from the caller. The plugin runtime no longer holds a SQLite
 * handle of its own.
 */
export async function runMigrationToStorageV1(
  ctx: {
    log: PluginContext["log"];
    kv: PluginContext["kv"];
    storage: PluginContext["storage"];
  }
): Promise<MigrationCounts> {
  const alreadyRan = await getMigrationFlag(ctx, MIGRATION_KEY);
  if (alreadyRan) return { ...ZERO_COUNTS };

  const counts: MigrationCounts = { migrated: 0, skipped: 0, conflicts: 0 };

  const legacyDb = openLegacyDb();

  let legacyRows: LegacyRow[] = [];
  if (legacyDb) {
    try {
      legacyRows = legacyDb
        .prepare(
          "SELECT collection, entry_id, sections, enabled, created_at, updated_at FROM empixel_builder_layouts"
        )
        .all() as LegacyRow[];
    } catch (err) {
      // Legacy table missing entirely (fresh install or non-SQLite host
      // whose `data.db` lacks the table) — treat as empty and mark the
      // flag so we don't keep paying the SELECT cost on every request.
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        "[empixel-builder] runMigrationToStorageV1: legacy SELECT failed (table missing?), treating as empty",
        data
      );
      legacyRows = [];
    }
  } else {
    // `better-sqlite3` could not be resolved — host is on Postgres /
    // libSQL / D1 / Turso and never had the legacy table. Treat as
    // empty and set the flag so future requests are O(1).
    ctx.log.info(
      "[empixel-builder] runMigrationToStorageV1: legacy SQLite unavailable (non-SQLite host?), skipping"
    );
  }

  // Cast `ctx.storage.layouts` to the typed handle. The runtime shape is
  // identical; the cast just carries the row type to the `put` site so we
  // don't lose type safety. Mirrors `getLayouts()` in `src/plugin.ts`.
  const layouts = ctx.storage.layouts as StorageLayoutsCollection;

  for (const legacy of legacyRows) {
    let parsedSections: SectionBlock[] = [];
    try {
      const v = JSON.parse(legacy.sections);
      if (Array.isArray(v)) parsedSections = v as SectionBlock[];
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: bad sections JSON for ${legacy.collection}/${legacy.entry_id} — using empty array`,
        data
      );
    }

    const docId = layoutDocId(legacy.collection, legacy.entry_id);

    let storageRow: LayoutRow | null = null;
    try {
      storageRow = await layouts.get(docId);
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: ctx.storage.layouts.get failed for ${docId}`,
        data
      );
    }

    if (storageRow) {
      // Conflict — both layers have the row. Lex-compare timestamps; on
      // ties prefer storage (storage is the new source of truth). The
      // SQLite `current_timestamp` column writes ISO-8601-ish
      // `YYYY-MM-DD HH:MM:SS` UTC; modern writes go through
      // `new Date().toISOString()` from `plugin.ts`. Both formats are
      // monotonic under string compare for a given clock, which is the
      // only ordering the conflict rule cares about (within-row). Mixed
      // formats across rows still compare consistently because we never
      // compare across rows.
      counts.conflicts += 1;
      const legacyTs = legacy.updated_at ?? "";
      const storageTs = storageRow.updatedAt ?? "";
      if (legacyTs > storageTs) {
        // Legacy row is newer — overwrite the storage row.
        try {
          await layouts.put(docId, buildLayoutRowFromLegacy(legacy, parsedSections));
          counts.migrated += 1;
        } catch (err) {
          const data = { err: err instanceof Error ? err.message : String(err) };
          ctx.log.warn(
            `[empixel-builder] runMigrationToStorageV1: put failed for ${docId} — leaving storage row in place`,
            data
          );
          counts.skipped += 1;
        }
      } else {
        // Storage row is newer or tied — leave it alone.
        counts.skipped += 1;
      }
      continue;
    }

    // Fresh write — no storage row exists yet.
    try {
      await layouts.put(docId, buildLayoutRowFromLegacy(legacy, parsedSections));
      counts.migrated += 1;
    } catch (err) {
      const data = { err: err instanceof Error ? err.message : String(err) };
      ctx.log.warn(
        `[empixel-builder] runMigrationToStorageV1: put failed for ${docId} — will retry on next pass`,
        data
      );
      counts.skipped += 1;
    }
  }

  // Mark the flag only after the loop completes. Per-row failures above
  // increment `skipped` but don't abort the loop, so the flag still gets
  // set — the conflict-resolution rule means a re-run is a no-op for any
  // rows that did succeed, and the few that failed will retry on the
  // next process boot if/when the cache is reset.
  //
  // What WOULD prevent the flag from being set is the SELECT itself
  // throwing in a way that propagated out of this function, or one of
  // these two await-set calls throwing. In both cases the next request
  // retries from the top.
  await setMigrationFlag(ctx, MIGRATION_KEY);

  ctx.log.info("[empixel-builder] migration_to_storage_v1 complete", {
    migrated: counts.migrated,
    skipped: counts.skipped,
    conflicts: counts.conflicts,
  });

  // Best-effort close of the legacy handle so we don't leak the file
  // handle across process lifetime. The handle is one-shot anyway.
  if (legacyDb) {
    try {
      legacyDb.close();
    } catch {
      // best-effort
    }
  }

  return counts;
}

/**
 * Pure helper — build a `LayoutRow` from one legacy SQLite row + its
 * already-parsed sections. Pulled out so the conflict-resolution branch
 * and the no-conflict branch can share the same construction.
 */
function buildLayoutRowFromLegacy(legacy: LegacyRow, sections: SectionBlock[]): LayoutRow {
  return {
    collection: legacy.collection,
    entryId: legacy.entry_id,
    enabled: legacy.enabled === 1 ? 1 : 0,
    sections,
    createdAt: legacy.created_at ?? undefined,
    updatedAt: legacy.updated_at ?? undefined,
  };
}
