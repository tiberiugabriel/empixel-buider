import { describe, it, expect, beforeEach } from "vitest";

import { listEntriesForCollection } from "../src/plugin.js";
import type { EntryListItem } from "../src/plugin.js";
import type { LayoutRow, StorageLayoutsCollection } from "../src/storage-types.js";
import { _resetMigrationCacheForTests } from "../src/migrations/toStorageV1.js";

/**
 * Hotfix coverage for the post-F3.5peer regression on `/entries`.
 *
 * The original bug — that drove this whole PR — was that
 * `listEntriesForCollection` reached for `(ctx as { db?: unknown }).db`
 * (Kysely) which never existed on `PluginContext`, so the helper always
 * returned an empty array no matter how many host entries the
 * collection had. The fix routes host-entry reads through `ctx.content`
 * (provided because the plugin declares the `content:read` capability).
 *
 * These tests exercise the helper directly with stub `ctx.storage` +
 * `ctx.content` + `ctx.kv` + `ctx.log` surfaces, so we can drive every
 * branch (storage rows present, host rows present, both present and
 * merged, neither present, ctx.content unavailable for pre-0.9 hosts,
 * orphan storage rows that don't match any host entry, large
 * collection that paginates) without spinning up an HTTP layer.
 */

const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";
const ULID_C = "01HXAB000000000000000000CC";
const ULID_D = "01HXAB000000000000000000DD";

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

function makeKvStub(initial: Record<string, unknown> = {}): import("emdash").KVAccess {
  const store = new Map<string, unknown>(Object.entries(initial));
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

/**
 * Storage stub that supports a working `where: { collection }` filter on
 * the JSON `data.collection` field. Mirrors EmDash's
 * `PluginStorageRepository` semantics enough that the `/entries` query
 * path produces the same merge behaviour as it would in production.
 */
function makeStorageStubWithCollectionFilter(
  rows: Array<{ id: string; data: LayoutRow | { entryId?: string; collection?: string } }>
): { layouts: StorageLayoutsCollection; allRows: typeof rows } {
  const layouts: StorageLayoutsCollection = {
    async get(id) {
      const row = rows.find((r) => r.id === id);
      return (row?.data as LayoutRow | undefined) ?? null;
    },
    async put() {
      throw new Error("not implemented for /entries tests");
    },
    async delete() {
      throw new Error("not implemented for /entries tests");
    },
    async exists(id) {
      return rows.some((r) => r.id === id);
    },
    async getMany() {
      throw new Error("not implemented for /entries tests");
    },
    async putMany() {},
    async deleteMany() {
      return 0;
    },
    async query(options) {
      const where = options?.where ?? {};
      const filtered = rows.filter((r) => {
        for (const [field, value] of Object.entries(where)) {
          // `data.collection` filter — JSON-extract semantics
          // (NULL when the field is absent, which is exactly the
          // behaviour we get from SQLite's `json_extract` for the
          // F3.2 dev-iteration orphan rows that have no `collection`
          // field in their JSON payload).
          const actual = (r.data as Record<string, unknown>)[field];
          if (actual !== value) return false;
        }
        return true;
      });
      return {
        items: filtered.map((r) => ({ id: r.id, data: r.data as LayoutRow })),
        hasMore: false,
      };
    },
    async count() {
      return rows.length;
    },
  };
  return { layouts, allRows: rows };
}

interface FakeContentItem {
  id: string;
  type: string;
  slug: string | null;
  status: string;
  locale: string | null;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

function makeContentStub(
  rows: Record<string, FakeContentItem[]>
): import("emdash").ContentAccess {
  return {
    async get(collection, id) {
      const found = rows[collection]?.find((r) => r.id === id);
      return found ?? null;
    },
    async list(collection, options) {
      const all = rows[collection] ?? [];
      const limit = Math.min(options?.limit ?? 50, 100);
      // Dead-simple cursor: `start:N` to keep tests deterministic.
      let start = 0;
      if (options?.cursor) {
        const m = /^start:(\d+)$/.exec(options.cursor);
        if (m) start = parseInt(m[1], 10);
      }
      const slice = all.slice(start, start + limit);
      const next = start + limit;
      return {
        items: slice,
        cursor: next < all.length ? `start:${next}` : undefined,
        hasMore: next < all.length,
      };
    },
  };
}

function makeRouteContext(
  layouts: StorageLayoutsCollection,
  content: import("emdash").ContentAccess | undefined,
  kvStore: Record<string, unknown> = {}
): import("emdash").RouteContext & { request: Request } {
  const { log } = makeLogStub();
  const kv = makeKvStub(kvStore);
  const ctx = {
    plugin: { id: "empixel-builder", version: "0.9.0" },
    storage: { layouts } as unknown as import("emdash").PluginStorage<import("emdash").PluginStorageConfig>,
    kv,
    content,
    log,
    site: { url: "http://localhost", name: "test" } as unknown as import("emdash").RouteContext["site"],
    url: (path: string) => `http://localhost${path}`,
    input: undefined,
    request: new Request("http://localhost/_emdash/api/plugins/empixel-builder/entries"),
    requestMeta: { ip: null, userAgent: null, referer: null, geo: null },
  } as unknown as import("emdash").RouteContext & { request: Request };
  return ctx;
}

beforeEach(() => {
  // The lazy-gate migration caches "already ran" in a process-local
  // boolean. Reset between tests so each case exercises the full path.
  _resetMigrationCacheForTests();
});

describe("/entries — listEntriesForCollection (post-F3.5peer regression fix)", () => {
  it("returns the merged shape when storage AND host have rows (the Novapera reproduction)", async () => {
    // Mirrors the actual Novapera DB state: 4 valid storage rows
    // (1 page disabled, 3 posts enabled) + 2 F3.2 dev-iteration orphan
    // rows (bare-ULID id, no `collection` field in JSON). Host has 1
    // page + 3 posts.
    const { layouts } = makeStorageStubWithCollectionFilter([
      {
        id: `pages::${ULID_A}`,
        data: {
          collection: "pages",
          entryId: ULID_A,
          enabled: 0,
          sections: [],
          createdAt: "2026-05-08T12:00:00.000Z",
          updatedAt: "2026-05-09T12:00:00.000Z",
        } satisfies LayoutRow,
      },
      {
        id: `posts::${ULID_B}`,
        data: {
          collection: "posts",
          entryId: ULID_B,
          enabled: 1,
          sections: [],
          createdAt: "2026-05-07T12:00:00.000Z",
          updatedAt: "2026-05-09T13:00:00.000Z",
        } satisfies LayoutRow,
      },
      // Orphan rows from F3.2 dev iterations — no `collection` field.
      {
        id: ULID_A,
        data: { entryId: ULID_A } as unknown as LayoutRow,
      },
      {
        id: ULID_B,
        data: { entryId: ULID_B } as unknown as LayoutRow,
      },
    ]);

    const content = makeContentStub({
      pages: [
        {
          id: ULID_A,
          type: "pages",
          slug: "about",
          status: "published",
          locale: "en",
          data: { title: "About" },
          createdAt: "2026-05-01T10:00:00.000Z",
          updatedAt: "2026-05-08T10:00:00.000Z",
          publishedAt: null,
        },
      ],
    });

    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items: EntryListItem[] = await listEntriesForCollection(ctx, "pages", 100);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(ULID_A);
    expect(items[0].slug).toBe("about");
    expect(items[0].title).toBe("About");
    // builder_enabled comes from storage meta (NOT host); pages row has enabled=0
    expect(items[0].builder_enabled).toBe(false);
    // timestamps prefer storage meta when present
    expect(items[0].updated_at).toBe("2026-05-09T12:00:00.000Z");
  });

  it("merges enabled flag and timestamps from storage when both layers exist", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([
      {
        id: `posts::${ULID_B}`,
        data: {
          collection: "posts",
          entryId: ULID_B,
          enabled: 1,
          sections: [],
          createdAt: "2026-05-08T08:00:00.000Z",
          updatedAt: "2026-05-09T15:00:00.000Z",
        } satisfies LayoutRow,
      },
      {
        id: `posts::${ULID_C}`,
        data: {
          collection: "posts",
          entryId: ULID_C,
          enabled: true, // multi-driver coercion
          sections: [],
          createdAt: "2026-05-07T08:00:00.000Z",
          updatedAt: "2026-05-09T16:00:00.000Z",
        } satisfies LayoutRow,
      },
    ]);
    const content = makeContentStub({
      posts: [
        {
          id: ULID_B,
          type: "posts",
          slug: "first-post",
          status: "published",
          locale: "en",
          data: { title: "First Post" },
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
          publishedAt: "2026-05-02T08:00:00.000Z",
        },
        {
          id: ULID_C,
          type: "posts",
          slug: "second-post",
          status: "draft",
          locale: "en",
          data: { title: "Second Post" },
          createdAt: "2026-05-02T08:00:00.000Z",
          updatedAt: "2026-05-02T08:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "posts", 100);

    expect(items).toHaveLength(2);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId[ULID_B].title).toBe("First Post");
    expect(byId[ULID_B].builder_enabled).toBe(true);
    expect(byId[ULID_B].updated_at).toBe("2026-05-09T15:00:00.000Z"); // storage meta wins
    expect(byId[ULID_C].title).toBe("Second Post");
    expect(byId[ULID_C].builder_enabled).toBe(true); // boolean coercion
  });

  it("returns host entries with builder_enabled=false when storage has no rows for the collection", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([]);
    const content = makeContentStub({
      pages: [
        {
          id: ULID_A,
          type: "pages",
          slug: "home",
          status: "published",
          locale: "en",
          data: { title: "Home" },
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 100);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(ULID_A);
    expect(items[0].builder_enabled).toBe(false);
    expect(items[0].title).toBe("Home");
    // timestamps fall through to host's createdAt/updatedAt
    expect(items[0].created_at).toBe("2026-05-01T08:00:00.000Z");
  });

  it("returns empty list when ctx.content is unavailable (pre-0.9 EmDash host)", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([
      {
        id: `pages::${ULID_A}`,
        data: {
          collection: "pages",
          entryId: ULID_A,
          enabled: 1,
          sections: [],
          createdAt: "2026-05-08T12:00:00.000Z",
          updatedAt: "2026-05-09T12:00:00.000Z",
        } satisfies LayoutRow,
      },
    ]);
    const ctx = makeRouteContext(layouts, undefined, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 100);

    expect(items).toHaveLength(0);
  });

  it("falls back to slug when title is missing in data", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([]);
    const content = makeContentStub({
      pages: [
        {
          id: ULID_A,
          type: "pages",
          slug: "no-title-slug",
          status: "published",
          locale: "en",
          data: {}, // no title or name
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 100);
    expect(items[0].title).toBe("no-title-slug");
  });

  it("uses `name` as title fallback when title is absent but name is present", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([]);
    const content = makeContentStub({
      pages: [
        {
          id: ULID_A,
          type: "pages",
          slug: "page-slug",
          status: "published",
          locale: "en",
          data: { name: "Page Name From Field" },
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 100);
    expect(items[0].title).toBe("Page Name From Field");
  });

  it("paginates through ctx.content.list when host has more than one page worth", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([]);
    // 150 host entries; default page size in the helper caps at 100 so
    // the second page must be fetched too. We pass limit=200 so the
    // helper actually goes after both pages.
    const hostRows: FakeContentItem[] = Array.from({ length: 150 }, (_, i) => {
      const id = `01HXAB000000000000000000${String(i).padStart(2, "0")}`;
      return {
        id,
        type: "pages",
        slug: `page-${i}`,
        status: "published",
        locale: "en",
        data: { title: `Page ${i}` },
        createdAt: "2026-05-01T08:00:00.000Z",
        updatedAt: "2026-05-01T08:00:00.000Z",
        publishedAt: null,
      };
    });
    const content = makeContentStub({ pages: hostRows });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 200);
    expect(items).toHaveLength(150);
  });

  it("respects the `limit` parameter and truncates results", async () => {
    const { layouts } = makeStorageStubWithCollectionFilter([]);
    const hostRows: FakeContentItem[] = Array.from({ length: 30 }, (_, i) => ({
      id: `01HXAB000000000000000000${String(i).padStart(2, "0")}`,
      type: "pages",
      slug: `p-${i}`,
      status: "published",
      locale: "en",
      data: { title: `P ${i}` },
      createdAt: "2026-05-01T08:00:00.000Z",
      updatedAt: "2026-05-01T08:00:00.000Z",
      publishedAt: null,
    }));
    const content = makeContentStub({ pages: hostRows });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 5);
    expect(items).toHaveLength(5);
  });

  it("ignores storage rows whose entryId does not match any host entry", async () => {
    // The Novapera-style "stale storage" case — a layout row exists for
    // an entry that's been deleted from the host. Should be silently
    // dropped rather than producing a phantom row in the listing.
    const { layouts } = makeStorageStubWithCollectionFilter([
      {
        id: `pages::${ULID_D}`,
        data: {
          collection: "pages",
          entryId: ULID_D,
          enabled: 1,
          sections: [],
          createdAt: "2026-05-08T12:00:00.000Z",
          updatedAt: "2026-05-09T12:00:00.000Z",
        } satisfies LayoutRow,
      },
    ]);
    const content = makeContentStub({
      pages: [
        {
          id: ULID_A,
          type: "pages",
          slug: "real",
          status: "published",
          locale: "en",
          data: { title: "Real Page" },
          createdAt: "2026-05-01T08:00:00.000Z",
          updatedAt: "2026-05-01T08:00:00.000Z",
          publishedAt: null,
        },
      ],
    });
    const ctx = makeRouteContext(layouts, content, {
      "state:migration:to_storage_v1": "1",
    });

    const items = await listEntriesForCollection(ctx, "pages", 100);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(ULID_A);
  });
});
