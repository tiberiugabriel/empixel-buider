import { describe, it, expect } from "vitest";

import {
  createPlugin,
  layoutDocId,
  readLayoutFromStorage,
  getMigrationFlag,
  setMigrationFlag,
} from "../src/plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import type { SectionBlock } from "../src/types.js";

/**
 * F3.1 + F3.2 + F3.5 unit coverage for the plugin's storage-side helpers.
 *
 * Post-F3.5 the read path is **storage-only** — `readLayoutFromStorage`
 * just calls `ctx.storage.layouts.get(layoutDocId)`. The legacy SQLite
 * fallback that lived in this file pre-F3.5 was deleted along with
 * `dbShared.ts`. The only remaining bridge to the legacy table is the
 * one-shot `runMigrationToStorageV1` migration in
 * `src/migrations/toStorageV1.ts` (covered by `tests/toStorageV1.test.ts`).
 *
 * Likewise, `getMigrationFlag` / `setMigrationFlag` no longer take a
 * `db` argument or mirror to `empixel_builder_meta`. They consult
 * `ctx.kv` only — the migration runner owns the legacy-meta sync-forward
 * path itself via dynamic-import inside `toStorageV1.ts`.
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
    expect(Object.keys(resolved.storage)).toEqual(["layouts"]);
  });
});

describe("LayoutRow round-trip through StorageLayoutsCollection", () => {
  it("structurally satisfies StorageCollection<LayoutRow>", async () => {
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

  it("accepts boolean enabled (multi-driver coercion)", () => {
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

// ─── Helper coverage ────────────────────────────────────────────────────────

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

describe("layoutDocId", () => {
  it("encodes (collection, entryId) deterministically", () => {
    expect(layoutDocId("pages", ULID_A)).toBe(`pages::${ULID_A}`);
  });

  it("uses `::` as the separator (so collection names with `:` would still parse)", () => {
    expect(layoutDocId("a", "b").split("::")).toEqual(["a", "b"]);
  });
});

describe("readLayoutFromStorage (F3.5 — storage-only)", () => {
  it("returns the storage row when present", async () => {
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

    const row = await readLayoutFromStorage(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      "pages",
      ULID_A
    );
    expect(row).not.toBeNull();
    expect(row!.entryId).toBe(ULID_A);
    expect(row!.enabled).toBe(1);
    expect(row!.sections).toEqual(sections);
  });

  it("returns null when storage doesn't have the row (no legacy fallback)", async () => {
    const { collection: layouts } = makeStorageStub();
    const { log } = makeLogStub();

    const row = await readLayoutFromStorage(
      { log, storage: { layouts } as unknown as import("emdash").PluginContext["storage"] },
      "pages",
      ULID_A
    );
    expect(row).toBeNull();
  });

  it("returns null and logs when ctx.storage.layouts.get throws", async () => {
    const flakyLayouts: StorageLayoutsCollection = {
      ...makeStorageStub().collection,
      async get() {
        throw new Error("simulated storage outage");
      },
    };
    const { log, calls } = makeLogStub();

    const row = await readLayoutFromStorage(
      {
        log,
        storage: { layouts: flakyLayouts } as unknown as import("emdash").PluginContext["storage"],
      },
      "pages",
      ULID_A
    );
    expect(row).toBeNull();
    expect(calls.warn.some((c) => /readLayoutFromStorage/.test(c.msg))).toBe(true);
  });
});

describe("getMigrationFlag (F3.5 — KV-only)", () => {
  it("returns true when ctx.kv has the flag", async () => {
    const { kv } = makeKvStub({ "state:migration:foo_v1": "ts" });
    const { log } = makeLogStub();

    const result = await getMigrationFlag({ log, kv }, "foo_v1");
    expect(result).toBe(true);
  });

  it("returns false when KV doesn't have the flag (no legacy meta lookup)", async () => {
    const { kv } = makeKvStub({});
    const { log } = makeLogStub();

    const result = await getMigrationFlag({ log, kv }, "missing_v1");
    expect(result).toBe(false);
  });

  it("returns false and logs when ctx.kv.get throws", async () => {
    const flakyKv: import("emdash").KVAccess = {
      async get() {
        throw new Error("kv outage");
      },
      async set() {},
      async delete() {
        return false;
      },
      async list() {
        return [];
      },
    };
    const { log, calls } = makeLogStub();

    const result = await getMigrationFlag({ log, kv: flakyKv }, "foo_v1");
    expect(result).toBe(false);
    expect(calls.warn.some((c) => /getMigrationFlag/.test(c.msg))).toBe(true);
  });
});

describe("setMigrationFlag (F3.5 — KV-only)", () => {
  it("writes to KV (no legacy meta mirror)", async () => {
    const { kv, store: kvStore } = makeKvStub({});
    const { log } = makeLogStub();

    await setMigrationFlag({ log, kv }, "bar_v1", "789");

    expect(kvStore.get("state:migration:bar_v1")).toBe("789");
  });
});
