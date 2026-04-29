// Required migration:
//   ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_tree jsonb
//     NOT NULL DEFAULT '{"folders":[],"categoryRefs":[],"leafPlacement":{"list":{},"collection":{}}}'::jsonb;
import { getSupabaseAdmin } from "./supabase-admin";

export type Folder = {
  id: string;
  name: string;
  parentId: string | null;
  sort: number;
};

export type CategoryRef = {
  id: string;
  key: string;          // e.g. "english-4" or "math-5:2" (collectionId[:levels])
  name: string;
  folderId: string | null;
  sort: number;
};

export type LeafPlacement = {
  folderId: string | null;
  sort: number;
};

export type PersonalTree = {
  folders: Folder[];
  categoryRefs: CategoryRef[];
  leafPlacement: {
    list: Record<string, LeafPlacement>;
    collection: Record<string, LeafPlacement>;
  };
};

export const EMPTY_TREE: PersonalTree = {
  folders: [],
  categoryRefs: [],
  leafPlacement: { list: {}, collection: {} },
};

function normalize(raw: unknown): PersonalTree {
  if (!raw || typeof raw !== "object") return EMPTY_TREE;
  const o = raw as Record<string, unknown>;
  const folders = Array.isArray(o.folders) ? (o.folders as Folder[]) : [];
  const categoryRefs = Array.isArray(o.categoryRefs) ? (o.categoryRefs as CategoryRef[]) : [];
  const lp = (o.leafPlacement && typeof o.leafPlacement === "object") ? o.leafPlacement as Record<string, unknown> : {};
  const list = (lp.list && typeof lp.list === "object") ? lp.list as Record<string, LeafPlacement> : {};
  const collection = (lp.collection && typeof lp.collection === "object") ? lp.collection as Record<string, LeafPlacement> : {};
  return { folders, categoryRefs, leafPlacement: { list, collection } };
}

export async function getPersonalTree(userId: string): Promise<PersonalTree> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from("users").select("personal_tree").eq("id", userId).maybeSingle();
  if (error) {
    // schema cache miss for the column → migration not applied yet
    if (error.message?.includes("personal_tree")) {
      console.warn(
        "[personal-tree] missing column. Run this migration in Supabase SQL editor:\n" +
        "  ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_tree jsonb NOT NULL DEFAULT '{\"folders\":[],\"categoryRefs\":[],\"leafPlacement\":{\"list\":{},\"collection\":{}}}'::jsonb;"
      );
      return EMPTY_TREE;
    }
    throw new Error(error.message);
  }
  return normalize(data?.personal_tree);
}

export async function setPersonalTree(userId: string, tree: PersonalTree): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("users").update({ personal_tree: tree }).eq("id", userId);
  if (error) {
    if (error.message?.includes("personal_tree")) {
      throw new Error(
        "users.personal_tree 欄位不存在。請在 Supabase SQL editor 跑：\n" +
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_tree jsonb NOT NULL DEFAULT '{\"folders\":[],\"categoryRefs\":[],\"leafPlacement\":{\"list\":{},\"collection\":{}}}'::jsonb;"
      );
    }
    throw new Error(error.message);
  }
}

function genId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// Returns the existing ref if key already present, else inserts a new one.
export function upsertCategoryRef(
  tree: PersonalTree,
  input: { key: string; name: string; folderId?: string | null }
): { tree: PersonalTree; ref: CategoryRef; created: boolean } {
  const existing = tree.categoryRefs.find(r => r.key === input.key);
  if (existing) return { tree, ref: existing, created: false };

  const siblings = tree.categoryRefs.filter(r => (r.folderId ?? null) === (input.folderId ?? null));
  const sort = siblings.reduce((m, r) => Math.max(m, r.sort), -1) + 1;

  const ref: CategoryRef = {
    id: genId("cr"),
    key: input.key,
    name: input.name,
    folderId: input.folderId ?? null,
    sort,
  };
  return {
    tree: { ...tree, categoryRefs: [...tree.categoryRefs, ref] },
    ref,
    created: true,
  };
}

export function removeCategoryRef(tree: PersonalTree, refId: string): PersonalTree {
  return { ...tree, categoryRefs: tree.categoryRefs.filter(r => r.id !== refId) };
}

// ── folders ───────────────────────────────────────────────────────────────────

export function addFolder(
  tree: PersonalTree,
  input: { name: string; parentId?: string | null }
): { tree: PersonalTree; folder: Folder } {
  const parentId = input.parentId ?? null;
  const siblings = tree.folders.filter(f => (f.parentId ?? null) === parentId);
  const sort = siblings.reduce((m, f) => Math.max(m, f.sort), -1) + 1;
  const folder: Folder = {
    id: genId("fd"),
    name: input.name,
    parentId,
    sort,
  };
  return { tree: { ...tree, folders: [...tree.folders, folder] }, folder };
}

export function renameFolder(tree: PersonalTree, id: string, name: string): PersonalTree {
  return { ...tree, folders: tree.folders.map(f => f.id === id ? { ...f, name } : f) };
}

export function moveFolder(tree: PersonalTree, id: string, parentId: string | null): PersonalTree {
  if (id === parentId) return tree;
  // prevent moving a folder into one of its own descendants
  const descendants = new Set<string>();
  const collect = (fid: string) => {
    for (const f of tree.folders) {
      if (f.parentId === fid && !descendants.has(f.id)) {
        descendants.add(f.id);
        collect(f.id);
      }
    }
  };
  collect(id);
  if (parentId && (descendants.has(parentId) || parentId === id)) return tree;
  return { ...tree, folders: tree.folders.map(f => f.id === id ? { ...f, parentId } : f) };
}

// Deletes a folder and promotes all its children (sub-folders, refs, leaf placements)
// up to the deleted folder's parent.
export function deleteFolder(tree: PersonalTree, id: string): PersonalTree {
  const target = tree.folders.find(f => f.id === id);
  if (!target) return tree;
  const promoteTo = target.parentId ?? null;
  return {
    ...tree,
    folders: tree.folders
      .filter(f => f.id !== id)
      .map(f => f.parentId === id ? { ...f, parentId: promoteTo } : f),
    categoryRefs: tree.categoryRefs.map(r => r.folderId === id ? { ...r, folderId: promoteTo } : r),
    leafPlacement: {
      list: Object.fromEntries(
        Object.entries(tree.leafPlacement.list).map(([k, v]) =>
          [k, v.folderId === id ? { ...v, folderId: promoteTo } : v]
        )
      ),
      collection: Object.fromEntries(
        Object.entries(tree.leafPlacement.collection).map(([k, v]) =>
          [k, v.folderId === id ? { ...v, folderId: promoteTo } : v]
        )
      ),
    },
  };
}

export type ItemKind = "list" | "collection" | "ref" | "folder";

export function setItemFolder(
  tree: PersonalTree,
  kind: ItemKind,
  id: string,
  folderId: string | null
): PersonalTree {
  if (kind === "ref") {
    return { ...tree, categoryRefs: tree.categoryRefs.map(r => r.id === id ? { ...r, folderId } : r) };
  }
  if (kind === "folder") {
    return moveFolder(tree, id, folderId);
  }
  // list / collection — store in leafPlacement
  const bucket = kind === "list" ? "list" : "collection";
  const existing = tree.leafPlacement[bucket][id];
  const sort = existing?.sort ?? 0;
  return {
    ...tree,
    leafPlacement: {
      ...tree.leafPlacement,
      [bucket]: { ...tree.leafPlacement[bucket], [id]: { folderId, sort } },
    },
  };
}
