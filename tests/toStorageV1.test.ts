import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";

import {
  runMigrationToStorageV1,
  ensureStorageMigrationRan,
  _resetMigrationCacheForTests,
  _setLegacyDbPathForTests,
  MIGRATION_KEY,
} from "../src/migrations/toStorageV1.js";
import { layoutDocId } from "../src/plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import type { SectionBlock } from "../src/types.js";
import type { PluginContext, KVAccess, LogAccess } from "emdash";

/**
 * F3.3 — `migration_to_storage_v1` data migration.
 *
 * Post-F3.5 the migration owns its own dynamically-imported
 * `better-sqlite3` handle (the plugin runtime no longer holds a SQLite
 * connection). The test suite drives that path by:
 *
 *   1. Creating a tmpdir-backed scratch SQLite file directly via
 *      `better-sqlite3` (still in `devDependencies` for testing).
 *   2. Pinning the migration to that file via
 *      `_setLegacyDbPathForTests(...)` so the dynamic
 *      `require("better-sqlite3")` inside the migration resolves to the
 *      same file.
 *   3. Letting the migration open / read / close the handle itself.
 *
 * Covers:
 *
 *   1. Seed legacy rows + zero storage rows → migration moves all → flag set.
 *   2. Storage row newer → skip → counts.skipped++.
 *   3. Storage row older → overwrite → counts.migrated++.
 *   4. On tie, storage wins.
 *   5. Re-run with flag set → all zeros.
 *   6. Empty legacy table → flag still set → all zeros.
 *   7. Bad sections JSON → migrates with empty sections + warns.
 *   8. ensureStorageMigrationRan caches process-locally after first run.
 *   9. Per-row put failure increments `skipped` + warns "will retry".
 *  10. Non-SQLite host (no `better-sqlite3`-readable file) → graceful no-op,
 *      flag still set so future requests are O(1). (Simulated by pointing
 *      the migration at a path that exists but contains no tables.)
 */

interface SqliteStmt {
  run(...args: unknown[]): unknown;
  get(...args: unknown[]): unknown;
  all(...args: unknown[]): unknown[];
}
interface SqliteHandle {
  exec(sql: string): void;
  prepare(sql: string): SqliteStmt;
  close(): void;
}

const _require = createRequire(import.meta.url);

const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";
const ULID_C = "01HXAB000000000000000000CC";

const sandbox = mkdtempSync(join(tmpdir(), "empixel-toStorageV1-"));
let counter = 0;
let activeDb: SqliteHandle | null = null;

function freshDbPath(): string {
  counter += 1;
  return join(sandbox, `test-${counter}.db`);
}

afterAll(() => {
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // best-effort
    }
    activeDb = null;
  }
  _setLegacyDbPathForTests(null);
  rmSync(sandbox, { recursive: true, force: true });
});

beforeEach(() => {
  _resetMigrationCacheForTests();
  if (activeDb) {
    try {
      activeDb.close();
    } catch {
      // best-effort
    }
    activeDb = null;
  }
});

/**
 * Spin up a fresh SQLite scratch file with the canonical legacy schema and
 * pin the migration to read from it via the dynamic-import bridge.
 *
 * Returns a handle the test can use to insert seed rows. The migration
 * opens its own handle to the same file at runtime.
 */
function bootstrapDb(): SqliteHandle {
  const Database = _require("better-sqlite3") as new (path: string) => SqliteHandle;
  const path = freshDbPath();
  const db = new Database(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_layouts (
      collection TEXT NOT NULL,
      entry_id   TEXT NOT NULL,
      sections   TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (current_timestamp),
      updated_at TEXT DEFAULT (current_timestamp),
      enabled    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (collection, entry_id)
    )
  `);
  _setLegacyDbPathForTests(path);
  activeDb = db;
  return db;
}

function insertLegacyRow(args: {
  collection: string;
  entryId: string;
  sections: SectionBlock[] | string;
  enabled?: 0 | 1;
  updatedAt?: string;
  createdAt?: string;
}): void {
  if (!activeDb) throw new Error("call bootstrapDb() before insertLegacyRow");
  const sections =
    typeof args.sections === "string" ? args.sections : JSON.stringify(args.sections);
  const updatedAt = args.updatedAt ?? "2026-05-09 12:00:00";
  const createdAt = args.createdAt ?? "2026-05-09 12:00:00";
  activeDb
    .prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(args.collection, args.entryId, sections, args.enabled ?? 0, createdAt, updatedAt);
}

interface StubLogCalls {
  warn: Array<{ msg: string; data?: unknown }>;
  error: Array<{ msg: string; data?: unknown }>;
  info: Array<{ msg: string; data?: unknown }>;
  debug: Array<{ msg: string; data?: unknown }>;
}

function makeLogStub(): { log: LogAccess; calls: StubLogCalls } {
  const calls: StubLogCalls = { warn: [], error: [], info: [], debug: [] };
  const log: LogAccess = {
    debug: (msg, data) => calls.debug.push({ msg, data }),
    info: (msg, data) => calls.info.push({ msg, data }),
    warn: (msg, data) => calls.warn.push({ msg, data }),
    error: (msg, data) => calls.error.push({ msg, data }),
  };
  return { log, calls };
}

function makeKvStub(initial: Record<string, unknown> = {}): {
  kv: KVAccess;
  store: Map<string, unknown>;
} {
  const store = new Map<string, unknown>(Object.entries(initial));
  const kv: KVAccess = {
    async get<T>(key: string): Promise<T | null> {
      return (store.get(key) as T | undefined) ?? null;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      return store.delete(key);
    },
    async list() {
      return [...store.entries()].map(([key, value]) => ({ key, value }));
    },
  };
  return { kv, store };
}

function makeStorageStub(): {
  collection: StorageLayoutsCollection;
  store: Map<string, LayoutRow>;
} {
  const store = new Map<string, LayoutRow>();
  const collection: StorageLayoutsCollection = {
    async get(id) {
      return store.get(id) ?? null;
    },
    async put(id, data) {
      store.set(id, data);
    },
    async delete(id) {
      return store.delete(id);
    },
    async exists(id) {
      return store.has(id);
    },
    async getMany(ids) {
      const map = new Map<string, LayoutRow>();
      for (const id of ids) {
        const v = store.get(id);
        if (v) map.set(id, v);
      }
      return map;
    },
    async putMany(items) {
      for (const { id, data } of items) store.set(id, data);
    },
    async deleteMany(ids) {
      let n = 0;
      for (const id of ids) if (store.delete(id)) n += 1;
      return n;
    },
    async query() {
      return {
        items: [...store.entries()].map(([id, data]) => ({ id, data })),
        hasMore: false,
      };
    },
    async count() {
      return store.size;
    },
  };
  return { collection, store };
}

function makeCtx(args: {
  storage: StorageLayoutsCollection;
  kv: KVAccess;
  log: LogAccess;
}): {
  log: LogAccess;
  kv: KVAccess;
  storage: PluginContext["storage"];
} {
  return {
    log: args.log,
    kv: args.kv,
    storage: { layouts: args.storage } as unknown as PluginContext["storage"],
  };
}

describe("runMigrationToStorageV1 — base case (zero storage, populated legacy)", () => {
  it("copies every legacy row into ctx.storage and sets the KV flag", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "container", config: {} } as SectionBlock],
      enabled: 1,
    });
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_B,
      sections: [{ id: "y", type: "text", config: {} } as SectionBlock],
      enabled: 0,
    });
    insertLegacyRow({
      collection: "posts",
      entryId: ULID_C,
      sections: [],
      enabled: 1,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 3, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(3);

    const a = storageStore.get(layoutDocId("pages", ULID_A));
    expect(a).toBeDefined();
    expect(a!.collection).toBe("pages");
    expect(a!.entryId).toBe(ULID_A);
    expect(a!.enabled).toBe(1);
    expect(a!.sections).toEqual([{ id: "x", type: "container", config: {} }]);

    const b = storageStore.get(layoutDocId("pages", ULID_B));
    expect(b!.enabled).toBe(0);

    const c = storageStore.get(layoutDocId("posts", ULID_C));
    expect(c!.collection).toBe("posts");
    expect(c!.sections).toEqual([]);

    // Flag must be present in KV (post-F3.5: KV is the only source of truth).
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();

    // Success path logs to info with the counts.
    expect(calls.info.some((c) => /migration_to_storage_v1 complete/.test(c.msg))).toBe(true);
  });
});

describe("runMigrationToStorageV1 — conflict resolution", () => {
  it("skips when storage row is newer than legacy row (counts.skipped++)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "old", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: "2026-05-01 12:00:00",
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "new", type: "text", config: {} } as SectionBlock],
      updatedAt: "2026-05-09T12:00:00.000Z",
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 1, conflicts: 1 });
    // Storage row preserved.
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "new", type: "text", config: {} },
    ]);
  });

  it("overwrites when storage row is older than legacy row (counts.migrated++)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "fresh-from-legacy", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: "2026-05-09 12:00:00",
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "stale-storage", type: "text", config: {} } as SectionBlock],
      updatedAt: "2026-05-01 00:00:00",
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 1, skipped: 0, conflicts: 1 });
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "fresh-from-legacy", type: "text", config: {} },
    ]);
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.enabled).toBe(1);
  });

  it("on tie (equal updatedAt) storage wins", async () => {
    bootstrapDb();
    const sameTs = "2026-05-09 12:00:00";
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "legacy-tie", type: "text", config: {} } as SectionBlock],
      enabled: 1,
      updatedAt: sameTs,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "storage-tie", type: "text", config: {} } as SectionBlock],
      updatedAt: sameTs,
    });

    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 1, conflicts: 1 });
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([
      { id: "storage-tie", type: "text", config: {} },
    ]);
  });
});

describe("runMigrationToStorageV1 — idempotency", () => {
  it("no-ops when KV flag is already set (returns zeros, doesn't touch storage)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub({
      [`state:migration:${MIGRATION_KEY}`]: "already-ran-ts",
    });
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
  });

  it("re-running after a successful migration is a no-op", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await runMigrationToStorageV1(ctx);
    expect(first.migrated).toBe(1);
    const sizeAfterFirst = storageStore.size;

    const second = await runMigrationToStorageV1(ctx);
    expect(second).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(sizeAfterFirst);
  });
});

describe("runMigrationToStorageV1 — empty legacy table", () => {
  it("sets the flag even when there are no rows to migrate", async () => {
    bootstrapDb(); // tables exist but empty

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
  });
});

describe("runMigrationToStorageV1 — bad sections JSON", () => {
  it("falls back to empty sections, logs warn, still increments migrated", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: "not-valid-json",
      enabled: 1,
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 1, skipped: 0, conflicts: 0 });
    expect(storageStore.get(layoutDocId("pages", ULID_A))!.sections).toEqual([]);
    expect(calls.warn.some((c) => /bad sections JSON/.test(c.msg))).toBe(true);
  });
});

describe("runMigrationToStorageV1 — non-SQLite host (graceful no-op)", () => {
  it("treats a missing legacy table as zero rows + sets the flag", async () => {
    // Simulate a Postgres / libSQL host: the dynamic require resolves
    // (we still ship better-sqlite3 in devDeps for tests) but the file
    // it points at has no `empixel_builder_layouts` table — exactly
    // what a fresh non-SQLite install looks like through this codepath.
    const Database = _require("better-sqlite3") as new (path: string) => SqliteHandle;
    const path = freshDbPath();
    const db = new Database(path);
    // Intentionally do not create empixel_builder_layouts.
    _setLegacyDbPathForTests(path);
    activeDb = db;

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log, calls } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const counts = await runMigrationToStorageV1(ctx);

    expect(counts).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(0);
    // Flag must still be set so future requests are O(1).
    expect(kvStore.get(`state:migration:${MIGRATION_KEY}`)).toBeDefined();
    // The "table missing" path logs a warn ("treating as empty").
    expect(calls.warn.some((c) => /legacy SELECT failed/.test(c.msg))).toBe(true);
  });
});

describe("ensureStorageMigrationRan — process-local cache", () => {
  it("first call runs the migration; second call is a no-op (cached)", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { kv, store: kvStore } = makeKvStub();
    const { log } = makeLogStub();
    const ctx = makeCtx({ storage: layouts, kv, log });

    const first = await ensureStorageMigrationRan(ctx);
    expect(first.migrated).toBe(1);
    const sizeAfterFirst = storageStore.size;

    // Tamper with the KV store to simulate "what if the flag got nuked"
    // — the process-local cache should still short-circuit so we don't
    // re-run.
    kvStore.delete(`state:migration:${MIGRATION_KEY}`);

    const second = await ensureStorageMigrationRan(ctx);
    expect(second).toEqual({ migrated: 0, skipped: 0, conflicts: 0 });
    expect(storageStore.size).toBe(sizeAfterFirst);
  });

  it("per-row put failure increments skipped + warns 'will retry'", async () => {
    bootstrapDb();
    insertLegacyRow({
      collection: "pages",
      entryId: ULID_A,
      sections: [{ id: "x", type: "text", config: {} } as SectionBlock],
    });

    const { kv } = makeKvStub();
    const { log, calls } = makeLogStub();
    const flakyLayouts: StorageLayoutsCollection = {
      ...makeStorageStub().collection,
      async put() {
        throw new Error("simulated storage outage");
      },
    };
    const ctx = makeCtx({ storage: flakyLayouts, kv, log });

    const first = await ensureStorageMigrationRan(ctx);
    expect(first.migrated).toBe(0);
    // Per-row failure path: skipped++, warn logged.
    expect(first.skipped).toBe(1);
    expect(calls.warn.some((c) => /will retry on next pass/.test(c.msg))).toBe(true);
  });
});
