const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export type PendingUpload = {
  id: string;
  submitter_email: string | null;
  submitter_name: string | null;
  payload: unknown;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export async function createPendingUpload(opts: {
  submitter_email?: string | null;
  submitter_name?: string | null;
  payload: unknown;
}): Promise<PendingUpload> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pending_uploads`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify({
      submitter_email: opts.submitter_email ?? null,
      submitter_name: opts.submitter_name ?? null,
      payload: opts.payload,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const rows: PendingUpload[] = await res.json();
  return rows[0];
}

export async function listPendingUploads(status?: "pending" | "approved" | "rejected"): Promise<PendingUpload[]> {
  const filter = status ? `&status=eq.${status}` : "";
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_uploads?order=created_at.desc${filter}`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getPendingUpload(id: string): Promise<PendingUpload | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_uploads?id=eq.${encodeURIComponent(id)}&limit=1`,
    { headers: HEADERS, cache: "no-store" }
  );
  if (!res.ok) return null;
  const rows: PendingUpload[] = await res.json();
  return rows[0] ?? null;
}

export async function updatePendingUploadStatus(
  id: string,
  status: "approved" | "rejected",
  review_note?: string
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/pending_uploads?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify({
        status,
        review_note: review_note ?? null,
        reviewed_at: new Date().toISOString(),
      }),
    }
  );
  if (!res.ok) throw new Error(await res.text());
}
