import { definePlugin } from "emdash";
import type { PageLayout, SectionBlock } from "./types.js";

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
        // No input schema — GET reads from query params, POST reads from body
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
    },
    hooks: {
      "admin:menu:register": (menu) => {
        menu.addItem({
          id: "empixel-btn",
          label: "Open Pixel Editor",
          action: "/editor"
        });
      }
    },
    admin: {
      entry: "empixel-builder/admin",
      navigation: [
        {
          label: "Pixel Builder",
          icon: "layout",
          path: "/editor",
        }
      ],
      pages: [
        {
          path: "editor",
          label: "Page Editor",
          layout: "fullscreen"
        },
      ],
    },
  });
}
