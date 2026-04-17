#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const CONFIG_FILE = "astro.config.mjs";
const _require = createRequire(import.meta.url);

function findConfig() {
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

function alreadyRegistered(src) {
  return src.includes("empixel-builder") && src.includes("empixelBuilder");
}

function addImport(src) {
  if (src.includes('from "empixel-builder"') || src.includes("from 'empixel-builder'")) {
    return src;
  }
  const lines = src.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImportIdx = i;
  }
  const insertAt = lastImportIdx >= 0 ? lastImportIdx + 1 : 0;
  lines.splice(insertAt, 0, 'import { empixelBuilder } from "empixel-builder";');
  return lines.join("\n");
}

function addPlugin(src) {
  return src.replace(
    /plugins:\s*\[([^\]]*)\]/,
    (match, inner) => {
      const trimmed = inner.trim();
      const separator = trimmed.length > 0 ? ", " : "";
      return `plugins: [${trimmed}${separator}empixelBuilder()]`;
    }
  );
}

function createTable(dbPath) {
  try {
    const Database = _require("better-sqlite3");
    const db = new Database(dbPath);
    db.exec(`
      CREATE TABLE IF NOT EXISTS empixel_builder_layouts (
        collection TEXT NOT NULL,
        entry_id   TEXT NOT NULL,
        sections   TEXT NOT NULL DEFAULT '[]',
        created_at TEXT DEFAULT (current_timestamp),
        updated_at TEXT DEFAULT (current_timestamp),
        PRIMARY KEY (collection, entry_id)
      )
    `);
    db.close();
    return true;
  } catch (e) {
    return false;
  }
}

// ── Register plugin in astro.config.mjs ──────────────────────────────────────

const configPath = findConfig();

if (!configPath) {
  console.error(`Could not find ${CONFIG_FILE}. Run this command from your Astro project root.`);
  process.exit(1);
}

let src = fs.readFileSync(configPath, "utf-8");

if (alreadyRegistered(src)) {
  console.log("empixel-builder is already registered in astro.config.mjs.");
} else {
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
  console.log(`\n✓ empixel-builder added to ${configPath}`);
}

// ── Create empixel_builder_layouts table in data.db ──────────────────────────

const dbPath = path.join(path.dirname(configPath), "data.db");

if (!fs.existsSync(dbPath)) {
  console.log("⚠  data.db not found — run `npx emdash dev` first to initialize the database,");
  console.log("   then run `npx empixel-builder add` again to create the layouts table.\n");
  console.log("The table will also be created automatically on first server start.\n");
} else {
  const ok = createTable(dbPath);
  if (ok) {
    console.log("✓ empixel_builder_layouts table ready in data.db");
  } else {
    console.log("⚠  Could not create table in data.db (will be created automatically on first start).");
  }
}

console.log("\nRestart your dev server to apply the changes.\n");
