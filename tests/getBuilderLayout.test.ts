import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";

import {
  getBuilderLayout,
  builderLayoutCacheTag,
  type BuilderLayoutContext,
} from "../src/components/db.js";
import {
  _resetDbForTests,
  getDb,
  setDefaultDatabasePath,
} from "../src/dbShared.js";
import type { LayoutRow } from "../src/storage-types.js";

// 26-char Crockford base32 — valid ULID shape.
const ULID_A = "01HXAB000000000000000000AA";
const ULID_B = "01HXAB000000000000000000BB";

const sandbox = mkdtempSync(join(tmpdir(), "empixel-get-layout-"));
let counter = 0;

function freshDbPath(): string {
  counter += 1;
  return join(sandbox, `test-${counter}.db`);
}

/**
 * Bootstrap a clean SQLite file with the canonical layouts schema and a
 * stand-in `ec_<collection>` table the slug → ULID resolution can read.
 * Used to exercise the legacy-fallback path of the F3.4 reader.
 */
function bootstrap(collection: string): string {
  const path = freshDbPath();
  setDefaultDatabasePath(path);
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
    CREATE TABLE IF NOT EXISTS ec_${collection} (
      id   TEXT PRIMARY KEY,
      slug TEXT
    )
  `);
  return path;
}

/**
 * Build a minimal Kysely-shaped stub the F3.4 reader can interrogate.
 * Mirrors the public surface of `db.selectFrom("_plugin_storage")...` —
 * `select`, `where`, `executeTakeFirst`, `execute`. The stub stores rows
 * indexed by their stringified `(plugin_id, collection)` partition key
 * and applies all `where(...)` filters when executing.
 *
 * Production hosts pass `Astro.locals.emdash.db` (the real Kysely
 * instance from EmDash). The stub keeps the unit test free of any DB
 * dependency at the storage layer.
 */
interface StorageStubRow {
  plugin_id: string;
  collection: string;
  id: string;
  data: string;
  updated_at?: string;
}
function makeStorageStub(rows: StorageStubRow[]): {
  ctx: BuilderLayoutContext;
  pushed: StorageStubRow[];
} {
  const pushed = [...rows];
  // The stub builds up filter constraints via repeated `.where(...)`
  // calls and applies them all at execute time. Operators are constrained
  // to `=`, which is what the reader currently uses. If the reader gains
  // additional operators, expand here.
  type Filter = [field: string, op: string, value: unknown];
  function buildSelector(initial: Filter[] = []) {
    const filters: Filter[] = [...initial];
    const builder = {
      select(_cols: string[]) {
        return builder;
      },
      where(field: string, op: string, value: unknown) {
        filters.push([field, op, value]);
        return builder;
      },
      executeTakeFirst() {
        const match = pushed.find((row) => {
          return filters.every(([field, op, value]) => {
            if (op !== "=") return false;
            return (row as unknown as Record<string, unknown>)[field] === value;
          });
        });
        return Promise.resolve(match);
      },
      execute() {
        const matches = pushed.filter((row) => {
          return filters.every(([field, op, value]) => {
            if (op !== "=") return false;
            return (row as unknown as Record<string, unknown>)[field] === value;
          });
        });
        return Promise.resolve(matches);
      },
    };
    return builder;
  }
  const db = {
    selectFrom(_table: string) {
      return buildSelector();
    },
  };
  const ctx: BuilderLayoutContext = {
    locals: { emdash: { db } },
  };
  return { ctx, pushed };
}

/**
 * Empty Astro-like context — no `db` exposed. Forces the reader straight
 * to the legacy SQLite fallback.
 */
function makeNoStorageCtx(): BuilderLayoutContext {
  return { locals: { emdash: {} } };
}

describe("builderLayoutCacheTag", () => {
  it("encodes collection and entry id", () => {
    expect(builderLayoutCacheTag("posts", ULID_A)).toBe(
      `empixel:layout:posts:${ULID_A}`,
    );
  });
});

describe("getBuilderLayout (F3.4 — async, Astro-aware)", () => {
  beforeEach(() => {
    _resetDbForTests();
  });

  afterAll(() => {
    _resetDbForTests();
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("returns null sections + tagged cacheHint when no storage row and no legacy row", async () => {
    bootstrap("pages");
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns null sections + cacheHint when the host short-circuits with enabled=false", async () => {
    bootstrap("pages");
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A, false);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    // Short-circuit path doesn't touch storage or SQLite, so no timestamp.
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns the tagged hint even when the collection name is invalid", async () => {
    bootstrap("pages");
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "PaGeS!!", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:PaGeS!!:${ULID_A}`,
    ]);
  });

  describe("storage-present path", () => {
    it("returns sections + lastModified for an enabled storage row", async () => {
      // Keep the legacy SQLite empty so we can prove the read came from
      // storage and not from the fallback.
      bootstrap("pages");
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
        updatedAt: "2026-05-09T14:30:15.000Z",
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: `pages:${ULID_A}`,
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:pages:${ULID_A}`,
      ]);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T14:30:15.000Z",
      );
    });

    it("treats a disabled storage row as null sections but still stamps lastModified", async () => {
      bootstrap("pages");
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: 0,
        sections: [],
        updatedAt: "2026-05-09T12:00:00.000Z",
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: `pages:${ULID_A}`,
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T12:00:00.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T12:00:00.000Z",
      );
    });

    it("accepts boolean `enabled` (multi-driver back-ends may coerce 0/1)", async () => {
      bootstrap("pages");
      const layoutRow: LayoutRow = {
        collection: "pages",
        entryId: ULID_A,
        enabled: true,
        sections: [],
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: `pages:${ULID_A}`,
          data: JSON.stringify(layoutRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
    });

    it("filters out unrelated storage rows (different collection)", async () => {
      bootstrap("pages");
      const wrongCollectionRow: LayoutRow = {
        collection: "posts",
        entryId: ULID_A,
        enabled: 1,
        sections: [],
      };
      const { ctx } = makeStorageStub([
        {
          plugin_id: "empixel-builder",
          collection: "layouts",
          id: `posts:${ULID_A}`,
          data: JSON.stringify(wrongCollectionRow),
          updated_at: "2026-05-09T14:30:15.000Z",
        },
      ]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      // No matching row in storage and no legacy row either → null.
      expect(result.sections).toBeNull();
    });

    it("falls through to the legacy SQLite table when storage has no matching row", async () => {
      bootstrap("pages");
      const db = getDb();
      // Seed a row in the legacy table only.
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)",
      ).run("pages", ULID_A, JSON.stringify([]), "2026-05-09 09:00:00");
      const { ctx } = makeStorageStub([]);
      const result = await getBuilderLayout(ctx, "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T09:00:00.000Z",
      );
    });
  });

  describe("legacy-fallback path", () => {
    it("returns sections + lastModified for an enabled legacy row when no storage handle", async () => {
      bootstrap("pages");
      const db = getDb();
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)",
      ).run("pages", ULID_A, JSON.stringify([]), "2026-05-09 14:30:15");
      const result = await getBuilderLayout(makeNoStorageCtx(), "pages", ULID_A);
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:pages:${ULID_A}`,
      ]);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T14:30:15.000Z",
      );
    });

    it("emits lastModified even when the legacy row exists but is disabled", async () => {
      // Admin can save a layout while keeping it disabled; saving a future
      // enable still has to bust the cache, so the timestamp is meaningful
      // even on the disabled-row path.
      bootstrap("pages");
      const db = getDb();
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 0, ?)",
      ).run("pages", ULID_A, JSON.stringify([]), "2026-05-09 12:00:00");
      const result = await getBuilderLayout(makeNoStorageCtx(), "pages", ULID_A);
      expect(result.sections).toBeNull();
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T12:00:00.000Z",
      );
    });

    it("resolves slug → ULID before deriving the cache tag", async () => {
      // The cache tag binds to the `entryId` argument the host actually
      // passed, regardless of slug→ULID resolution. Hosts pass
      // `entry.data.id` (always a ULID via `getEmDashEntry`), but the slug
      // path matters for the fresh-entry case where the host CMS hands
      // the builder a slug.
      bootstrap("pages");
      const db = getDb();
      db.prepare(`INSERT INTO ec_pages (id, slug) VALUES (?, ?)`).run(
        ULID_B,
        "hello-world",
      );
      db.prepare(
        "INSERT INTO empixel_builder_layouts (collection, entry_id, sections, enabled, updated_at) VALUES (?, ?, ?, 1, ?)",
      ).run("pages", ULID_B, JSON.stringify([]), "2026-05-09 09:00:00");

      const result = await getBuilderLayout(
        makeNoStorageCtx(),
        "pages",
        "hello-world",
      );
      expect(Array.isArray(result.sections)).toBe(true);
      // Tag uses the slug (the argument the host passed) — that's the
      // identity the host page asked for. Saves go through the same slug
      // → ULID resolution and emit the same tag, so the bind is consistent.
      expect(result.cacheHint.tags).toEqual([
        `empixel:layout:pages:hello-world`,
      ]);
      expect(result.cacheHint.lastModified?.toISOString()).toBe(
        "2026-05-09T09:00:00.000Z",
      );
    });
  });
});
