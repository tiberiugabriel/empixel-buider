import { describe, it, expect, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import {
  createPlugin,
  layoutDocId,
  readLayoutFromStorageOrLegacy,
  getMigrationFlag,
  setMigrationFlag,
} from "../src/plugin.js";
import {
  _resetDbForTests,
  getDb,
  setDefaultDatabasePath,
} from "../src/dbShared.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import type { SectionBlock } from "../src/types.js";

/**
 * F3.1 scope is **declarative**: declare `storage.layouts` on the plugin so
 * EmDash provisions the collection on `ctx.storage`. F3.2 will rewrite the
 * route handlers onto the typed storage handle; F3.3 will migrate rows.
 *
 * For now we verify three things without booting the EmDash core (which would
 * pull in a full Astro / DB stack just to inspect a config object):
 *
 *  1. `definePlugin` accepted our storage config and the resolved plugin
 *     surfaces it on `.storage` (sanity check: indexes + uniqueIndexes round
 *     trip exactly).
 *  2. The `LayoutRow` shape round-trips structurally through a stub
 *     `StorageLayoutsCollection` — proves Agent B can rely on the type alias
 *     without a runtime adapter.
 *  3. The composite `(collection, entryId)` index entry is the right shape
 *     for EmDash's `query({ where })` API (composite filter on the same pair).
 *
 * Once F3.2 lands we'll add a heavier integration test that boots a real
 * plugin manager + sqlite back-end. For F3.1 the lighter assertion keeps the
 * task self-contained.
 */

const ULID_A = "01HXAB000000000000000000AA";

describe("plugin.storage declaration", () => {
  const resolved = createPlugin();

  it("exposes a typed `layouts` collection on the resolved plugin", () => {
    expect(resolved.storage).toBeDefined();
    expect(resolved.storage.layouts).toBeDefined();
  });

  it("declares a composite index on (collection, entryId)", () => {
    const cfg = resolved.storage.layouts as {
      indexes: ReadonlyArray<readonly string[]>;
    };
    // Composite index must be the first entry, exactly the (collection,
    // entryId) pair — F3.2's query path relies on this.
    expect(cfg.indexes.length).toBeGreaterThanOrEqual(1);
    expect([...cfg.indexes[0]]).toEqual(["collection", "entryId"]);
  });

  it("declares a composite unique index on (collection, entryId)", () => {
    const cfg = resolved.storage.layouts as {
      uniqueIndexes?: ReadonlyArray<readonly string[]>;
    };
    expect(cfg.uniqueIndexes).toBeDefined();
    expect(cfg.uniqueIndexes!.length).toBeGreaterThanOrEqual(1);
    expect([...cfg.uniqueIndexes![0]]).toEqual(["collection", "entryId"]);
  });

  it("does not declare a separate `meta` collection (KV is reused)", () => {
    // F3.3's migration flag and any other plugin metadata stay on
    // `ctx.kv` — the EmDash KV store already gives us key/value semantics
    // without paying for a typed collection. Declared here so a future
    // refactor doesn't accidentally split the metadata.
    expect(Object.keys(resolved.storage)).toEqual(["layouts"]);
  });
});

describe("LayoutRow round-trip through StorageLayoutsCollection", () => {
  it("structurally satisfies StorageCollection<LayoutRow>", async () => {
    // Stub implementation that mirrors EmDash's `StorageCollection` surface
    // (`get` / `put` / `delete` / `exists` / `getMany` / `putMany` /
    // `deleteMany` / `query` / `count`). A real EmDash boot is gated behind
    // the F3.2 task because it requires the full plugin manager.
    const store = new Map<string, LayoutRow>();
    const stub: StorageLayoutsCollection = {
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

    const sections: SectionBlock[] = [
      {
        id: "block-1",
        type: "container",
        config: {},
      } as SectionBlock,
    ];

    const row: LayoutRow = {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections,
      // createdAt/updatedAt populated by the storage layer at runtime; on
      // the writer side we just leave them off.
    };

    const docId = `pages::${ULID_A}`;
    await stub.put(docId, row);

    const back = await stub.get(docId);
    expect(back).not.toBeNull();
    expect(back!.collection).toBe("pages");
    expect(back!.entryId).toBe(ULID_A);
    expect(back!.enabled).toBe(1);
    expect(back!.sections).toEqual(sections);
  });

  it("accepts boolean enabled (multi-driver coercion)", async () => {
    // Postgres / D1 / Turso may coerce SQLite's INTEGER 0/1 into a boolean
    // on read. The type alias accepts both shapes so consumers don't have
    // to special-case the back-end.
    const store = new Map<string, LayoutRow>();
    const row: LayoutRow = {
      collection: "pages",
      entryId: ULID_A,
      enabled: true,
      sections: [],
    };
    store.set("k", row);
    const back = store.get("k")!;
    expect(back.enabled === true || back.enabled === 1).toBe(true);
  });
});

// ─── F3.2 helper coverage ──────────────────────────────────────────────────

const sandbox = mkdtempSync(join(tmpdir(), "empixel-storage-"));
let counter = 0;
function freshDbPath(): string {
  counter += 1;
  return join(sandbox, `test-${counter}.db`);
}

afterAll(() => {
  _resetDbForTests();
  rmSync(sandbox, { recursive: true, force: true });
});

/**
 * In-memory stub of `StorageLayoutsCollection`. Exposed as the
 * `ctx.storage.layouts` object passed to the helpers under test. We don't
 * boot the full EmDash plugin manager — too heavy for unit tests — so this
 * stub stands in.
 */
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
    async query(options) {
      // Honor `where: { collection }` so the entries-route test can filter.
      const where = options?.where ?? {};
      const items: Array<{ id: string; data: LayoutRow }> = [];
      for (const [id, data] of store.entries()) {
        let pass = true;
        for (const [field, value] of Object.entries(where)) {
          if ((data as unknown as Record<string, unknown>)[field] !== value) {
            pass = false;
            break;
          }
        }
        if (pass) items.push({ id, data });
      }
      return { items, hasMore: false };
    },
    async count() {
      return store.size;
    },
  };
  return { collection, store };
}

interface StubLogCalls {
  warn: Array<{ msg: string; data?: unknown }>;
  error: Array<{ msg: string; data?: unknown }>;
  info: Array<{ msg: string; data?: unknown }>;
  debug: Array<{ msg: string; data?: unknown }>;
}

function makeLogStub(): { log: import("emdash").LogAccess; calls: StubLogCalls } {
  const calls: StubLogCalls = { warn: [], error: [], info: [], debug: [] };
  const log: import("emdash").LogAccess = {
    debug: (msg, data) => calls.debug.push({ msg, data }),
    info: (msg, data) => calls.info.push({ msg, data }),
    warn: (msg, data) => calls.warn.push({ msg, data }),
    error: (msg, data) => calls.error.push({ msg, data }),
  };
  return { log, calls };
}

interface KvStubCalls {
  get: Array<string>;
  set: Array<{ key: string; value: unknown }>;
}

function makeKvStub(initial: Record<string, unknown> = {}): {
  kv: import("emdash").KVAccess;
  store: Map<string, unknown>;
  calls: KvStubCalls;
} {
  const store = new Map<string, unknown>(Object.entries(initial));
  const calls: KvStubCalls = { get: [], set: [] };
  const kv: import("emdash").KVAccess = {
    async get<T>(key: string): Promise<T | null> {
      calls.get.push(key);
      return (store.get(key) as T | undefined) ?? null;
    },
    async set(key, value) {
      calls.set.push({ key, value });
      store.set(key, value);
    },
    async delete(key) {
      return store.delete(key);
    },
    async list() {
      return [...store.entries()].map(([key, value]) => ({ key, value }));
    },
  };
  return { kv, store, calls };
}

function bootstrapDbForFallback(collection: string): {
  dbPath: string;
} {
  _resetDbForTests();
  const dbPath = freshDbPath();
  setDefaultDatabasePath(dbPath);
  const db = getDb();
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
  db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS ec_${collection} (
      id   TEXT PRIMARY KEY,
      slug TEXT
    )
  `);
  return { dbPath };
}

describe("layoutDocId", () => {
  it("encodes (collection, entryId) deterministically", () => {
    expect(layoutDocId("pages", ULID_A)).toBe(`pages::${ULID_A}`);
  });

  it("uses `::` as the separator (so collection names with `:` would still parse)", () => {
    // The COLLECTION_RE allowlist forbids `:` in collections, but we lock the
    // separator anyway so future relaxations don't accidentally collide.
    expect(layoutDocId("a", "b").split("::")).toEqual(["a", "b"]);
  });
});

describe("readLayoutFromStorageOrLegacy — storage-first", () => {
  it("returns the storage row when present (no legacy lookup)", async () => {
    bootstrapDbForFallback("pages");
    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { log } = makeLogStub();

    const sections: SectionBlock[] = [
      { id: "x", type: "container", config: {} } as SectionBlock,
    ];
    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections,
      createdAt: "2026-05-09T12:00:00.000Z",
      updatedAt: "2026-05-09T12:00:00.000Z",
    });

    const row = await readLayoutFromStorageOrLegacy(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      getDb(),
      "pages",
      ULID_A
    );
    expect(row).not.toBeNull();
    expect(row!.entryId).toBe(ULID_A);
    expect(row!.enabled).toBe(1);
    expect(row!.sections).toEqual(sections);
  });

  it("falls back to the legacy SELECT when storage is empty", async () => {
    bootstrapDbForFallback("pages");
    const db = getDb();
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, ?)"
    ).run("pages", ULID_A, JSON.stringify([{ id: "y", type: "text", config: {} }]), 1);

    const { collection: layouts } = makeStorageStub();
    const { log } = makeLogStub();

    const row = await readLayoutFromStorageOrLegacy(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      db,
      "pages",
      ULID_A
    );
    expect(row).not.toBeNull();
    expect(row!.entryId).toBe(ULID_A);
    expect(row!.enabled).toBe(1);
    expect(row!.sections).toEqual([{ id: "y", type: "text", config: {} }]);
  });

  it("returns null when neither storage nor legacy has the row", async () => {
    bootstrapDbForFallback("pages");
    const { collection: layouts } = makeStorageStub();
    const { log } = makeLogStub();

    const row = await readLayoutFromStorageOrLegacy(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      getDb(),
      "pages",
      ULID_A
    );
    expect(row).toBeNull();
  });

  it("storage row shadows legacy row (storage wins)", async () => {
    bootstrapDbForFallback("pages");
    const db = getDb();
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, ?)"
    ).run("pages", ULID_A, JSON.stringify([{ id: "stale", type: "text", config: {} }]), 1);

    const { collection: layouts, store: storageStore } = makeStorageStub();
    const { log } = makeLogStub();

    storageStore.set(layoutDocId("pages", ULID_A), {
      collection: "pages",
      entryId: ULID_A,
      enabled: 0,
      sections: [{ id: "fresh", type: "text", config: {} } as SectionBlock],
    });

    const row = await readLayoutFromStorageOrLegacy(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      db,
      "pages",
      ULID_A
    );
    expect(row).not.toBeNull();
    expect(row!.sections).toEqual([{ id: "fresh", type: "text", config: {} }]);
    expect(row!.enabled).toBe(0);
  });

  it("legacy fallback parses bad sections JSON without throwing (returns empty array + logs)", async () => {
    bootstrapDbForFallback("pages");
    const db = getDb();
    db.prepare(
      "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled) VALUES (?, ?, ?, ?)"
    ).run("pages", ULID_A, "not valid json", 1);

    const { collection: layouts } = makeStorageStub();
    const { log, calls } = makeLogStub();

    const row = await readLayoutFromStorageOrLegacy(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      db,
      "pages",
      ULID_A
    );
    expect(row).not.toBeNull();
    expect(row!.sections).toEqual([]);
    // The parse error is surfaced via the log, not thrown.
    expect(calls.warn.some((c) => /parse sections JSON/.test(c.msg))).toBe(true);
  });
});

describe("getMigrationFlag", () => {
  it("returns true when ctx.kv has the flag (no legacy lookup needed)", async () => {
    bootstrapDbForFallback("pages");
    const { kv } = makeKvStub({ "state:migration:foo_v1": "ts" });
    const { log } = makeLogStub();

    const result = await getMigrationFlag({ log, kv }, getDb(), "foo_v1");
    expect(result).toBe(true);
  });

  it("syncs legacy meta flag forward to KV when KV is empty but meta has it", async () => {
    bootstrapDbForFallback("pages");
    const db = getDb();
    db.prepare("INSERT INTO empixel_builder_meta (key, value) VALUES (?, ?)").run("foo_v1", "1234");

    const { kv, calls } = makeKvStub({});
    const { log } = makeLogStub();

    const result = await getMigrationFlag({ log, kv }, db, "foo_v1");
    expect(result).toBe(true);
    // The legacy value should have been pushed to KV so subsequent calls
    // skip the SQL lookup.
    expect(calls.set).toHaveLength(1);
    expect(calls.set[0].key).toBe("state:migration:foo_v1");
    expect(calls.set[0].value).toBe("1234");
  });

  it("returns false when neither KV nor legacy meta has the flag", async () => {
    bootstrapDbForFallback("pages");
    const { kv } = makeKvStub({});
    const { log } = makeLogStub();

    const result = await getMigrationFlag({ log, kv }, getDb(), "missing_v1");
    expect(result).toBe(false);
  });
});

describe("setMigrationFlag", () => {
  it("writes to both KV and the legacy meta table", async () => {
    bootstrapDbForFallback("pages");
    const db = getDb();
    const { kv, store: kvStore } = makeKvStub({});
    const { log } = makeLogStub();

    await setMigrationFlag({ log, kv }, db, "bar_v1", "789");

    expect(kvStore.get("state:migration:bar_v1")).toBe("789");

    const row = db
      .prepare("SELECT value FROM empixel_builder_meta WHERE key = ?")
      .get("bar_v1") as { value: string } | undefined;
    expect(row?.value).toBe("789");
  });
});
