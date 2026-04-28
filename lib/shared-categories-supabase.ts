import { getSupabaseAdmin } from "./supabase-admin";

export type SharedCategory = {
  id: string;
  categoryKey: string;
  categoryName: string;
  sharedById: string;
  sharedByName?: string;
  sharedByAvatarUrl?: string;
  createdAt: string;
};

export async function shareCategoryWithUser(
  sharedById: string,
  recipientId: string,
  categoryKey: string,
  categoryName: string,
): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from("shared_categories").upsert(
    { shared_by_id: sharedById, recipient_id: recipientId, category_key: categoryKey, category_name: categoryName },
    { onConflict: "recipient_id,category_key,shared_by_id" },
  );
}

export async function getSharedCategoriesForUser(recipientId: string, recipientName: string): Promise<SharedCategory[]> {
  const db = getSupabaseAdmin();

  // 1. shared_categories table entries
  const { data: catRows } = await db
    .from("shared_categories")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });

  // 2. lists shared via shared_with array (legacy + direct shares)
  const { data: listRows } = await db
    .from("lists")
    .select("id,title,owner_id,created_at")
    .contains("shared_with", [recipientName]);

  // collect all sender IDs for name lookup
  const catSenderIds = (catRows ?? []).map((r: Record<string, unknown>) => r.shared_by_id as string);
  const listOwnerIds = (listRows ?? []).map((r: Record<string, unknown>) => r.owner_id as string);
  const allSenderIds = [...new Set([...catSenderIds, ...listOwnerIds])];

  const { data: senders } = allSenderIds.length
    ? await db.from("users").select("id,name,avatar_url").in("id", allSenderIds)
    : { data: [] };
  const senderMap: Record<string, { name: string; avatarUrl?: string }> = {};
  for (const s of senders ?? []) {
    const r = s as Record<string, unknown>;
    senderMap[r.id as string] = { name: r.name as string, avatarUrl: r.avatar_url as string | undefined };
  }

  // keys already in shared_categories (avoid duplicates from dual-write)
  const existingListKeys = new Set(
    (catRows ?? [])
      .map((r: Record<string, unknown>) => r.category_key as string)
      .filter(k => k.startsWith("list:"))
  );

  const fromCats: SharedCategory[] = (catRows ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    categoryKey: r.category_key as string,
    categoryName: r.category_name as string,
    sharedById: r.shared_by_id as string,
    sharedByName: senderMap[r.shared_by_id as string]?.name,
    sharedByAvatarUrl: senderMap[r.shared_by_id as string]?.avatarUrl,
    createdAt: r.created_at as string,
  }));

  const fromLists: SharedCategory[] = (listRows ?? [])
    .filter((r: Record<string, unknown>) => !existingListKeys.has(`list:${r.id as string}`))
    .map((r: Record<string, unknown>) => ({
      id: `list:${r.id as string}`,
      categoryKey: `list:${r.id as string}`,
      categoryName: r.title as string,
      sharedById: r.owner_id as string,
      sharedByName: senderMap[r.owner_id as string]?.name,
      sharedByAvatarUrl: senderMap[r.owner_id as string]?.avatarUrl,
      createdAt: r.created_at as string,
    }));

  return [...fromCats, ...fromLists];
}
