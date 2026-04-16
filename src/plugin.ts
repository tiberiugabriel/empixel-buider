import { definePlugin } from "emdash";
import { z } from "zod";
import type { PageLayout } from "./types.js";

export function createPlugin(_options: Record<string, unknown> = {}) {
  return definePlugin({
    id: "empixel-builder",
    version: "0.1.0",
    capabilities: [],
    storage: {
      layouts: {
        indexes: [],
      },
    },
    routes: {
      layout: {
        input: z.object({
          pageId: z.string().optional(),
          sections: z.array(z.record(z.unknown())).optional(),
        }),
        handler: async (ctx) => {
          const method = ctx.request.method;
          const { pageId, sections } = ctx.input;

          if (method === "GET") {
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
            if (!pageId || !sections) {
              return new Response(JSON.stringify({ error: { message: "pageId and sections are required" } }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
            const layoutData: PageLayout = {
              sections: sections as PageLayout["sections"],
              updatedAt: new Date().toISOString(),
            };
            await ctx.storage.layouts.put(pageId, layoutData);
            return { success: true };
          }

          return new Response("Method Not Allowed", { status: 405 });
        },
      },
    },
    hooks: {},
    admin: {
      entry: "empixel-builder/admin",
      pages: [
        {
          path: "editor",
          label: "Page Editor",
        },
      ],
    },
  });
}
