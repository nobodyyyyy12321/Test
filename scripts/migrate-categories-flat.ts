// One-time data migration: read `categories_old` (one row per language with `data` JSONB tree)
// and populate the new flat `categories` table where each language is a top-level folder
// and the rest of that language's tree nests beneath it.
//
// Run AFTER scripts/migrate-categories-flat.sql has been applied.
//   npx tsx scripts/migrate-categories-flat.ts

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

// Minimal .env.local loader — avoids adding a dotenv dependency
function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_TEST_SUPABASE_URL or TEST_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Language root display names (same labels used in the admin tabs)
const LANG_LABELS: Record<string, string> = {
  "zh-TW": "繁中",
  "zh-CN": "簡中",
  "en":    "EN",
  "ko":    "KO",
  "es":    "ES",
  "th":    "TH",
  "id":    "ID",
};

type LegacyCategoryNode = {
  name: string;
  href?: string;
  children?: LegacyCategoryNode[];
  dropdown?: { name: string; href: string }[];
  dropdownAlign?: "left" | "right";
};

type FlatRow = {
  id: string;
  parent_id: string | null;
  position: number;
  href: string | null;
  name: string;
  language_code: string | null;
  dropdown: { id: string; name: string; href: string }[];
  dropdown_align: string | null;
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function flatten(tree: LegacyCategoryNode[], parentId: string, out: FlatRow[]): void {
  tree.forEach((node, idx) => {
    const id = newId();
    out.push({
      id,
      parent_id: parentId,
      position: idx,
      href: node.href ?? null,
      name: node.name,
      language_code: null,
      dropdown: (node.dropdown ?? []).map(d => ({
        id: newId(),
        name: d.name,
        href: d.href,
      })),
      dropdown_align: node.dropdownAlign ?? null,
    });
    if (node.children?.length) flatten(node.children, id, out);
  });
}

async function main() {
  const { data: oldRows, error: oldErr } = await supabase
    .from("categories_old")
    .select("language,data");
  if (oldErr) throw new Error(`failed to read categories_old: ${oldErr.message}`);

  const langRows = (oldRows ?? []) as { language: string; data: LegacyCategoryNode[] }[];
  if (langRows.length === 0) {
    console.log("No rows found in categories_old — nothing to migrate.");
    return;
  }

  const allRows: FlatRow[] = [];
  for (const row of langRows) {
    const rootId = newId();
    allRows.push({
      id: rootId,
      parent_id: null,
      position: 0,
      href: null,
      name: LANG_LABELS[row.language] ?? row.language,
      language_code: row.language,
      dropdown: [],
      dropdown_align: null,
    });
    if (Array.isArray(row.data)) flatten(row.data, rootId, allRows);
  }

  console.log(`Prepared ${allRows.length} rows from ${langRows.length} languages.`);

  // Insert parents before children
  const inserted = new Set<string>();
  let remaining = allRows.slice();
  while (remaining.length > 0) {
    const ready = remaining.filter(r => r.parent_id === null || inserted.has(r.parent_id));
    if (ready.length === 0) throw new Error("orphaned rows detected during insert");
    const payload = ready.map(r => ({ ...r, updated_at: new Date().toISOString() }));
    const { error: insErr } = await supabase.from("categories").upsert(payload, { onConflict: "id" });
    if (insErr) throw new Error(`insert failed: ${insErr.message}`);
    for (const r of ready) inserted.add(r.id);
    remaining = remaining.filter(r => !inserted.has(r.id));
    console.log(`Inserted ${inserted.size}/${allRows.length}`);
  }
  console.log("Migration complete.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
