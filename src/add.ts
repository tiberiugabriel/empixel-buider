#!/usr/bin/env node
/**
 * npx empixel-builder add
 *
 * Adds empixel-builder to the emdash plugins array in astro.config.mjs.
 */

import fs from "node:fs";
import path from "node:path";

const CONFIG_FILE = "astro.config.mjs";

function findConfig(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, CONFIG_FILE);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function alreadyRegistered(src: string): boolean {
  return src.includes("empixel-builder") && src.includes("empixelBuilder");
}

function addImport(src: string): string {
  if (src.includes('from "empixel-builder"') || src.includes("from 'empixel-builder'")) {
    return src;
  }
  // Insert after the last import line
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  const insertAt = lastImportIdx >= 0 ? lastImportIdx + 1 : 0;
  lines.splice(insertAt, 0, 'import { empixelBuilder } from "empixel-builder";');
  return lines.join("\n");
}

function addPlugin(src: string): string {
  // Match `plugins: [...]` and append empixelBuilder()
  return src.replace(
    /plugins:\s*\[([^\]]*)\]/,
    (match, inner) => {
      const trimmed = inner.trim();
      const separator = trimmed.length > 0 ? ", " : "";
      return `plugins: [${trimmed}${separator}empixelBuilder()]`;
    }
  );
}

const configPath = findConfig();

if (!configPath) {
  console.error(`Could not find ${CONFIG_FILE}. Run this command from your Astro project root.`);
  process.exit(1);
}

let src = fs.readFileSync(configPath, "utf-8");

if (alreadyRegistered(src)) {
  console.log("empixel-builder is already registered in astro.config.mjs.");
  process.exit(0);
}

if (!src.includes("plugins:")) {
  console.error(
    "Could not find a plugins: [] array in astro.config.mjs.\n" +
    "Make sure you have emdash({ plugins: [] }) configured, then run this command again."
  );
  process.exit(1);
}

src = addImport(src);
src = addPlugin(src);

fs.writeFileSync(configPath, src, "utf-8");

console.log(`\nDone! empixel-builder added to ${configPath}`);
console.log("Restart your dev server to apply the changes.\n");
