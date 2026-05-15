import { getSupabaseAdmin } from "./supabase-admin";

export type PersonalTreeFolder = {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  isPublic: boolean;
};

export type PersonalTree = {
  folders: PersonalTreeFolder[];
  /** qset id → folder id (null / missing = root) */
  qsets: Record<string, string | null>;
  /** list id → folder id (null / missing = root) */
  lists: Record<string, string | null>;
};

export const EMPTY_PERSONAL_TREE: PersonalTree = {
  folders: [],
  qsets: {},
  lists: {},
};

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `fld_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isMissingColumn(error: { code?: string; message?: string } | null, column: string): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  const col = column.toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    msg.includes(col) ||
    (msg.includes("column") && msg.includes("does not exist") && msg.includes(col))
  );
}

export function parsePersonalTree(raw: unknown): PersonalTree {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return { ...EMPTY_PERSONAL_TREE };
    }
  }
  if (Array.isArray(raw)) {
    return parsePersonalTree({ folders: raw, qsets: {}, lists: {} });
  }
  if (!isRecord(raw)) return { ...EMPTY_PERSONAL_TREE };

  const folders: PersonalTreeFolder[] = [];
  if (Array.isArray(raw.folders)) {
    for (const item of raw.folders) {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.name !== "string") continue;
      const parentId =
        typeof item.parentId === "string"
          ? item.parentId
          : typeof item.parent_id === "string"
            ? item.parent_id
            : item.parentId === null || item.parent_id === null
              ? null
              : null;
      folders.push({
        id: item.id,
        name: item.name,
        parentId,
        position: typeof item.position === "number" ? item.position : 0,
        isPublic: item.isPublic === true || item.is_public === true,
      });
    }
  }

  const qsets: Record<string, string | null> = {};
  if (isRecord(raw.qsets)) {
    for (const [k, v] of Object.entries(raw.qsets)) {
      qsets[k] = typeof v === "string" ? v : v === null ? null : null;
    }
  }

  const lists: Record<string, string | null> = {};
  if (isRecord(raw.lists)) {
    for (const [k, v] of Object.entries(raw.lists)) {
      lists[k] = typeof v === "string" ? v : v === null ? null : null;
    }
  }

  return { folders, qsets, lists };
}

/** Client-facing folder shape (no position). */
export function foldersForClient(tree: PersonalTree) {
  return tree.folders.map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    isPublic: f.isPublic,
  }));
}

export function qsetParentId(tree: PersonalTree, qsetId: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(tree.qsets, qsetId)) return null;
  return tree.qsets[qsetId] ?? null;
}

export function listParentId(tree: PersonalTree, listId: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(tree.lists, listId)) return null;
  return tree.lists[listId] ?? null;
}

export type PublicRecommendedCategory = {
  id: string;
  name: string;
  href: string | null;
  isFolder: boolean;
  parentId: string | null;
  problemsPerTest: number | null;
  shuffleProblems: boolean | null;
};

/** Folder is public and every ancestor folder is also public. */
export function isPublicFolderVisible(tree: PersonalTree, folderId: string): boolean {
  const f = tree.folders.find((x) => x.id === folderId);
  if (!f?.isPublic) return false;
  if (f.parentId) return isPublicFolderVisible(tree, f.parentId);
  return true;
}

/** Map a folder id to the nearest visible public folder id (skips private folders). */
export function publicFolderDisplayParentId(tree: PersonalTree, folderId: string | null): string | null {
  if (!folderId) return null;
  const f = tree.folders.find((x) => x.id === folderId);
  if (!f) return null;
  if (isPublicFolderVisible(tree, f.id)) return f.id;
  return publicFolderDisplayParentId(tree, f.parentId);
}

export function countPublicFolders(tree: PersonalTree): number {
  return tree.folders.filter((f) => isPublicFolderVisible(tree, f.id)).length;
}

/** Flat list for recommended/search UIs: public folders + public qsets with tree placement. */
export function buildPublicRecommendedCategories(
  tree: PersonalTree,
  publicQsets: Array<{
    id: string;
    name: string;
    problems_per_test?: number | null;
    shuffle_problems?: boolean | null;
  }>
): PublicRecommendedCategory[] {
  const out: PublicRecommendedCategory[] = [];

  for (const f of tree.folders) {
    if (!isPublicFolderVisible(tree, f.id)) continue;
    out.push({
      id: f.id,
      name: f.name,
      href: null,
      isFolder: true,
      parentId: publicFolderDisplayParentId(tree, f.parentId),
      problemsPerTest: null,
      shuffleProblems: null,
    });
  }

  for (const q of publicQsets) {
    out.push({
      id: q.id,
      name: q.name,
      href: null,
      isFolder: false,
      parentId: publicFolderDisplayParentId(tree, qsetParentId(tree, q.id)),
      problemsPerTest: q.problems_per_test ?? null,
      shuffleProblems: q.shuffle_problems ?? null,
    });
  }

  return out;
}

export async function getPersonalTree(userId: string): Promise<PersonalTree> {
  const db = getSupabaseAdmin();

  const { data, error } = await db.from("users").select("personal_tree").eq("id", userId).maybeSingle();
  if (!error) return parsePersonalTree(data?.personal_tree);

  if (isMissingColumn(error, "personal_tree")) {
    const legacy = await db.from("users").select("folders").eq("id", userId).maybeSingle();
    if (!legacy.error) {
      return parsePersonalTree({ folders: legacy.data?.folders, qsets: {}, lists: {} });
    }
    if (isMissingColumn(legacy.error, "folders")) {
      return { ...EMPTY_PERSONAL_TREE };
    }
    if (legacy.error) throw new Error(legacy.error.message);
  }

  throw new Error(error.message);
}

/** Whether users.personal_tree exists (folders-only legacy counts as not ready for qset placement). */
export async function hasPersonalTreeColumn(): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("users").select("personal_tree").limit(1);
  return !error;
}

export async function savePersonalTree(userId: string, tree: PersonalTree): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("users").update({ personal_tree: tree }).eq("id", userId);

  if (!error) return;

  if (isMissingColumn(error, "personal_tree")) {
    const legacy = await db.from("users").update({ folders: tree.folders }).eq("id", userId);
    if (!legacy.error) return;
    if (isMissingColumn(legacy.error, "folders")) {
      throw new Error("請在 Supabase SQL 編輯器執行 scripts/add-personal-tree-to-users.sql");
    }
    if (legacy.error) throw new Error(legacy.error.message);
  }

  throw new Error(error.message);
}

function folderIdsUnder(tree: PersonalTree, folderId: string): Set<string> {
  const out = new Set<string>();
  const walk = (id: string) => {
    out.add(id);
    for (const f of tree.folders) {
      if (f.parentId === id && !out.has(f.id)) walk(f.id);
    }
  };
  walk(folderId);
  return out;
}

function wouldCreateFolderCycle(tree: PersonalTree, folderId: string, newParentId: string | null): boolean {
  if (newParentId === null) return false;
  if (newParentId === folderId) return true;
  const descendants = folderIdsUnder(tree, folderId);
  return descendants.has(newParentId);
}

function nextFolderPosition(tree: PersonalTree, parentId: string | null): number {
  const siblings = tree.folders.filter((f) => (f.parentId ?? null) === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((f) => f.position)) + 1;
}

export function addFolder(tree: PersonalTree, name: string, parentId: string | null): PersonalTree {
  const trimmed = name.trim();
  if (!trimmed) return tree;
  if (parentId !== null && !tree.folders.some((f) => f.id === parentId)) {
    throw new Error("parent folder not found");
  }
  const folder: PersonalTreeFolder = {
    id: newId(),
    name: trimmed,
    parentId,
    position: nextFolderPosition(tree, parentId),
    isPublic: false,
  };
  return { ...tree, folders: [...tree.folders, folder] };
}

export function renameFolder(tree: PersonalTree, folderId: string, name: string): PersonalTree {
  const trimmed = name.trim();
  if (!trimmed) return tree;
  return {
    ...tree,
    folders: tree.folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f)),
  };
}

export function updateFolderPublic(tree: PersonalTree, folderId: string, isPublic: boolean): PersonalTree {
  return {
    ...tree,
    folders: tree.folders.map((f) => (f.id === folderId ? { ...f, isPublic } : f)),
  };
}

export function moveFolder(tree: PersonalTree, folderId: string, parentId: string | null): PersonalTree {
  if (parentId !== null && !tree.folders.some((f) => f.id === parentId)) {
    throw new Error("parent folder not found");
  }
  if (wouldCreateFolderCycle(tree, folderId, parentId)) {
    throw new Error("cannot move folder into itself or a descendant");
  }
  return {
    ...tree,
    folders: tree.folders.map((f) => (f.id === folderId ? { ...f, parentId } : f)),
  };
}

export function deleteFolder(tree: PersonalTree, folderId: string): PersonalTree {
  const target = tree.folders.find((f) => f.id === folderId);
  if (!target) return tree;

  const reparentTo = target.parentId ?? null;

  const folders = tree.folders
    .filter((f) => f.id !== folderId)
    .map((f) => (f.parentId === folderId ? { ...f, parentId: reparentTo } : f));

  const qsets = { ...tree.qsets };
  for (const [id, parent] of Object.entries(qsets)) {
    if (parent === folderId) qsets[id] = reparentTo;
  }

  const lists = { ...tree.lists };
  for (const [id, parent] of Object.entries(lists)) {
    if (parent === folderId) lists[id] = reparentTo;
  }

  return { folders, qsets, lists };
}

export function setQsetParent(tree: PersonalTree, qsetId: string, folderId: string | null): PersonalTree {
  if (folderId !== null && !tree.folders.some((f) => f.id === folderId)) {
    throw new Error("folder not found");
  }
  const qsets = { ...tree.qsets };
  if (folderId === null) delete qsets[qsetId];
  else qsets[qsetId] = folderId;
  return { ...tree, qsets };
}

export function setListParent(tree: PersonalTree, listId: string, folderId: string | null): PersonalTree {
  if (folderId !== null && !tree.folders.some((f) => f.id === folderId)) {
    throw new Error("folder not found");
  }
  const lists = { ...tree.lists };
  if (folderId === null) delete lists[listId];
  else lists[listId] = folderId;
  return { ...tree, lists };
}
