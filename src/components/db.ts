import { createRequire } from "node:module";
import { join } from "node:path";
import type { SectionBlock } from "../types.js";

const _require = createRequire(import.meta.url);
let _db: any = null;

function getDb() {
  if (_db) return _db;
  const Database = _require("better-sqlite3");
  _db = new Database(join(process.cwd(), "data.db"), { readonly: true });
  return _db;
}

export function getBuilderLayout(collection: string, entryId: string): SectionBlock[] | null {
  try {
    const row = getDb()
      .prepare("SELECT sections FROM empixel_builder_layouts WHERE collection = ? AND entry_id = ?")
      .get(collection, entryId) as { sections: string } | undefined;
    return row ? (JSON.parse(row.sections) as SectionBlock[]) : null;
  } catch {
    return null;
  }
}
