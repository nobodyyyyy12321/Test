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

// Deep merge: incoming nodes are added or merged into existing by name
function mergeNodes(existing: CategoryNode[], incoming: CategoryNode[]): CategoryNode[] {
  const result = [...existing];
  for (const node of incoming) {
    const idx = result.findIndex(n => n.name === node.name);
    if (idx === -1) {
      result.push(node);
    } else {
      result[idx] = {
        ...result[idx],
        ...node,
        children: mergeNodes(result[idx].children ?? [], node.children ?? []),
        dropdown: mergeDropdown(result[idx].dropdown ?? [], node.dropdown ?? []),
      };
    }
  }
  return result;
}

function mergeDropdown(
  existing: { name: string; href: string }[],
  incoming: { name: string; href: string }[]
): { name: string; href: string }[] {
  const result = [...existing];
  for (const item of incoming) {
    const idx = result.findIndex(d => d.name === item.name);
    if (idx === -1) result.push(item);
    else result[idx] = item;
  }
  return result;
}

export async function upsertCategories(language: string, incoming: CategoryNode[]): Promise<void> {
  const existing = await _fetchCategories(language);
  const merged = mergeNodes(existing, incoming);

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?on_conflict=language`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ language, data: merged, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase upsert failed: ${text}`);
  }
}

// Replace entire categories (used by admin direct-edit page)
export async function replaceCategories(language: string, data: CategoryNode[]): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/categories?on_conflict=language`,
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
