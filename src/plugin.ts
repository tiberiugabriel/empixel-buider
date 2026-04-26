import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";

interface RouteCtx extends PluginContext {
  request: Request;
  input?: unknown;
}
import { createRequire } from "node:module";
import { join } from "node:path";
import type { SectionBlock } from "./types.js";

const KV_ENABLED = "settings:enabledCollections";
const _require = createRequire(import.meta.url);

interface SqliteStatement {
  get(...args: unknown[]): unknown;
  run(...args: unknown[]): void;
}

interface SqliteDb {
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

let _db: SqliteDb | null = null;

function getDb(): SqliteDb {
  if (_db) return _db;
  const Database = _require("better-sqlite3");
  _db = new Database(join(process.cwd(), "data.db")) as SqliteDb;
  _db.exec(`
    CREATE TABLE IF NOT EXISTS empixel_builder_layouts (
      collection TEXT NOT NULL,
      entry_id   TEXT NOT NULL,
      sections   TEXT NOT NULL DEFAULT '[]',
      created_at TEXT DEFAULT (current_timestamp),
      updated_at TEXT DEFAULT (current_timestamp),
      PRIMARY KEY (collection, entry_id)
    )
  `);
  return _db;
}

export function createPlugin() {
  return definePlugin({
    id: "empixel-builder",
    version: "0.1.0",
    capabilities: ["read:content"],
    routes: {
      // GET  ?pageId=&collection=  → load layout
      // POST { pageId, collection, sections } → save layout
      layout: {
        handler: async (ctx: RouteCtx) => {
          const method = ctx.request.method;
          const url = new URL(ctx.request.url);

          if (method === "GET") {
            const pageId = url.searchParams.get("pageId");
            const collection = url.searchParams.get("collection");
            if (!pageId || !collection) {
              return new Response(
                JSON.stringify({ error: { message: "pageId and collection are required" } }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            const row = getDb()
              .prepare("SELECT sections FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
              .get(collection, pageId) as { sections: string } | undefined;
            return { data: row ? { sections: JSON.parse(row.sections) } : null };
          }

          if (method === "POST") {
            const body = ctx.input as { pageId?: string; collection?: string; sections?: SectionBlock[] } | undefined;
            const { pageId, collection, sections } = body ?? {};
            if (!pageId || !collection || !sections) {
              return new Response(
                JSON.stringify({ error: { message: "pageId, collection and sections are required" } }),
                { status: 400, headers: { "Content-Type": "application/json" } }
              );
            }
            getDb()
              .prepare(`
                INSERT INTO empixel_builder_layouts (collection, entry_id, sections, updated_at)
                VALUES (?, ?, ?, current_timestamp)
                ON CONFLICT(collection, entry_id) DO UPDATE SET
                  sections = excluded.sections,
                  updated_at = current_timestamp
              `)
              .run(collection, pageId, JSON.stringify(sections));
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },

      // GET → returns list of collections with builder enabled
      collections: {
        handler: async (ctx: RouteCtx) => {
          const enabled = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          return { data: enabled };
        },
      },

      // POST { collection, enabled } → toggle builder on/off for a collection
      settings: {
        handler: async (ctx: RouteCtx) => {
          if (ctx.request.method !== "POST") {
            return new Response("Method Not Allowed", { status: 405 });
          }
          const body = ctx.input as { collection?: string; enabled?: boolean } | undefined;
          if (!body?.collection) {
            return new Response(
              JSON.stringify({ error: { message: "collection is required" } }),
              { status: 400, headers: { "Content-Type": "application/json" } }
            );
          }
          const current = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          const updated = body.enabled
            ? (current.includes(body.collection) ? current : [...current, body.collection])
            : current.filter((c) => c !== body.collection);
          await ctx.kv.set(KV_ENABLED, updated);
          return { success: true };
        },
      },

      // GET ?collection=pages&limit=50 → list entries for page selector
      entries: {
        handler: async (ctx: RouteCtx) => {
          const url = new URL(ctx.request.url);
          const collection = url.searchParams.get("collection") ?? "pages";
          const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);

          if (!ctx.content) {
            return new Response(
              JSON.stringify({ error: { message: "read:content capability required" } }),
              { status: 500, headers: { "Content-Type": "application/json" } }
            );
          }

          const result = await ctx.content.list(collection, { limit });
          const items = result.items.map((entry: { id: string; data?: { title?: string } }) => ({
            id: entry.id,
            title: entry.data?.title ?? entry.id,
          }));

          return { data: items, collection };
        },
      },
    },
    hooks: {
      "content:afterDelete": {
        handler: async (event: { id?: string; entry?: { id: string }; collection?: string }) => {
          try {
            const entryId = event.id ?? event.entry?.id;
            if (event.collection && entryId) {
              getDb()
                .prepare("DELETE FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
                .run(event.collection, entryId);
            }
          } catch {
            // ignore cleanup errors
          }
        },
      },
    },
    admin: {
      entry: "empixel-builder/admin",
      pages: [
        { path: "/editor", label: "EmPixel Builder" },
      ],
      fieldWidgets: [
        { name: "page-builder", label: "EmPixel Builder", fieldTypes: ["boolean"] },
      ],
    },
  });
}
