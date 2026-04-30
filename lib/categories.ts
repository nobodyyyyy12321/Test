import { unstable_cache, revalidateTag } from "next/cache";
import { getSupabaseAdmin } from "./supabase-admin";
import type { CategoryNode } from "../app/components/CategoryNode";

export type { CategoryNode };

type DropdownItemRow = { id?: string; name: string; href: string };

type CategoryRow = {
  id: string;
  parent_id: string | null;
  position: number;
  href: string | null;
  name: string;
  language_code: string | null;
  dropdown: DropdownItemRow[];
  dropdown_align: string | null;
};

// Language label used when creating a new language root row on save (matches the admin tabs)
const LANG_LABELS: Record<string, string> = {
  "zh-TW": "繁中",
  "zh-CN": "簡中",
  "en":    "EN",
  "ko":    "KO",
  "es":    "ES",
  "th":    "TH",
  "id":    "ID",
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function _fetchCategories(language: string): Promise<CategoryNode[]> {
  const supabase = getSupabaseAdmin();

  const { data: rootRows, error: rootErr } = await supabase
    .from("categories")
    .select("id")
    .eq("language_code", language)
    .limit(1);
  if (rootErr || !rootRows || rootRows.length === 0) return [];
  const rootId = rootRows[0].id as string;

  // Pull all rows once and build the subtree under rootId in JS.
  // Categories are small (a few hundred rows at most) so this is fine.
  const { data, error } = await supabase
    .from("categories")
    .select("id,parent_id,position,href,name,language_code,dropdown,dropdown_align")
    .order("position", { ascending: true });
  if (error || !data) return [];

  const rows = data as CategoryRow[];
  const childrenOf = new Map<string | null, CategoryRow[]>();
  for (const row of rows) {
    const bucket = childrenOf.get(row.parent_id) ?? [];
    bucket.push(row);
    childrenOf.set(row.parent_id, bucket);
  }

  const buildNode = (row: CategoryRow): CategoryNode => {
    const node: CategoryNode = { id: row.id, name: row.name };
    if (row.href) node.href = row.href;
    if (row.dropdown_align) node.dropdownAlign = row.dropdown_align as "left" | "right";
    if (Array.isArray(row.dropdown) && row.dropdown.length > 0) {
      node.dropdown = row.dropdown.map(d => ({ id: d.id, name: d.name, href: d.href }));
    }
    const kids = childrenOf.get(row.id);
    if (kids?.length) node.children = kids.map(buildNode);
    return node;
  };

  const topChildren = childrenOf.get(rootId) ?? [];
  return topChildren.map(buildNode);
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
};

async function _fetchCategoriesFlat(language: string): Promise<FlatCategory[]> {
  const supabase = getSupabaseAdmin();

  const { data: rootRows, error: rootErr } = await supabase
    .from("categories")
    .select("id")
    .eq("language_code", language)
    .limit(1);
  if (rootErr || !rootRows || rootRows.length === 0) return [];
  const rootId = rootRows[0].id as string;

  const { data, error } = await supabase
    .from("categories")
    .select("id,parent_id,position,href,name,dropdown,dropdown_align")
    .order("position", { ascending: true });
  if (error || !data) return [];

  const rows = data as CategoryRow[];

  // Determine which rows belong to this language by walking down from rootId.
  const childrenOf = new Map<string | null, CategoryRow[]>();
  for (const row of rows) {
    const bucket = childrenOf.get(row.parent_id) ?? [];
    bucket.push(row);
    childrenOf.set(row.parent_id, bucket);
  }
  const ordered: CategoryRow[] = [];
  const walk = (parentId: string) => {
    for (const r of childrenOf.get(parentId) ?? []) {
      ordered.push(r);
      walk(r.id);
    }
  };
  walk(rootId);

  return ordered.map(r => ({
    id: r.id,
    parentId: r.parent_id === rootId ? null : r.parent_id,
    name: r.name,
    href: r.href,
    dropdown: Array.isArray(r.dropdown) && r.dropdown.length > 0
      ? r.dropdown.map(d => ({ id: d.id, name: d.name, href: d.href }))
      : undefined,
    dropdownAlign: (r.dropdown_align as "left" | "right" | null) ?? undefined,
  }));
}

export const getCategoriesFlatCached = unstable_cache(
  _fetchCategoriesFlat,
  ["categories-flat"],
  { revalidate: 60, tags: ["categories"] }
);

type FlatNode = {
  id: string;
  parent_id: string;
  position: number;
  href: string | null;
  name: string;
  dropdown: { id: string; name: string; href: string }[];
  dropdown_align: string | null;
};

function flattenTree(tree: CategoryNode[], rootId: string): FlatNode[] {
  const out: FlatNode[] = [];
  const walk = (nodes: CategoryNode[], parentId: string) => {
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
      });
      if (node.children?.length) walk(node.children, id);
    });
  };
  walk(tree, rootId);
  return out;
}

// Replace the entire subtree for the given language. Other languages' rows are untouched.
export async function replaceCategories(language: string, incoming: CategoryNode[]): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Find or create the language root row
  let rootId: string;
  const { data: existingRoot, error: rootErr } = await supabase
    .from("categories")
    .select("id")
    .eq("language_code", language)
    .limit(1);
  if (rootErr) throw new Error(`fetch language root failed: ${rootErr.message}`);

  if (existingRoot && existingRoot.length > 0) {
    rootId = existingRoot[0].id as string;
    // Wipe existing subtree (cascade deletes descendants)
    const { data: directKids, error: kidsErr } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", rootId);
    if (kidsErr) throw new Error(`fetch existing children failed: ${kidsErr.message}`);
    const kidIds = (directKids ?? []).map(k => k.id as string);
    if (kidIds.length > 0) {
      const { error: delErr } = await supabase.from("categories").delete().in("id", kidIds);
      if (delErr) throw new Error(`delete existing subtree failed: ${delErr.message}`);
    }
  } else {
    rootId = newId();
    const { error: insErr } = await supabase.from("categories").insert({
      id: rootId,
      parent_id: null,
      position: 0,
      href: null,
      name: LANG_LABELS[language] ?? language,
      language_code: language,
      dropdown: [],
      dropdown_align: null,
      updated_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(`create language root failed: ${insErr.message}`);
  }

  // Insert new subtree, parents-before-children
  const flat = flattenTree(incoming, rootId);
  if (flat.length === 0) {
    revalidateTag("categories");
    return;
  }

  const inserted = new Set<string>([rootId]);
  let remaining = flat.slice();
  while (remaining.length > 0) {
    const ready = remaining.filter(r => inserted.has(r.parent_id));
    if (ready.length === 0) throw new Error("circular or orphaned categories detected during upsert");
    const payload = ready.map(r => ({
      id: r.id,
      parent_id: r.parent_id,
      position: r.position,
      href: r.href,
      name: r.name,
      language_code: null,
      dropdown: r.dropdown,
      dropdown_align: r.dropdown_align,
      updated_at: new Date().toISOString(),
    }));
    const { error: upErr } = await supabase.from("categories").insert(payload);
    if (upErr) throw new Error(`insert subtree failed: ${upErr.message}`);
    for (const r of ready) inserted.add(r.id);
    remaining = remaining.filter(r => !inserted.has(r.id));
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
  const supabase = getSupabaseAdmin();

  // Find or create the language root
  let rootId: string;
  const { data: rootRows, error: rootErr } = await supabase
    .from("categories")
    .select("id")
    .eq("language_code", language)
    .limit(1);
  if (rootErr) throw new Error(`fetch language root failed: ${rootErr.message}`);

  if (rootRows && rootRows.length > 0) {
    rootId = rootRows[0].id as string;
  } else {
    rootId = newId();
    const { error: insErr } = await supabase.from("categories").insert({
      id: rootId,
      parent_id: null,
      position: 0,
      href: null,
      name: LANG_LABELS[language] ?? language,
      language_code: language,
      dropdown: [],
      dropdown_align: null,
      updated_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(`create language root failed: ${insErr.message}`);
  }

  // Look for an existing direct child with this href
  const { data: existing, error: findErr } = await supabase
    .from("categories")
    .select("id,position")
    .eq("parent_id", rootId)
    .eq("href", href)
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

  // Append at the end: position = (max sibling position) + 1
  const { data: siblings, error: sibErr } = await supabase
    .from("categories")
    .select("position")
    .eq("parent_id", rootId)
    .order("position", { ascending: false })
    .limit(1);
  if (sibErr) throw new Error(`lookup sibling positions failed: ${sibErr.message}`);
  const nextPos = siblings && siblings.length > 0 ? (siblings[0].position as number) + 1 : 0;

  const rowId = newId();
  const { error: insErr } = await supabase.from("categories").insert({
    id: rowId,
    parent_id: rootId,
    position: nextPos,
    href,
    name,
    language_code: null,
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
  // Reject duplicate user-supplied ids up front — the FK upsert would silently merge them.
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

  const supabase = getSupabaseAdmin();

  // Find or create the language root row
  let rootId: string;
  const { data: existingRoot, error: rootErr } = await supabase
    .from("categories")
    .select("id")
    .eq("language_code", language)
    .limit(1);
  if (rootErr) throw new Error(`fetch language root failed: ${rootErr.message}`);

  if (existingRoot && existingRoot.length > 0) {
    rootId = existingRoot[0].id as string;
    const { data: directKids, error: kidsErr } = await supabase
      .from("categories")
      .select("id")
      .eq("parent_id", rootId);
    if (kidsErr) throw new Error(`fetch existing children failed: ${kidsErr.message}`);
    const kidIds = (directKids ?? []).map(k => k.id as string);
    if (kidIds.length > 0) {
      const { error: delErr } = await supabase.from("categories").delete().in("id", kidIds);
      if (delErr) throw new Error(`delete existing subtree failed: ${delErr.message}`);
    }
  } else {
    rootId = newId();
    const { error: insErr } = await supabase.from("categories").insert({
      id: rootId,
      parent_id: null,
      position: 0,
      href: null,
      name: LANG_LABELS[language] ?? language,
      language_code: language,
      dropdown: [],
      dropdown_align: null,
      updated_at: new Date().toISOString(),
    });
    if (insErr) throw new Error(`create language root failed: ${insErr.message}`);
  }

  // Assign ids to new items, compute per-parent position from array order
  const idByOldRef = new Map<string, string>(); // user-supplied id → final id (usually identical)
  const positionCounter = new Map<string | null, number>();
  type Prepared = {
    id: string; parent_id: string; position: number;
    href: string | null; name: string;
    dropdown: { id: string; name: string; href: string }[];
    dropdown_align: string | null;
  };
  const prepared: Prepared[] = items.map(item => {
    const id = item.id ?? newId();
    if (item.id) idByOldRef.set(item.id, id);
    const pos = positionCounter.get(item.parentId ?? null) ?? 0;
    positionCounter.set(item.parentId ?? null, pos + 1);
    return {
      id,
      parent_id: item.parentId === null || item.parentId === undefined ? rootId : item.parentId,
      position: pos,
      href: item.href ?? null,
      name: item.name,
      dropdown: (item.dropdown ?? []).map(d => ({
        id: d.id ?? newId(),
        name: d.name,
        href: d.href,
      })),
      dropdown_align: item.dropdownAlign ?? null,
    };
  });

  if (prepared.length === 0) {
    revalidateTag("categories");
    return;
  }

  // Insert parents-before-children
  const inserted = new Set<string>([rootId]);
  let remaining = prepared.slice();
  while (remaining.length > 0) {
    const ready = remaining.filter(r => inserted.has(r.parent_id));
    if (ready.length === 0) {
      throw new Error("orphaned items detected (a parentId references an unknown id)");
    }
    const payload = ready.map(r => ({
      id: r.id,
      parent_id: r.parent_id,
      position: r.position,
      href: r.href,
      name: r.name,
      language_code: null,
      dropdown: r.dropdown,
      dropdown_align: r.dropdown_align,
      updated_at: new Date().toISOString(),
    }));
    const { error: upErr } = await supabase.from("categories").insert(payload);
    if (upErr) throw new Error(`insert categories failed: ${upErr.message}`);
    for (const r of ready) inserted.add(r.id);
    remaining = remaining.filter(r => !inserted.has(r.id));
  }

  revalidateTag("categories");
}
