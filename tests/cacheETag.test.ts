import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createPlugin, _resetLayoutCache, _layoutCacheSize } from "../src/plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";

/**
 * F4.2 — `/layout` GET in-memory LRU cache + ETag round-trip.
 *
 * The plugin runtime is exercised through the resolved `ResolvedPlugin`
 * surface (`plugin.routes.layout.handler(...)`); the route handler is the
 * documented public boundary, so testing through it covers the cache wiring,
 * the ETag header derivation, and the 304 short-circuit in one shot.
 *
 * No real EmDash host needed — we hand the route a fake `RouteContext` with
 * stubbed `kv`, `storage`, `content`, `log` (mirroring the existing pattern
 * in `tests/storage.test.ts` / `tests/entriesRoute.test.ts`).
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

describe("F4.2 — LRU cache on /layout GET", () => {
  beforeEach(() => {
    _resetLayoutCache();
  });
  afterEach(() => {
    _resetLayoutCache();
  });

  it("caches the response body so a second GET hits the cache (and is sub-5ms)", async () => {
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
    const res1 = (await handler(ctx1)) as Response;
    expect(res1.status).toBe(200);
    const body1 = await res1.text();
    expect(JSON.parse(body1)).toEqual({
      data: { sections: [{ id: "x", type: "container", config: {} }] },
    });

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
      const res = (await handler(ctx)) as Response;
      ts.push(performance.now() - t0);
      expect(res.status).toBe(200);
    }
    const avg = ts.reduce((s, x) => s + x, 0) / ts.length;
    expect(avg).toBeLessThan(5);
  });

  it("ETag round trip: GET returns ETag, second GET with If-None-Match returns 304", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "y", type: "text", config: {} }],
      updatedAt: "2026-05-09T12:00:00.000Z",
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;

    const ctx1 = buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    });
    const res1 = (await handler(ctx1)) as Response;
    expect(res1.status).toBe(200);
    const etag = res1.headers.get("etag");
    expect(etag).toBeTruthy();
    expect(etag).toMatch(/^"[0-9a-f]{40}"$/);

    // Conditional GET with matching ETag → 304.
    const ctx2 = buildCtx({
      request: new Request(url, {
        method: "GET",
        headers: { "If-None-Match": etag! },
      }),
      storage: { layouts },
    });
    const res2 = (await handler(ctx2)) as Response;
    expect(res2.status).toBe(304);
    expect(res2.headers.get("etag")).toBe(etag);
    expect(await res2.text()).toBe("");
  });

  it("ETag mismatches don't 304 — fresh body served", async () => {
    const handler = getLayoutHandler();
    const { layouts, store } = makeStorage();
    store.set(`pages::${ULID_A}`, {
      collection: "pages",
      entryId: ULID_A,
      enabled: 1,
      sections: [{ id: "x", type: "container", config: {} }],
    } as LayoutRow);

    const url = `http://localhost/layout?pageId=${ULID_A}&collection=pages`;
    const ctx = buildCtx({
      request: new Request(url, {
        method: "GET",
        headers: { "If-None-Match": '"some-other-hash"' },
      }),
      storage: { layouts },
    });
    const res = (await handler(ctx)) as Response;
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBeTruthy();
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
      const res = (await handler(ctx)) as Response;
      expect(res.status).toBe(200);
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

    // Now cache 198 more so we're at exactly capacity (200) AFTER the previous 3.
    // Add 197 more — total writes 3 + 197 = 200; ids[0] was promoted on its hit.
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

    // ids[0] should still be cached — re-fetch and check `if-none-match` round-trips.
    const ctxCheck1 = buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ids[0]}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    });
    const r1 = (await handler(ctxCheck1)) as Response;
    const etag = r1.headers.get("etag")!;
    const ctxCheck2 = buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ids[0]}&collection=pages`, {
        method: "GET",
        headers: { "If-None-Match": etag },
      }),
      storage: { layouts },
    });
    const r2 = (await handler(ctxCheck2)) as Response;
    expect(r2.status).toBe(304);
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
    const res = (await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }))) as Response;
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({
      data: { sections: [{ id: "new", type: "container", config: {} }] },
    });
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

    const r1 = (await handler(buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ULID_A}&collection=pages`, { method: "GET" }),
      storage: { layouts },
    }))) as Response;
    const r2 = (await handler(buildCtx({
      request: new Request(`http://localhost/layout?pageId=${ULID_A}&collection=posts`, { method: "GET" }),
      storage: { layouts },
    }))) as Response;

    expect(r1.headers.get("etag")).not.toBe(r2.headers.get("etag"));
    expect(_layoutCacheSize()).toBe(2);
  });

  it("missing row caches `data: null` and serves it from cache", async () => {
    const handler = getLayoutHandler();
    const { layouts } = makeStorage();
    const url = `http://localhost/layout?pageId=${ULID_B}&collection=pages`;

    const r1 = (await handler(buildCtx({
      request: new Request(url, { method: "GET" }),
      storage: { layouts },
    }))) as Response;
    const body1 = await r1.text();
    expect(JSON.parse(body1)).toEqual({ data: null });
    expect(_layoutCacheSize()).toBe(1);

    const r2 = (await handler(buildCtx({
      request: new Request(url, {
        method: "GET",
        headers: { "If-None-Match": r1.headers.get("etag")! },
      }),
      storage: { layouts },
    }))) as Response;
    expect(r2.status).toBe(304);
  });
});
