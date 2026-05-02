const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Required migrations:
//   ALTER TABLE pcategories ADD COLUMN IF NOT EXISTS from_grid  boolean NOT NULL DEFAULT false;
//   ALTER TABLE pcategories ADD COLUMN IF NOT EXISTS is_public  boolean NOT NULL DEFAULT false;
export type UserCollectionRef = {
  id: string;
  userId: string;
  language: string;
  collectionId: string;
  displayName: string;
  createdAt: string;
  fromGrid: boolean;
  isPublic: boolean;
};

type Row = {
  id: string;
  user_id: string;
  language?: string | null;
  collection_id: string;
  name: string;
  created_at: string;
  from_grid?: boolean | null;
  is_public?: boolean | null;
};

function rowToRef(row: Row): UserCollectionRef {
  return {
    id: row.id,
    userId: row.user_id,
    language: row.language ?? "zh-TW",
    collectionId: row.collection_id,
    displayName: row.name,
    createdAt: row.created_at,
    fromGrid: row.from_grid ?? false,
    isPublic: row.is_public ?? false,
  };
}

export async function getUserCollections(userId: string, language?: string): Promise<UserCollectionRef[]> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return [];
  const rows: Row[] = await res.json();
  return rows.map(rowToRef);
}

export async function upsertUserCollection(
  userId: string,
  collectionId: string,
  displayName: string,
  fromGrid: boolean = false,
  language: string = "zh-TW"
): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/pcategories?on_conflict=user_id,language,collection_id`;
  const headers = { ...HEADERS, Prefer: "resolution=merge-duplicates" };
  const fullBody = { user_id: userId, language, collection_id: collectionId, name: displayName, from_grid: fromGrid };
  let res = await fetch(url, { method: "POST", headers, body: JSON.stringify(fullBody) });
  if (!res.ok) {
    const text = await res.text();
    // legacy DB without the from_grid/language columns — retry without optional columns.
    if (text.includes("from_grid")) {
      const fallbackBody = { user_id: userId, language, collection_id: collectionId, name: displayName };
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(fallbackBody) });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    if (text.includes("column") && text.includes("language") && text.includes("does not exist")) {
      // Truly legacy DB that has no language column at all — omit it.
      const legacyUrl = `${SUPABASE_URL}/rest/v1/pcategories?on_conflict=user_id,collection_id`;
      const fallbackBody = { user_id: userId, collection_id: collectionId, name: displayName, from_grid: fromGrid };
      res = await fetch(legacyUrl, { method: "POST", headers, body: JSON.stringify(fallbackBody) });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    throw new Error(text);
  }
}

/**
 * Patch the user's pcategories row. Pass any subset of fields.
 * Falls back gracefully if `is_public` column hasn't been migrated yet.
 */
export async function updateUserCollection(
  userId: string,
  collectionId: string,
  updates: { displayName?: string; isPublic?: boolean },
  language?: string
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (updates.displayName !== undefined) body.name = updates.displayName;
  if (updates.isPublic !== undefined) body.is_public = updates.isPublic;
  if (Object.keys(body).length === 0) return;
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  let res = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    if (text.includes("is_public") && body.is_public !== undefined) {
      const fallback = { ...body };
      delete fallback.is_public;
      if (Object.keys(fallback).length === 0) return;
      res = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(fallback) });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    throw new Error(text);
  }
}

/**
 * Delete the user's pcategories row for this collection.
 * Returns true if a row was actually deleted, false otherwise.
 */
export async function deleteUserCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { method: "DELETE", headers: { ...HEADERS, Prefer: "return=representation" } });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function userOwnsCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&select=id&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function getUserCollectionDisplayName(userId: string, collectionId: string, language?: string): Promise<string | null> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&select=name&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  return rows[0]?.name ?? null;
}

export async function getUserCollectionRef(userId: string, collectionId: string, language?: string): Promise<UserCollectionRef | null> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Row[] = await res.json();
  return rows[0] ? rowToRef(rows[0]) : null;
}

export async function countCollectionRefs(collectionId: string, language?: string): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/pcategories?collection_id=eq.${encodeURIComponent(collectionId)}&select=id`;
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
