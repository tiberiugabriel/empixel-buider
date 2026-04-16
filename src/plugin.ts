import { definePlugin } from "emdash";
import type { PluginContext } from "emdash";
import type { PageLayout, SectionBlock } from "./types.js";

export function createPlugin(_options: Record<string, unknown> = {}) {
  return definePlugin({
    id: "empixel-builder",
    version: "0.1.0",
    capabilities: ["read:content"],
    storage: {
      layouts: {
        indexes: [],
      },
    },
    routes: {
      // GET  ?pageId=  → load layout
      // POST { pageId, sections } → save layout
      layout: {
        handler: async (ctx) => {
          const method = ctx.request.method;

          if (method === "GET") {
            const url = new URL(ctx.request.url);
            const pageId = url.searchParams.get("pageId");
            if (!pageId) {
              return new Response(JSON.stringify({ error: { message: "pageId is required" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
            const layout = await ctx.storage.layouts.get(pageId);
            return { data: layout };
          }

          if (method === "POST") {
            const body = ctx.input as { pageId?: string; sections?: SectionBlock[] } | undefined;
            const pageId = body?.pageId;
            const sections = body?.sections;
            if (!pageId || !sections) {
              return new Response(JSON.stringify({ error: { message: "pageId and sections are required" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
            const layoutData: PageLayout = {
              sections,
              updatedAt: new Date().toISOString(),
            };
            await ctx.storage.layouts.put(pageId, layoutData);
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },

      // GET ?collection=pages&limit=50 → list entries for page selector
      entries: {
        handler: async (ctx: PluginContext) => {
          const url = new URL(ctx.request.url);
          const collection = url.searchParams.get("collection") ?? "pages";
          const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "100", 10), 200);

          if (!ctx.content) {
            return new Response(JSON.stringify({ error: { message: "read:content capability required" } }), {
              status: 500,
              headers: { "Content-Type": "application/json" },
            });
          }

          const result = await ctx.content.list({ collection, limit });

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
        {
          path: "/editor",
          label: "Page Editor",
        },
      ],
    },
  });
}
