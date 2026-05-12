const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export type UserCollectionRef = {
  id: string;
  userId: string;
  language: string;
  collectionId: string;
  displayName: string;
  parentId: string | null;
  createdAt: string;
  fromGrid: boolean;
  isPublic: boolean;
  approvalStatus?: string;
};

export type UserFolderRef = {
  id: string;
  userId: string;
  language: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  isPublic: boolean;
};

type Row = {
  id: string;
  owner_id: string;
  language?: string | null;
  parent_id?: string | null;
  href: string | null;
  name: string;
  created_at?: string | null;
  from_grid?: boolean | null;
  is_public?: boolean | null;
  position?: number | null;
  approval_status?: string | null;
};

const CATEGORY_COLUMNS = "id,owner_id,language,parent_id,href,name,created_at,from_grid,is_public,position,approval_status";

function collectionHref(collectionId: string): string {
  return `/test/${encodeURIComponent(collectionId)}`;
}

function hrefToCollectionId(href: string | null | undefined): string {
  if (!href) return "";
  const match = href.match(/^\/test\/([^?]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToRef(row: Row): UserCollectionRef {
  return {
    id: row.id,
    userId: row.owner_id,
    language: row.language ?? "zh-TW",
    collectionId: hrefToCollectionId(row.href),
    displayName: row.name,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    fromGrid: row.from_grid ?? false,
    isPublic: row.is_public ?? false,
    approvalStatus: row.approval_status ?? "approved",
  };
}

function rowToFolder(row: Row): UserFolderRef {
  return {
    id: row.id,
    userId: row.owner_id,
    language: row.language ?? "zh-TW",
    name: row.name,
    parentId: row.parent_id ?? null,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    isPublic: row.is_public ?? false,
  };
}

export async function getUserCollections(userId: string, language?: string): Promise<UserCollectionRef[]> {
  let url = `${SUPABASE_URL}/rest/v1/categories?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&href=not.is.null&order=created_at.asc`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return [];
  const rows: Row[] = await res.json();
  return rows.map(rowToRef).filter((row) => row.collectionId);
}

export async function getUserFolders(userId: string, language?: string): Promise<UserFolderRef[]> {
  let url = `${SUPABASE_URL}/rest/v1/categories?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&href=is.null&order=position.asc`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return [];
  const rows: Row[] = await res.json();
  return rows.map(rowToFolder);
}

async function getNextSiblingPosition(userId: string, language: string, parentId: string | null): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/categories?select=position&owner_id=eq.${encodeURIComponent(userId)}&language=eq.${encodeURIComponent(language)}&order=position.desc&limit=1`;
  url += parentId === null
    ? `&parent_id=is.null`
    : `&parent_id=eq.${encodeURIComponent(parentId)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const rows: Array<{ position: number | null }> = await res.json();
  return rows[0]?.position != null ? rows[0].position + 1 : 0;
}

export async function createUserFolder(
  userId: string,
  language: string,
  name: string,
  parentId: string | null = null
): Promise<UserFolderRef> {
  const id = newId();
  const position = await getNextSiblingPosition(userId, language, parentId);
  const body = {
    id,
    owner_id: userId,
    language,
    parent_id: parentId,
    position,
    href: null,
    name,
    dropdown: [],
    dropdown_align: null,
    updated_at: new Date().toISOString(),
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/categories`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows: Row[] = await res.json();
  if (!rows[0]) throw new Error("create folder failed");
  return rowToFolder(rows[0]);
}

export async function renameUserFolder(userId: string, folderId: string, name: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(folderId)}&owner_id=eq.${encodeURIComponent(userId)}&href=is.null`,
    { method: "PATCH", headers: HEADERS, body: JSON.stringify({ name, updated_at: new Date().toISOString() }) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function moveUserFolder(userId: string, folderId: string, parentId: string | null): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(folderId)}&owner_id=eq.${encodeURIComponent(userId)}&href=is.null`,
    { method: "PATCH", headers: HEADERS, body: JSON.stringify({ parent_id: parentId, updated_at: new Date().toISOString() }) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function updateFolderPublicStatus(userId: string, folderId: string, isPublic: boolean): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(folderId)}&owner_id=eq.${encodeURIComponent(userId)}&href=is.null`,
    { method: "PATCH", headers: HEADERS, body: JSON.stringify({ is_public: isPublic, updated_at: new Date().toISOString() }) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function moveUserCollectionToFolder(userId: string, categoryId: string, folderId: string | null): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(categoryId)}&owner_id=eq.${encodeURIComponent(userId)}&href=not.is.null`,
    { method: "PATCH", headers: HEADERS, body: JSON.stringify({ parent_id: folderId, updated_at: new Date().toISOString() }) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteUserFolder(userId: string, folderId: string): Promise<void> {
  const lookupRes = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?select=parent_id&owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(folderId)}&href=is.null&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!lookupRes.ok) throw new Error(await lookupRes.text());
  const rows: Array<{ parent_id: string | null }> = await lookupRes.json();
  const promoteTo = rows[0]?.parent_id ?? null;

  // Promote child folders and collections to deleted folder's parent.
  const promoteBody = JSON.stringify({ parent_id: promoteTo, updated_at: new Date().toISOString() });
  const moveFoldersRes = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&parent_id=eq.${encodeURIComponent(folderId)}&href=is.null`,
    { method: "PATCH", headers: HEADERS, body: promoteBody }
  );
  if (!moveFoldersRes.ok) throw new Error(await moveFoldersRes.text());
  const moveCollectionsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&parent_id=eq.${encodeURIComponent(folderId)}&href=not.is.null`,
    { method: "PATCH", headers: HEADERS, body: promoteBody }
  );
  if (!moveCollectionsRes.ok) throw new Error(await moveCollectionsRes.text());

  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(folderId)}&href=is.null`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!delRes.ok) throw new Error(await delRes.text());
}

export async function upsertUserCollection(
  userId: string,
  collectionId: string,
  displayName: string,
  fromGrid: boolean = false,
  language: string = "zh-TW"
): Promise<void> {
  const href = collectionHref(collectionId);
  const existingUrl = `${SUPABASE_URL}/rest/v1/categories?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&language=eq.${encodeURIComponent(language)}&href=eq.${encodeURIComponent(href)}&limit=1`;
  const existingRes = await fetch(existingUrl, { headers: HEADERS, cache: "no-store" });
  if (!existingRes.ok) throw new Error(await existingRes.text());
  const existingRows: Row[] = await existingRes.json();

  let position = existingRows[0]?.position ?? null;
  if (position === null) {
    const siblingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/categories?select=position&owner_id=eq.${encodeURIComponent(userId)}&language=eq.${encodeURIComponent(language)}&href=not.is.null&order=position.desc&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!siblingRes.ok) throw new Error(await siblingRes.text());
    const siblingRows: Array<{ position: number | null }> = await siblingRes.json();
    position = siblingRows[0]?.position != null ? siblingRows[0].position + 1 : 0;
  }

  const updatedAt = new Date().toISOString();
  if (existingRows[0]) {
    const patchUrl = `${SUPABASE_URL}/rest/v1/categories?id=eq.${encodeURIComponent(existingRows[0].id)}`;
    const patchBody = {
      name: displayName,
      from_grid: fromGrid,
      updated_at: updatedAt,
    };
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) throw new Error(await patchRes.text());
    return;
  }

  const insertUrl = `${SUPABASE_URL}/rest/v1/categories`;
  const insertBody = {
    id: newId(),
    owner_id: userId,
    parent_id: null,
    position,
    href,
    name: displayName,
    language,
    dropdown: [],
    dropdown_align: null,
    from_grid: fromGrid,
    approval_status: "pending",
    updated_at: updatedAt,
  };
  const insertRes = await fetch(insertUrl, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(insertBody),
  });
  if (!insertRes.ok) throw new Error(await insertRes.text());
}

export async function updateUserCollection(
  userId: string,
  collectionId: string,
  updates: { displayName?: string; isPublic?: boolean },
  language?: string
): Promise<void> {
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.displayName !== undefined) body.name = updates.displayName;
  if (updates.isPublic !== undefined) body.is_public = updates.isPublic;
  if (Object.keys(body).length === 1) return;
  let url = `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&href=eq.${encodeURIComponent(collectionHref(collectionId))}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteUserCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  let url = `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&href=eq.${encodeURIComponent(collectionHref(collectionId))}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { method: "DELETE", headers: { ...HEADERS, Prefer: "return=representation" } });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function userOwnsCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  let url = `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&href=eq.${encodeURIComponent(collectionHref(collectionId))}&select=id&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function getUserCollectionDisplayName(userId: string, collectionId: string, language?: string): Promise<string | null> {
  let url = `${SUPABASE_URL}/rest/v1/categories?owner_id=eq.${encodeURIComponent(userId)}&href=eq.${encodeURIComponent(collectionHref(collectionId))}&select=name&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  return rows[0]?.name ?? null;
}

export async function getUserCollectionRef(userId: string, collectionId: string, language?: string): Promise<UserCollectionRef | null> {
  let url = `${SUPABASE_URL}/rest/v1/categories?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&href=eq.${encodeURIComponent(collectionHref(collectionId))}&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Row[] = await res.json();
  return rows[0] ? rowToRef(rows[0]) : null;
}

export async function getAnyCollectionDisplayName(collectionId: string, language?: string): Promise<string | null> {
  const href = collectionHref(collectionId);
  let url = `${SUPABASE_URL}/rest/v1/categories?href=eq.${encodeURIComponent(href)}&owner_id=not.is.null&select=name&order=created_at.asc&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  if (rows[0]?.name) return rows[0].name;

  const fallbackRes = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?href=eq.${encodeURIComponent(href)}&owner_id=not.is.null&select=name&order=created_at.asc&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!fallbackRes.ok) return null;
  const fallbackRows: Array<{ name: string }> = await fallbackRes.json();
  return fallbackRows[0]?.name ?? null;
}

export async function countCollectionRefs(collectionId: string, language?: string): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/categories?href=eq.${encodeURIComponent(collectionHref(collectionId))}&owner_id=not.is.null&select=id`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: { ...HEADERS, Prefer: "count=exact" }, cache: "no-store" });
  if (!res.ok) return 0;
  const range = res.headers.get("content-range");
  if (range) {
    const m = range.match(/\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}
