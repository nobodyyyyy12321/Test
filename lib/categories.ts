import { unstable_cache, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "./supabase-admin";
import type { CategoryNode } from "../app/components/CategoryNode";

export type { CategoryNode };

// Categories live in the `public` schema.
const CATEGORIES_SCHEMA = "public";
function getCategoriesAdmin() {
  return getSupabaseAdmin().schema(CATEGORIES_SCHEMA);
}

type DropdownItemRow = { id?: string; name: string; href: string };

type CategoryRow = {
  id: string;
  owner_id: string | null;
  parent_id: string | null;
  position: number;
  href: string | null;
  name: string;
  language: string | null;
  dropdown: DropdownItemRow[];
  dropdown_align: string | null;
  problems_per_test: number | null;
  shuffle_problems: boolean | null;
};

const ROW_COLUMNS = "id,owner_id,parent_id,position,href,name,language,dropdown,dropdown_align,problems_per_test,shuffle_problems";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function _fetchCategories(language: string): Promise<CategoryNode[]> {
  const supabase = getCategoriesAdmin();

  const { data, error } = await supabase
    .from("categories")
    .select(ROW_COLUMNS)
    .is("owner_id", null)
    .eq("language", language)
    .order("position", { ascending: true });
  if (error || !data) {
    console.error("[categories] fetch error:", {
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      code: error?.code,
      raw: error,
    });
    return [];
  }
  console.log("[categories] fetched rows:", data.length, "for language:", language);

  // Defensive guard: keep homepage/public tree strictly public-only.
  const rows = (data as CategoryRow[]).filter((r) => r.owner_id === null);
  const ids = new Set(rows.map(r => r.id));

  // Rows whose parent_id is not in our set are top-level (parent is the language root node)
  const childrenOf = new Map<string | null, CategoryRow[]>();
  for (const row of rows) {
    const parentKey = row.parent_id !== null && ids.has(row.parent_id) ? row.parent_id : null;
    const bucket = childrenOf.get(parentKey) ?? [];
    bucket.push(row);
    childrenOf.set(parentKey, bucket);
  }

  const buildNode = (row: CategoryRow): CategoryNode => {
    const node: CategoryNode = { id: row.id, name: row.name };
    if (row.href) node.href = row.href;
    if (row.dropdown_align) node.dropdownAlign = row.dropdown_align as "left" | "right";
    if (Array.isArray(row.dropdown) && row.dropdown.length > 0) {
      node.dropdown = row.dropdown.map(d => ({ id: d.id, name: d.name, href: d.href }));
    }
    if (row.problems_per_test !== null && row.problems_per_test !== undefined) node.problemsPerTest = row.problems_per_test;
    if (row.shuffle_problems !== null && row.shuffle_problems !== undefined) node.shuffleProblems = row.shuffle_problems;
    const kids = childrenOf.get(row.id);
    if (kids?.length) node.children = kids.map(buildNode);
    return node;
  };

  return (childrenOf.get(null) ?? []).map(buildNode);
}

export const getCategoriesCached = unstable_cache(
  _fetchCategories,
  ["categories"],
  { revalidate: 60, tags: ["categories"] }
);

// Flat (parent-id) shape for the admin editor — array order within the same parentId is the
// sibling order. parentId === null means "directly under the language root" (top level).
export type FlatCategory = {
  id?: string;                  // generated server-side if absent
  parentId: string | null;      // null = top-level
  name: string;
  href?: string | null;
  dropdown?: { id?: string; name: string; href: string }[];
  dropdownAlign?: "left" | "right" | null;
  problemsPerTest?: number | null;   // null/undef = no limit
  shuffleProblems?: boolean | null;  // null/undef = default (shuffle on)
};

async function _fetchCategoriesFlat(language: string): Promise<FlatCategory[]> {
  const supabase = getCategoriesAdmin();

  const { data, error } = await supabase
    .from("categories")
    .select(ROW_COLUMNS)
    .is("owner_id", null)
    .eq("language", language)
    .order("position", { ascending: true });
  if (error || !data) return [];

  // Defensive guard: keep admin public tree editor scoped to public rows only.
  const rows = (data as CategoryRow[]).filter((r) => r.owner_id === null);
  const ids = new Set(rows.map(r => r.id));

  return rows.map(r => ({
    id: r.id,
    // parent_id outside our set means the parent is the language root → treat as top-level
    parentId: r.parent_id !== null && ids.has(r.parent_id) ? r.parent_id : null,
    name: r.name,
    href: r.href,
    dropdown: Array.isArray(r.dropdown) && r.dropdown.length > 0
      ? r.dropdown.map(d => ({ id: d.id, name: d.name, href: d.href }))
      : undefined,
    dropdownAlign: (r.dropdown_align as "left" | "right" | null) ?? undefined,
    problemsPerTest: r.problems_per_test,
    shuffleProblems: r.shuffle_problems,
  }));
}

export const getCategoriesFlatCached = unstable_cache(
  _fetchCategoriesFlat,
  ["categories-flat"],
  { revalidate: 60, tags: ["categories"] }
);

type FlatNode = {
  id: string;
  parent_id: string | null;
  position: number;
  href: string | null;
  name: string;
  dropdown: { id: string; name: string; href: string }[];
  dropdown_align: string | null;
  problems_per_test: number | null;
  shuffle_problems: boolean | null;
};

function flattenTree(tree: CategoryNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: CategoryNode[], parentId: string | null) => {
    nodes.forEach((node, idx) => {
      const id = node.id ?? newId();
      out.push({
        id,
        parent_id: parentId,
        position: idx,
        href: node.href ?? null,
        name: node.name,
        dropdown: (node.dropdown ?? []).map(d => ({
          id: d.id ?? newId(),
          name: d.name,
          href: d.href,
        })),
        dropdown_align: node.dropdownAlign ?? null,
        problems_per_test: node.problemsPerTest ?? null,
        shuffle_problems: node.shuffleProblems ?? null,
      });
      if (node.children?.length) walk(node.children, id);
    });
  };
  walk(tree, null);
  return out;
}

// Replace all rows for the given language. Other languages' rows are untouched.
export async function replaceCategories(language: string, incoming: CategoryNode[]): Promise<void> {
  const supabase = getCategoriesAdmin();

  // Wipe all existing rows for this language
  const { error: delErr } = await supabase.from("categories").delete().is("owner_id", null).eq("language", language);
  if (delErr) throw new Error(`delete existing categories failed: ${delErr.message}`);

  const flat = flattenTree(incoming);
  if (flat.length === 0) {
    revalidateTag("categories");
    return;
  }

  // Insert parents-before-children (null parent = top-level, always ready first)
  const insertedIds = new Set<string>();
  let remaining = flat.slice();
  while (remaining.length > 0) {
    const ready = remaining.filter(r => r.parent_id === null || insertedIds.has(r.parent_id));
    if (ready.length === 0) throw new Error("circular or orphaned categories detected during upsert");
    const payload = ready.map(r => ({
      id: r.id,
      owner_id: null,
      parent_id: r.parent_id,
      position: r.position,
      href: r.href,
      name: r.name,
      language,
      dropdown: r.dropdown,
      dropdown_align: r.dropdown_align,
      problems_per_test: r.problems_per_test,
      shuffle_problems: r.shuffle_problems,
      updated_at: new Date().toISOString(),
    }));
    const { error: upErr } = await supabase.from("categories").insert(payload);
    if (upErr) throw new Error(`insert subtree failed: ${upErr.message}`);
    for (const r of ready) insertedIds.add(r.id);
    remaining = remaining.filter(r => !insertedIds.has(r.id));
  }

  revalidateTag("categories");
}

// Insert a single nav row at the end of the language root's children if no row already
// points at `href`; otherwise rename the existing row to `name`. Used by admin upload to
// surface a freshly-uploaded collection on the homepage without rewriting the whole tree.
export async function ensureTopLevelItem(opts: {
  language: string;
  name: string;
  href: string;
}): Promise<{ rowId: string; created: boolean }> {
  const { language, name, href } = opts;
  const supabase = getCategoriesAdmin();

  // Look for an existing top-level row with this href and language
  const { data: existing, error: findErr } = await supabase
    .from("categories")
    .select("id")
    .is("owner_id", null)
    .eq("language", language)
    .eq("href", href)
    .is("parent_id", null)
    .limit(1);
  if (findErr) throw new Error(`lookup existing nav row failed: ${findErr.message}`);

  if (existing && existing.length > 0) {
    const rowId = existing[0].id as string;
    const { error: updErr } = await supabase
      .from("categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", rowId);
    if (updErr) throw new Error(`update nav row failed: ${updErr.message}`);
    revalidateTag("categories");
    return { rowId, created: false };
  }

  // Append at the end: position = (max sibling position among top-level rows for this language) + 1
  const { data: siblings, error: sibErr } = await supabase
    .from("categories")
    .select("position")
    .is("owner_id", null)
    .eq("language", language)
    .is("parent_id", null)
    .order("position", { ascending: false })
    .limit(1);
  if (sibErr) throw new Error(`lookup sibling positions failed: ${sibErr.message}`);
  const nextPos = siblings && siblings.length > 0 ? (siblings[0].position as number) + 1 : 0;

  const rowId = newId();
  const { error: insErr } = await supabase.from("categories").insert({
    id: rowId,
    owner_id: null,
    parent_id: null,
    position: nextPos,
    href,
    name,
    language,
    dropdown: [],
    dropdown_align: null,
    updated_at: new Date().toISOString(),
  });
  if (insErr) throw new Error(`insert nav row failed: ${insErr.message}`);

  revalidateTag("categories");
  return { rowId, created: true };
}

// Replace the entire subtree for the given language using a flat parent-id list.
// Sibling order within each parentId is the array order in `items`.
export async function replaceCategoriesFlat(language: string, items: FlatCategory[]): Promise<void> {
  // Reject duplicate user-supplied ids up front
  const seenIds = new Set<string>();
  const dupIds = new Set<string>();
  for (const it of items) {
    if (!it.id) continue;
    if (seenIds.has(it.id)) dupIds.add(it.id);
    else seenIds.add(it.id);
  }
  if (dupIds.size > 0) {
    throw new Error(`重複的 id：${[...dupIds].join(", ")}`);
  }

  const supabase = getCategoriesAdmin();

  // Wipe all existing rows for this language
  const { error: delErr } = await supabase.from("categories").delete().is("owner_id", null).eq("language", language);
  if (delErr) throw new Error(`delete existing categories failed: ${delErr.message}`);

  // Assign ids to new items, compute per-parent position from array order
  const positionCounter = new Map<string | null, number>();
  type Prepared = {
    id: string; parent_id: string | null; position: number;
    href: string | null; name: string;
    dropdown: { id: string; name: string; href: string }[];
    dropdown_align: string | null;
    problems_per_test: number | null;
    shuffle_problems: boolean | null;
  };
  const prepared: Prepared[] = items.map(item => {
    const id = item.id ?? newId();
    const parentKey = item.parentId ?? null;
    const pos = positionCounter.get(parentKey) ?? 0;
    positionCounter.set(parentKey, pos + 1);
    return {
      id,
      parent_id: parentKey,
      position: pos,
      href: item.href ?? null,
      name: item.name,
      dropdown: (item.dropdown ?? []).map(d => ({
        id: d.id ?? newId(),
        name: d.name,
        href: d.href,
      })),
      dropdown_align: item.dropdownAlign ?? null,
      problems_per_test: item.problemsPerTest ?? null,
      shuffle_problems: item.shuffleProblems ?? null,
    };
  });

  if (prepared.length === 0) {
    revalidateTag("categories");
    return;
  }

  // Insert parents-before-children (null parent = top-level, always ready first)
  const insertedIds = new Set<string>();
  let remaining = prepared.slice();
  while (remaining.length > 0) {
    const ready = remaining.filter(r => r.parent_id === null || insertedIds.has(r.parent_id));
    if (ready.length === 0) {
      throw new Error("orphaned items detected (a parentId references an unknown id)");
    }
    const payload = ready.map(r => ({
      id: r.id,
      owner_id: null,
      parent_id: r.parent_id,
      position: r.position,
      href: r.href,
      name: r.name,
      language,
      dropdown: r.dropdown,
      dropdown_align: r.dropdown_align,
      problems_per_test: r.problems_per_test,
      shuffle_problems: r.shuffle_problems,
      updated_at: new Date().toISOString(),
    }));
    const { error: upErr } = await supabase.from("categories").insert(payload);
    if (upErr) throw new Error(`insert categories failed: ${upErr.message}`);
    for (const r of ready) insertedIds.add(r.id);
    remaining = remaining.filter(r => !insertedIds.has(r.id));
  }

  revalidateTag("categories");
}
