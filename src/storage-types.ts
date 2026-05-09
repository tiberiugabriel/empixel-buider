/**
 * Public types describing the plugin's `ctx.storage` shape.
 *
 * Owned by Agent A; consumed by Agent B (frontend reader rewrite in F3.4) and
 * by the integration tests. Lifting these types into `src/types.ts` would be
 * an orchestrator-mediated change — keep them local until / unless multiple
 * subsystems start importing the shape.
 *
 * The `LayoutRow` shape mirrors the existing `empixel_builder_layouts` SQLite
 * row (see `prd-backend.md` § Database). Field names use camelCase to match
 * EmDash's storage conventions and the `(collection, entryId)` composite key
 * we declared as a unique index in `src/plugin.ts`.
 *
 * `StorageCollection<T>` is the typed handle EmDash injects on
 * `ctx.storage.<collection>` once the plugin declares it via
 * `definePlugin({ storage })`. See
 * `node_modules/emdash/dist/types-D19uBYWn.d.mts` (interface
 * `StorageCollection`) for the full method surface — `get`, `put`, `delete`,
 * `exists`, `getMany`, `putMany`, `deleteMany`, `query`, `count`. F3.2
 * rewrites the route handlers onto these methods; F3.3 adds the one-shot
 * migration that copies the existing `empixel_builder_layouts` rows into
 * the storage collection.
 */
import type { StorageCollection } from "emdash";
import type { SectionBlock } from "./types.js";

/**
 * Wire shape of one row in the `layouts` storage collection.
 *
 * Composite identity is `(collection, entryId)` — declared as a unique
 * composite index in `src/plugin.ts`. The storage layer assigns the document
 * `id`; lookups go through `query({ where: { collection, entryId } })` or its
 * `findOne`-style equivalent (the exact querying surface is fixed in F3.2 once
 * we audit which methods perform best on top of EmDash's storage abstraction).
 *
 * `entryId` always carries the canonical ULID after the F2.3 slug → ULID
 * migration. `enabled` mirrors the existing SQLite column; SQLite's `INTEGER`
 * round-trips as a JS number, but multi-driver back-ends (Postgres, D1, Turso)
 * may coerce to boolean — the type accepts both forms so consumers can read
 * either without flinching. Writers should standardise on numeric `0 | 1`
 * until F3.4 audits driver behaviour.
 *
 * `sections` is the parsed `SectionBlock[]` (NOT a JSON-stringified blob like
 * the legacy column was). The storage abstraction handles serialisation; we
 * pass the structured value straight in. Empty layouts use `[]`.
 *
 * `createdAt` / `updatedAt` are populated by the storage layer when supported;
 * `getBuilderLayout`'s `cacheHint.lastModified` reads from `updatedAt`.
 */
export interface LayoutRow {
  /** Collection slug, e.g. `"pages"`. Lowercase a–z, 0–9 and `_` only. */
  collection: string;
  /** Canonical EmDash ULID for the entry. */
  entryId: string;
  /**
   * Per-entry enable flag. SQLite back-end persists 0/1; other drivers may
   * normalise to boolean. Consumers must accept both shapes when reading.
   */
  enabled: 0 | 1 | boolean;
  /** Parsed block tree. Empty layouts use `[]`. */
  sections: SectionBlock[];
  /** ISO-8601 timestamp set by the storage layer on insert. Optional on read. */
  createdAt?: string;
  /** ISO-8601 timestamp set by the storage layer on update. Drives `cacheHint.lastModified`. */
  updatedAt?: string;
}

/**
 * Typed `ctx.storage.layouts` handle. Re-export for Agent B (F3.4 frontend
 * reader rewrite) and any future consumer that needs the typed surface
 * without re-declaring the row shape.
 */
export type StorageLayoutsCollection = StorageCollection<LayoutRow>;
