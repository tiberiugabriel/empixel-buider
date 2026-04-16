import type { PluginDescriptor } from "emdash";

export function empixelBuilder(): PluginDescriptor {
  return {
    id: "empixel-builder",
    version: "0.1.0",
    format: "native",
    entrypoint: "empixel-builder/plugin",
    adminEntry: "empixel-builder/admin",
    componentsEntry: "empixel-builder/astro",
    adminPages: [
      {
        path: "editor",
        label: "Page Editor",
        icon: "layout",
      },
    ],
  };
}
