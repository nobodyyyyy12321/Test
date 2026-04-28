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
  collectionId: string;
  displayName: string;
  createdAt: string;
};

type Row = {
  id: string;
  user_id: string;
  collection_id: string;
  display_name: string;
  created_at: string;
};

function rowToRef(row: Row): UserCollectionRef {
  return {
    id: row.id,
    userId: row.user_id,
    collectionId: row.collection_id,
    displayName: row.display_name,
    createdAt: row.created_at,
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
  displayName: string
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?on_conflict=user_id,collection_id`,
    {
      method: "POST",
      headers: { ...HEADERS, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: userId, collection_id: collectionId, display_name: displayName }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteUserCollection(userId: string, collectionId: string): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/user_collection_refs?user_id=eq.${encodeURIComponent(userId)}&collection_id=eq.${encodeURIComponent(collectionId)}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
}
