import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import type { SectionBlock } from "./types.js";

const LAYOUT_FIELD = "layout";
const KV_ENABLED = "settings:enabledCollections";

export function createPlugin(_options: Record<string, unknown> = {}) {
  return definePlugin({
    id: "empixel-builder",
    version: "0.1.0",
    capabilities: ["read:content", "write:content"],
    routes: {
      // GET  ?pageId=&collection=  → load layout
      // POST { pageId, collection, sections } → save layout
      layout: {
        handler: async (ctx) => {
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
            const entry = await ctx.content!.get(collection, pageId);
            const sections = entry?.data?.[LAYOUT_FIELD] ?? null;
            return { data: sections ? { sections, updatedAt: entry?.updatedAt } : null };
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
            // ctx.content is ContentAccessWithWrite when write:content capability is declared
            await (ctx.content as any).update(collection, pageId, { [LAYOUT_FIELD]: sections });
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },

      // GET → returns list of collections with builder enabled
      collections: {
        handler: async (ctx: PluginContext) => {
          const enabled = await ctx.kv.get<string[]>(KV_ENABLED) ?? [];
          return { data: enabled };
        },
      },

      // POST { collection, enabled } → toggle builder on/off for a collection
      settings: {
        handler: async (ctx: PluginContext) => {
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
        handler: async (ctx: PluginContext) => {
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
          const items = result.items.map((entry: any) => ({
            id: entry.id,
            title: entry.data?.title ?? entry.id,
          }));

          return { data: items, collection };
        },
      },
    },
    hooks: {},
    admin: {
      entry: "empixel-builder/admin",
      pages: [
        { path: "/editor", label: "EmPixel Builder" },
        { path: "/settings", label: "Settings" },
      ],
    },
  });
}
