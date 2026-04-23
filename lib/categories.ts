import { unstable_cache } from "next/cache";
import type { CategoryNode } from "../app/components/CategoryNode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

export type { CategoryNode };

async function _fetchCategories(language: string): Promise<CategoryNode[]> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?language=eq.${encodeURIComponent(language)}&select=data&limit=1`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return [];
  const rows: { data: CategoryNode[] }[] = await res.json();
  return rows[0]?.data ?? [];
}

export const getCategoriesCached = unstable_cache(
  _fetchCategories,
  ["categories"],
  { revalidate: 60, tags: ["categories"] }
);

export async function upsertCategories(language: string, data: CategoryNode[]): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ language, data, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed: ${text}`);
  }
}
