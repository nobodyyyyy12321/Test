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
  href: string | null;
  displayName: string;
  createdAt: string;
  fromGrid: boolean;
  isPublic: boolean;
  problemsPerTest?: number | null;
  shuffleProblems?: boolean | null;
  approvalStatus?: string;
};

type Row = {
  id: string;
  owner_id: string;
  language?: string | null;
  href: string | null;
  name: string;
  created_at?: string | null;
  from_grid?: boolean | null;
  is_public?: boolean | null;
  problems_per_test?: number | null;
  shuffle_problems?: boolean | null;
  position?: number | null;
  approval_status?: string | null;
};

const CATEGORY_COLUMNS = "id,owner_id,language,name,created_at,from_grid,is_public,problems_per_test,shuffle_problems,position,approval_status";

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToRef(row: Row): UserCollectionRef {
  return {
    id: row.id,
    userId: row.owner_id,
    language: row.language ?? "zh-TW",
    collectionId: row.id,
    href: row.href,
    displayName: row.name,
    createdAt: row.created_at ?? new Date(0).toISOString(),
    fromGrid: row.from_grid ?? false,
    isPublic: row.is_public ?? false,
    problemsPerTest: row.problems_per_test ?? null,
    shuffleProblems: row.shuffle_problems ?? null,
    approvalStatus: row.approval_status ?? "approved",
  };
}

export async function getUserCollections(userId: string, language?: string): Promise<UserCollectionRef[]> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&order=created_at.asc`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return [];
  const rows: Row[] = await res.json();
  return rows.map(rowToRef).filter((row) => row.collectionId);
}

export async function upsertUserCollection(
  userId: string,
  collectionId: string,
  displayName: string,
  fromGrid: boolean = false,
  language: string = "zh-TW"
): Promise<void> {
  const existingUrl = `${SUPABASE_URL}/rest/v1/qsets?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&language=eq.${encodeURIComponent(language)}&id=eq.${encodeURIComponent(collectionId)}&limit=1`;
  const existingRes = await fetch(existingUrl, { headers: HEADERS, cache: "no-store" });
  if (!existingRes.ok) throw new Error(await existingRes.text());
  const existingRows: Row[] = await existingRes.json();

  let position = existingRows[0]?.position ?? null;
  if (position === null) {
    const siblingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/qsets?select=position&owner_id=eq.${encodeURIComponent(userId)}&language=eq.${encodeURIComponent(language)}&order=position.desc&limit=1`,
      { headers: HEADERS, cache: "no-store" }
    );
    if (!siblingRes.ok) throw new Error(await siblingRes.text());
    const siblingRows: Array<{ position: number | null }> = await siblingRes.json();
    position = siblingRows[0]?.position != null ? siblingRows[0].position + 1 : 0;
  }

  const updatedAt = new Date().toISOString();
  if (existingRows[0]) {
    const patchUrl = `${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(existingRows[0].id)}`;
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

  const insertUrl = `${SUPABASE_URL}/rest/v1/qsets`;
  const insertBody = {
    id: newId(),
    owner_id: userId,
    position,
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
  let url = `${SUPABASE_URL}/rest/v1/qsets?owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(collectionId)}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteUserCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  // Delete any questions linked to this collection first (no-op for legacy slug ids
  // that don't have matching qsets_id rows in the flat questions table).
  const qRes = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?qsets_id=eq.${encodeURIComponent(collectionId)}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!qRes.ok) throw new Error(await qRes.text());

  let url = `${SUPABASE_URL}/rest/v1/qsets?owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(collectionId)}`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { method: "DELETE", headers: { ...HEADERS, Prefer: "return=representation" } });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

export async function userOwnsCollection(userId: string, collectionId: string, language?: string): Promise<boolean> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(collectionId)}&select=id&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return false;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0;
}

export async function getUserCollectionDisplayName(userId: string, collectionId: string, language?: string): Promise<string | null> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(collectionId)}&select=name&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  return rows[0]?.name ?? null;
}

export async function getUserCollectionRef(userId: string, collectionId: string, language?: string): Promise<UserCollectionRef | null> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?select=${encodeURIComponent(CATEGORY_COLUMNS)}&owner_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(collectionId)}&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Row[] = await res.json();
  return rows[0] ? rowToRef(rows[0]) : null;
}

export async function getAnyCollectionDisplayName(collectionId: string, language?: string): Promise<string | null> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(collectionId)}&select=name&limit=1`;
  if (language) url += `&language=eq.${encodeURIComponent(language)}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  return rows[0]?.name ?? null;
}

export async function countCollectionRefs(collectionId: string, language?: string): Promise<number> {
  let url = `${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(collectionId)}&owner_id=not.is.null&select=id`;
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
