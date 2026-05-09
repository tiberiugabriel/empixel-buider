import { describe, it, expect } from "vitest";

import {
  getBuilderLayout,
  builderLayoutCacheTag,
  type BuilderLayoutContext,
} from "../src/components/db.js";
import type { LayoutRow } from "../src/storage-types.js";

// 26-char Crockford base32 — valid ULID shape.
const ULID_A = "01HXAB000000000000000000AA";

/**
 * F3.4 + F3.5 — frontend `getBuilderLayout` is async, takes `Astro` (or any
 * `BuilderLayoutContext`) as the first argument, and reads through
 * EmDash's `_plugin_storage` table via `Astro.locals.emdash.db` (Kysely).
 *
 * **Post-F3.5 the legacy `better-sqlite3` fallback is gone** — when no
 * Kysely handle is present (pre-0.9 EmDash hosts), the reader returns
 * `{ sections: null, cacheHint: { tags: [...] } }`. The previous tests
 * that exercised the legacy SQLite path (slug → ULID resolution against
 * `ec_<collection>`, direct SELECT against `empixel_builder_layouts`) are
 * gone with the path itself.
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
 * Empty Astro-like context — no `db` exposed. Post-F3.5 this short-circuits
 * to `null` sections (no legacy fallback).
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

describe("getBuilderLayout (F3.5 — async, storage-only)", () => {
  it("returns null sections + tagged cacheHint when storage has no matching row", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns null sections + cacheHint when the host short-circuits with enabled=false", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "pages", ULID_A, false);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  it("returns the tagged hint even when the collection name is invalid", async () => {
    const { ctx } = makeStorageStub([]);
    const result = await getBuilderLayout(ctx, "PaGeS!!", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:PaGeS!!:${ULID_A}`,
    ]);
  });

  it("returns null sections + cacheHint when no storage handle on locals (no legacy fallback)", async () => {
    const result = await getBuilderLayout(makeNoStorageCtx(), "pages", ULID_A);
    expect(result.sections).toBeNull();
    expect(result.cacheHint.tags).toEqual([
      `empixel:layout:pages:${ULID_A}`,
    ]);
    // No DB lookup happens, so no `lastModified` either.
    expect(result.cacheHint.lastModified).toBeUndefined();
  });

  describe("storage-present path", () => {
    it("returns sections + lastModified for an enabled storage row", async () => {
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
      expect(result.sections).toBeNull();
    });
  });
});
