import type { PluginDescriptor } from "emdash";

export function empixelBuilder(): PluginDescriptor {
  return {
    id: "empixel-builder",
    version: "0.7.1",
    format: "native",
    entrypoint: "empixel-builder/plugin",
    adminEntry: "empixel-builder/admin",
    componentsEntry: "empixel-builder/astro",
    capabilities: ["content:read"],
    adminPages: [
      {
        path: "/editor",
        label: "EmPixel Builder",
        icon: "layout",
      },
    ],
  };
}
