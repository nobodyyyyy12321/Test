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
  position: number;
  href: string | null;
  name: string;
  language: string | null;
  dropdown: DropdownItemRow[];
  dropdown_align: string | null;
  problems_per_test: number | null;
  shuffle_problems: boolean | null;
  approval_status?: string | null;
  is_public?: boolean | null;
};

// Try to include approval_status if it exists, fall back to without it
const ROW_COLUMNS = "id,owner_id,position,name,language,dropdown,dropdown_align,problems_per_test,shuffle_problems,approval_status,is_public";
const ROW_COLUMNS_FALLBACK = "id,owner_id,position,name,language,dropdown,dropdown_align,problems_per_test,shuffle_problems,is_public";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function _fetchCategories(language: string): Promise<CategoryNode[]> {
  const supabase = getCategoriesAdmin();

  const query = supabase
    .from("qsets")
    .select(ROW_COLUMNS)
    .eq("language", language);
  
  // Fetch public categories only and filter by approval_status
  let { data, error } = await query.order("position", { ascending: true });
  
  // If approval_status column doesn't exist, retry without it
  if (error?.code === "42703") {
    const fallbackQuery = supabase
      .from("qsets")
      .select(ROW_COLUMNS_FALLBACK)
      .is("owner_id", null)
      .eq("language", language);
    const result = await fallbackQuery.order("position", { ascending: true });
    data = result.data as any;
    error = result.error;
  }
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

  // Public categories (built-in or shared) that are approved or null status.
  const rows = (data as CategoryRow[]).filter((r) => (r.owner_id === null || r.is_public === true) && (r.approval_status === "approved" || r.approval_status === null));

  const buildNode = (row: CategoryRow): CategoryNode => {
    const node: CategoryNode = { id: row.id, name: row.name };
    if (row.href) node.href = row.href;
    if (row.dropdown_align) node.dropdownAlign = row.dropdown_align as "left" | "right";
    if (Array.isArray(row.dropdown) && row.dropdown.length > 0) {
      node.dropdown = row.dropdown.map(d => ({ id: d.id, name: d.name, href: d.href }));
    }
    if (row.problems_per_test !== null && row.problems_per_test !== undefined) node.problemsPerTest = row.problems_per_test;
    if (row.shuffle_problems !== null && row.shuffle_problems !== undefined) node.shuffleProblems = row.shuffle_problems;
    return node;
  };

  return rows.map(buildNode);
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
  shuffleProblems?: boolean | null;  // null/undef = default (ordered); true = shuffle
};

async function _fetchCategoriesFlat(language: string): Promise<FlatCategory[]> {
  const supabase = getCategoriesAdmin();

  const query = supabase
    .from("qsets")
    .select(ROW_COLUMNS)
    .eq("language", language);
  
  let { data, error } = await query.order("position", { ascending: true });
  
  // If approval_status column doesn't exist, retry without it
  if (error?.code === "42703") {
    const fallbackQuery = supabase
      .from("qsets")
      .select(ROW_COLUMNS_FALLBACK)
      .is("owner_id", null)
      .eq("language", language);
    const result = await fallbackQuery.order("position", { ascending: true });
    data = result.data as any;
    error = result.error;
  }

  if (error || !data) return [];

  // Public categories (built-in or shared) that are approved or null status.
  const rows = (data as CategoryRow[]).filter((r) => (r.owner_id === null || r.is_public === true) && (r.approval_status === "approved" || r.approval_status === null));

  return rows.map(r => ({
    id: r.id,
    parentId: null,
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
  position: number;
  href: string | null;
  name: string;
  dropdown: { id: string; name: string; href: string }[];
  dropdown_align: string | null;
  problems_per_test: number | null;
  shuffle_problems: boolean | null;
};

// Tree input gets hoisted to a flat list (subtree members are appended after parents).
function flattenTree(tree: CategoryNode[]): FlatNode[] {
  const out: FlatNode[] = [];
  let position = 0;
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      out.push({
        id: node.id ?? newId(),
        position: position++,
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
      if (node.children?.length) walk(node.children);
    }
  };
  walk(tree);
  return out;
}

// Replace all rows for the given language. Other languages' rows are untouched.
export async function replaceCategories(language: string, incoming: CategoryNode[]): Promise<void> {
  const supabase = getCategoriesAdmin();

  // Wipe all existing rows for this language
  const { error: delErr } = await supabase.from("qsets").delete().is("owner_id", null).eq("language", language);
  if (delErr) throw new Error(`delete existing categories failed: ${delErr.message}`);

  const flat = flattenTree(incoming);
  if (flat.length === 0) {
    revalidateTag("categories");
    return;
  }

  const payload = flat.map(r => ({
    id: r.id,
    owner_id: null,
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
  const { error: upErr } = await supabase.from("qsets").insert(payload);
  if (upErr) throw new Error(`insert categories failed: ${upErr.message}`);

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

  // Look for an existing row with this href and language
  const { data: existing, error: findErr } = await supabase
    .from("qsets")
    .select("id")
    .is("owner_id", null)
    .eq("language", language)
    .eq("href", href)
    .limit(1);
  if (findErr) throw new Error(`lookup existing nav row failed: ${findErr.message}`);

  if (existing && existing.length > 0) {
    const rowId = existing[0].id as string;
    const { error: updErr } = await supabase
      .from("qsets")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", rowId);
    if (updErr) throw new Error(`update nav row failed: ${updErr.message}`);
    revalidateTag("categories");
    return { rowId, created: false };
  }

  // Append at the end: position = (max position for this language) + 1
  const { data: siblings, error: sibErr } = await supabase
    .from("qsets")
    .select("position")
    .is("owner_id", null)
    .eq("language", language)
    .order("position", { ascending: false })
    .limit(1);
  if (sibErr) throw new Error(`lookup sibling positions failed: ${sibErr.message}`);
  const nextPos = siblings && siblings.length > 0 ? (siblings[0].position as number) + 1 : 0;

  const rowId = newId();
  const { error: insErr } = await supabase.from("qsets").insert({
    id: rowId,
    owner_id: null,
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
  const { error: delErr } = await supabase.from("qsets").delete().is("owner_id", null).eq("language", language);
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
    const { error: upErr } = await supabase.from("qsets").insert(payload);
    if (upErr) throw new Error(`insert categories failed: ${upErr.message}`);
    for (const r of ready) insertedIds.add(r.id);
    remaining = remaining.filter(r => !insertedIds.has(r.id));
  }

  revalidateTag("categories");
}
