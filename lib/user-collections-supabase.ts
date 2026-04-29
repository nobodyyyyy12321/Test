const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

// Required migration:
//   ALTER TABLE user_collection_refs ADD COLUMN IF NOT EXISTS from_grid boolean NOT NULL DEFAULT false;
export type UserCollectionRef = {
  id: string;
  userId: string;
  collectionId: string;
  displayName: string;
  createdAt: string;
  fromGrid: boolean;
};

type Row = {
  id: string;
  user_id: string;
  collection_id: string;
  display_name: string;
  created_at: string;
  from_grid?: boolean | null;
};

function rowToRef(row: Row): UserCollectionRef {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    displayName: row.display_name,
    createdAt: row.created_at,
    fromGrid: row.from_grid ?? false,
  };
}

export async function getUserCollections(userId: string): Promise<UserCollectionRef[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return [];
  const rows: Row[] = await res.json();
  return rows.map(rowToRef);
}

export async function upsertUserCollection(
  userId: string,
  collectionId: string,
  displayName: string,
  fromGrid: boolean = false
): Promise<void> {
  const url = `${SUPABASE_URL}/rest/v1/user_collection_refs?on_conflict=user_id,collection_id`;
  const headers = { ...HEADERS, Prefer: "resolution=merge-duplicates" };
  const fullBody = { user_id: userId, collection_id: collectionId, display_name: displayName, from_grid: fromGrid };
  let res = await fetch(url, { method: "POST", headers, body: JSON.stringify(fullBody) });
  if (!res.ok) {
    const text = await res.text();
    // legacy DB without the from_grid column — retry without it.
    if (text.includes("from_grid")) {
      const fallbackBody = { user_id: userId, collection_id: collectionId, display_name: displayName };
      res = await fetch(url, { method: "POST", headers, body: JSON.stringify(fallbackBody) });
      if (!res.ok) throw new Error(await res.text());
      return;
    }
    throw new Error(text);
  }
}

export async function deleteUserCollection(userId: string, collectionId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function userOwnsCollection(userId: string, collectionId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&select=id&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function getUserCollectionDisplayName(userId: string, collectionId: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&select=display_name&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows: Array<{ display_name: string }> = await res.json();
  return rows[0]?.display_name ?? null;
}

export async function getUserCollectionRef(userId: string, collectionId: string): Promise<UserCollectionRef | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows: Row[] = await res.json();
  return rows[0] ? rowToRef(rows[0]) : null;
}

export async function countCollectionRefs(collectionId: string): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?collection_id=eq.${encodeURIComponent(collectionId)}&select=id`,
    { headers: { ...HEADERS, Prefer: "count=exact" }, cache: "no-store" }
  );
  if (!res.ok) return 0;
  const range = res.headers.get("content-range");
  if (range) {
    const m = range.match(/\/(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  const rows = await res.json();
  return Array.isArray(rows) ? rows.length : 0;
}
