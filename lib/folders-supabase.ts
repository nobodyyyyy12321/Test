import { getSupabaseAdmin } from "./supabase-admin";

export type Folder = {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  position: number;
  isPublic: boolean;
};

type Row = {
  id: string;
  owner_id: string;
  parent_id: string | null;
  name: string;
  position: number;
  is_public: boolean;
};

function rowToFolder(row: Row): Folder {
  return {
    id: row.id,
    ownerId: row.owner_id,
    parentId: row.parent_id,
    name: row.name,
    position: row.position,
    isPublic: row.is_public,
  };
}

export async function listFolders(ownerId: string): Promise<Folder[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("folders")
    .select("id,owner_id,parent_id,name,position,is_public")
    .eq("owner_id", ownerId)
    .order("parent_id", { ascending: true, nullsFirst: true })
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as Row[] | null ?? []).map(rowToFolder);
}

export async function getFolder(folderId: string): Promise<Folder | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("folders")
    .select("id,owner_id,parent_id,name,position,is_public")
    .eq("id", folderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToFolder(data as Row) : null;
}

async function nextPosition(ownerId: string, parentId: string | null): Promise<number> {
  const db = getSupabaseAdmin();
  let query = db.from("folders").select("position").eq("owner_id", ownerId).order("position", { ascending: false }).limit(1);
  query = parentId === null ? query.is("parent_id", null) : query.eq("parent_id", parentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const top = (data as { position: number }[] | null)?.[0]?.position;
  return typeof top === "number" ? top + 1 : 0;
}

export async function createFolder(ownerId: string, name: string, parentId: string | null): Promise<Folder> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  if (parentId) {
    const parent = await getFolder(parentId);
    if (!parent || parent.ownerId !== ownerId) throw new Error("parent folder not found");
  }
  const position = await nextPosition(ownerId, parentId);
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("folders")
    .insert({ owner_id: ownerId, parent_id: parentId, name: trimmed, position, is_public: false })
    .select("id,owner_id,parent_id,name,position,is_public")
    .single();
  if (error) throw new Error(error.message);
  return rowToFolder(data as Row);
}

export async function renameFolder(ownerId: string, folderId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("name required");
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("folders")
    .update({ name: trimmed, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

export async function updateFolderPublic(ownerId: string, folderId: string, isPublic: boolean): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("folders")
    .update({ is_public: isPublic, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

async function descendantIds(ownerId: string, folderId: string): Promise<Set<string>> {
  const all = await listFolders(ownerId);
  const byParent = new Map<string | null, Folder[]>();
  for (const f of all) {
    const key = f.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(f);
  }
  const out = new Set<string>();
  const walk = (id: string) => {
    out.add(id);
    for (const child of byParent.get(id) ?? []) walk(child.id);
  };
  walk(folderId);
  return out;
}

export async function moveFolder(ownerId: string, folderId: string, newParentId: string | null): Promise<void> {
  if (newParentId === folderId) throw new Error("cannot move folder into itself");
  if (newParentId) {
    const parent = await getFolder(newParentId);
    if (!parent || parent.ownerId !== ownerId) throw new Error("parent folder not found");
    const descendants = await descendantIds(ownerId, folderId);
    if (descendants.has(newParentId)) throw new Error("cannot move folder into its descendant");
  }
  const position = await nextPosition(ownerId, newParentId);
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("folders")
    .update({ parent_id: newParentId, position, updated_at: new Date().toISOString() })
    .eq("id", folderId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

/** Delete folder but keep its content: lift child folders + items up to the deleted folder's parent. */
export async function deleteFolder(ownerId: string, folderId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const target = await getFolder(folderId);
  if (!target || target.ownerId !== ownerId) return;
  const liftTo = target.parentId;

  const results = await Promise.all([
    db.from("folders").update({ parent_id: liftTo }).eq("parent_id", folderId).eq("owner_id", ownerId),
    db.from("qsets").update({ folder_id: liftTo }).eq("folder_id", folderId).eq("owner_id", ownerId),
    db.from("lists").update({ folder_id: liftTo }).eq("folder_id", folderId).eq("owner_id", ownerId),
  ]);
  for (const r of results) {
    if (r.error) throw new Error(r.error.message ?? "lift children failed");
  }

  const { error } = await db.from("folders").delete().eq("id", folderId).eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

export async function setQsetFolder(ownerId: string, qsetId: string, folderId: string | null): Promise<void> {
  if (folderId) {
    const parent = await getFolder(folderId);
    if (!parent || parent.ownerId !== ownerId) throw new Error("folder not found");
  }
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("qsets")
    .update({ folder_id: folderId })
    .eq("id", qsetId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

export async function setListFolder(ownerId: string, listId: string, folderId: string | null): Promise<void> {
  if (folderId) {
    const parent = await getFolder(folderId);
    if (!parent || parent.ownerId !== ownerId) throw new Error("folder not found");
  }
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("lists")
    .update({ folder_id: folderId })
    .eq("id", listId)
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
}

/** A folder is publicly visible iff it AND every ancestor is is_public. */
export function isFolderPublicVisible(folders: Folder[], folderId: string): boolean {
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cur: Folder | undefined = byId.get(folderId);
  while (cur) {
    if (!cur.isPublic) return false;
    if (!cur.parentId) return true;
    cur = byId.get(cur.parentId);
  }
  return false;
}

/** Snap any folder id to the nearest publicly-visible ancestor (or null if none). */
export function publicFolderDisplayParentId(folders: Folder[], folderId: string | null): string | null {
  if (!folderId) return null;
  const byId = new Map(folders.map((f) => [f.id, f]));
  let cur: Folder | undefined = byId.get(folderId);
  while (cur) {
    if (isFolderPublicVisible(folders, cur.id)) return cur.id;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return null;
}
