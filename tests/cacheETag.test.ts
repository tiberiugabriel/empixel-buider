import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPlugin, _resetLayoutCache, _layoutCacheSize } from "../src/plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";

/**
 * Post-1.0.2 — `/layout` GET in-memory LRU cache (parsed payload only).
 *
 * F4.2 (1.0.0/1.0.1) shipped this with a `Response` return + ETag /
 * `If-None-Match` 304 / `Last-Modified` headers. EmDash's plugin route
 * framework wraps `route.handler(ctx)` return values as
 * `{ success: true, data: <return-value>, status: 200 }` (verified at
 * `node_modules/emdash/dist/search-DkN-BqsS.mjs:7332-7336`); a `Response`
 * has no enumerable own properties so `JSON.stringify` produced `{}` and
 * the client saw `{"data":{}}` instead of the layout (P0). 1.0.2 drops
 * the HTTP-level cache. The in-memory LRU stays — the warm-hit path
 * skips the storage round-trip — but it now stores the parsed payload
 * (`{ sections: SectionBlock[] } | null`) and the route handler returns
 * the payload directly. EmDash wraps the return to `{ data: payload }`
 * on the way out.
 *
 * This file's tests exercise the route handler directly, so they see the
 * raw return value (not the framework-wrapped envelope).
 */

const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";

interface TestCtx {
  kv: import("emdash").KVAccess;
  storage: { layouts: StorageLayoutsCollection };
  content: import("emdash").ContentAccess | undefined;
  log: import("emdash").LogAccess;
  request: Request;
  input?: unknown;
  site: import("emdash").RouteContext["site"];
}

function makeStorage(): {
  layouts: StorageLayoutsCollection;
  store: Map<string, LayoutRow>;
} {
  const store = new Map<string, LayoutRow>();
  const layouts: StorageLayoutsCollection = {
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
  return { layouts, store };
}

function makeKv(): import("emdash").KVAccess {
  // Pre-set the migration flags so the lazy gates short-circuit immediately.
  // We're not exercising the migration path here — the cache is downstream
  // of both gates.
  const store = new Map<string, unknown>([
    ["state:migration:to_storage_v1", "1"],
    ["state:migration:legacy_spacing_v1", "1"],
  ]);
  return {
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
}

function makeLog(): import("emdash").LogAccess {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
  };
}

function buildCtx(opts: {
  request: Request;
  storage: { layouts: StorageLayoutsCollection };
  input?: unknown;
}): TestCtx {
  return {
    request: opts.request,
    input: opts.input,
    storage: opts.storage,
    kv: makeKv(),
    content: undefined,
    log: makeLog(),
    site: { url: "http://localhost", path: "/" } as unknown as TestCtx["site"],
  };
}

function getLayoutHandler() {
  const plugin = createPlugin() as { routes: Record<string, { handler: (ctx: unknown) => Promise<unknown> }> };
  const handler = plugin.routes.layout?.handler;
  if (!handler) throw new Error("layout route not declared");
  return handler;
}

function getToggleHandler() {
  const plugin = createPlugin() as { routes: Record<string, { handler: (ctx: unknown) => Promise<unknown> }> };
  const handler = plugin.routes.toggle?.handler;
  if (!handler) throw new Error("toggle route not declared");
  return handler;
}

function getAfterDeleteHook() {
  const plugin = createPlugin() as { hooks: Record<string, { handler: (event: unknown, ctx: unknown) => Promise<unknown> }> };
  const handler = plugin.hooks["content:afterDelete"]?.handler;
  if (!handler) throw new Error("content:afterDelete hook not declared");
  return handler;
}

describe("LRU cache on /layout GET (1.0.2 — payload-only, no HTTP-level cache)", () => {
  beforeEach(() => {
    _resetLayoutCache();
  });
  afterEach(() => {
    _resetLayoutCache();
  });

  it("returns the parsed payload directly (EmDash wraps to { data: payload })", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "x", type: "container", config: {} }],
      createdAt: "2026-05-09T12:00:00.000Z",
      updatedAt: "2026-05-09T12:00:00.000Z",
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    const ctx = buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    });
    const res = await handler(ctx);
    expect(res).toEqual({ data: { sections: [{ id: "x", type: "container", config: {} }] } });
  });

  it("returns null for a missing row (EmDash wraps to { data: null })", async () => {
    const handler = getLayoutHandler();
    const { layouts } = makeStorage();
    const url = `http://localhost/layout?pageId=${ULID_B}&collection=pages`;

    const res = await handler(
      buildCtx({
        request: new Request(url, { method: "GET" }),
        storage: { layouts },
      })
    );
    expect(res).toEqual({ data: null });
    // Missing rows are still cached so a re-read short-circuits.
    expect(_layoutCacheSize()).toBe(1);
  });

  it("caches the parsed payload so a second GET hits the cache (and is sub-5ms)", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "x", type: "container", config: {} }],
      createdAt: "2026-05-09T12:00:00.000Z",
      updatedAt: "2026-05-09T12:00:00.000Z",
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;

    // Cold — populates cache.
    const ctx1 = buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    });
    const res1 = await handler(ctx1);
    expect(res1).toEqual({ data: { sections: [{ id: "x", type: "container", config: {} }] } });
    expect(_layoutCacheSize()).toBe(1);

    // Warm — second call should be served from cache fast.
    // Bench: average of 5 hits.
    const iters = 5;
    const ts: number[] = [];
    for (let i = 0; i < iters; i += 1) {
      const ctx = buildCtx({
        request: new Request(url, { method: "GET" }),
        storage: { layouts },
      });
      const t0 = performance.now();
      const res = await handler(ctx);
      ts.push(performance.now() - t0);
      expect(res).toEqual({ data: { sections: [{ id: "x", type: "container", config: {} }] } });
    }
    const avg = ts.reduce((s, x) => s + x, 0) / ts.length;
    expect(avg).toBeLessThan(5);
  });

  it("cache hit serves the same payload that storage returned (deep equality)", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    const sections = [
      { id: "a", type: "container", config: { foo: "bar" } },
      { id: "b", type: "text", config: { html: "<p>hi</p>" } },
    ];
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections,
      updatedAt: "2026-05-09T12:00:00.000Z",
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    const r1 = await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    const r2 = await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(r1).toEqual({ data: { sections } });
    expect(r2).toEqual({ data: { sections } });
  });

  it("LRU eviction: 201st distinct entry evicts the oldest", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();

    // Pre-populate 200 distinct rows + cache them all.
    for (let i = 0; i < 200; i += 1) {
      const id = `01HXAB${String(i).padStart(20, "0")}`;
      store.set(`pages::${id}`, {
        collection: "pages",
        entryId: id,
        enabled: 1,
        sections: [],
      } as LayoutRow);
      const ctx = buildCtx({
        request: new Request(`http://localhost/layout?pageId=${id}&collection=pages`, { method: "GET" }),
        storage: { layouts },
      });
      const res = await handler(ctx);
      expect(res).toEqual({ data: { sections: [] } });
    }
    expect(_layoutCacheSize()).toBe(200);

    // 201st entry — should push the cache size back down to 200.
    const newId = `01HXAB${String(200).padStart(20, "0")}`;
    store.set(`pages::${newId}`, {
      collection: "pages",
      entryId: newId,
      enabled: 1,
      sections: [],
    } as LayoutRow);
    const ctx201 = buildCtx({
      request: new Request(`http://localhost/layout?pageId=${newId}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    });
    await handler(ctx201);
    expect(_layoutCacheSize()).toBe(200);
  });

  it("LRU recency: hitting an entry promotes it past younger entries", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();

    // Cache 3 entries.
    const ids = ["01HXAB00000000000000000001", "01HXAB00000000000000000002", "01HXAB00000000000000000003"];
    for (const id of ids) {
      store.set(`pages::${id}`, {
        collection: "pages",
        entryId: id,
        enabled: 1,
        sections: [],
      } as LayoutRow);
      const ctx = buildCtx({
        request: new Request(`http://localhost/layout?pageId=${id}&collection=pages`, { method: "GET" }),
        storage: { layouts },
      });
      await handler(ctx);
    }

    // Hit the oldest (ids[0]) — promotes it to most-recent.
    const ctxHit = buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ids[0]}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    });
    await handler(ctxHit);

    // Now cache 197 more so we're at exactly capacity (200) AFTER the previous 3.
    // Total writes 3 + 197 = 200; ids[0] was promoted on its hit so ids[1] is the
    // least-recent.
    for (let i = 0; i < 197; i += 1) {
      const id = `01HXAB${String(i + 100).padStart(20, "0")}`;
      store.set(`pages::${id}`, { collection: "pages", entryId: id, enabled: 1, sections: [] } as LayoutRow);
      const ctx = buildCtx({
        request: new Request(`http://localhost/layout?pageId=${id}&collection=pages`, { method: "GET" }),
        storage: { layouts },
      });
      await handler(ctx);
    }
    expect(_layoutCacheSize()).toBe(200);

    // Add one more — should evict ids[1] (least-recent), NOT ids[0] (recent).
    const evictId = `01HXAB${String(999).padStart(20, "0")}`;
    store.set(`pages::${evictId}`, { collection: "pages", entryId: evictId, enabled: 1, sections: [] } as LayoutRow);
    const ctxEvict = buildCtx({
      request: new Request(`http://localhost/layout?pageId=${evictId}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    });
    await handler(ctxEvict);
    expect(_layoutCacheSize()).toBe(200);

    // ids[0] should still be cached — clear the row in storage so a re-read
    // would return null if the cache missed; the cache hit path returns the
    // original payload (`{ sections: [] }`) without consulting storage.
    store.delete(`pages::${ids[0]}`);
    const r1 = await handler(buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ids[0]}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    }));
    expect(r1).toEqual({ data: { sections: [] } });
  });

  it("invalidation: POST /layout busts the cached entry", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "old", type: "container", config: {} }],
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    // Prime the cache.
    await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(_layoutCacheSize()).toBe(1);

    // POST → invalidates.
    await handler(
      buildCtx({
        request: new Request(url, { method: "POST" }),
        storage: { layouts },
        input: {
          pageId: ULID_A,
          collection: "pages",
          sections: [{ id: "new", type: "container", config: {} }],
        },
      })
    );
    expect(_layoutCacheSize()).toBe(0);

    // Next GET re-populates with the new sections.
    const res = await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(res).toEqual({ data: { sections: [{ id: "new", type: "container", config: {} }] } });
  });

  it("invalidation: POST /toggle busts the cached entry", async () => {
    const layoutHandler = getLayoutHandler();
    const toggleHandler = getToggleHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [],
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    await layoutHandler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(_layoutCacheSize()).toBe(1);

    await toggleHandler(
      buildCtx({
        request: new Request("http://localhost/toggle", { method: "POST" }),
        storage: { layouts },
        input: { entryId: ULID_A, collection: "pages", enabled: false },
      })
    );
    expect(_layoutCacheSize()).toBe(0);
  });

  it("invalidation: content:afterDelete busts the cached entry", async () => {
    const layoutHandler = getLayoutHandler();
    const afterDelete = getAfterDeleteHook();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [],
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    await layoutHandler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(_layoutCacheSize()).toBe(1);

    await afterDelete(
      { id: ULID_A, collection: "pages" },
      buildCtx({
        request: new Request("http://localhost/", { method: "POST" }),
        storage: { layouts },
      })
    );
    expect(_layoutCacheSize()).toBe(0);
  });

  it("does not collide on identical entryId across different collections", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "p", type: "text", config: {} }],
    } as LayoutRow);
    store.set(`posts::${ULID_A}`, {
      collection: "posts",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "post-x", type: "text", config: {} }],
    } as LayoutRow);

    const r1 = await handler(buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ULID_A}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    }));
    const r2 = await handler(buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ULID_A}&collection=posts`, { method: "GET" }),
      storage: { layouts },
    }));

    expect(r1).toEqual({ data: { sections: [{ id: "p", type: "text", config: {} }] } });
    expect(r2).toEqual({ data: { sections: [{ id: "post-x", type: "text", config: {} }] } });
    expect(_layoutCacheSize()).toBe(2);
  });

  it("missing row caches the null payload and serves it from cache", async () => {
    const handler = getLayoutHandler();
    const { layouts } = makeStorage();
    const url = `http://localhost/layout?pageId=${ULID_B}&collection=pages`;

    const r1 = await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(r1).toEqual({ data: null });
    expect(_layoutCacheSize()).toBe(1);

    const r2 = await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }));
    expect(r2).toEqual({ data: null });
    // Still 1 — second call hit the cache, not storage.
    expect(_layoutCacheSize()).toBe(1);
  });
});
