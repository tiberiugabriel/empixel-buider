import { describe, it, expect } from "vitest";

import { createPlugin } from "../src/plugin.js";
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
