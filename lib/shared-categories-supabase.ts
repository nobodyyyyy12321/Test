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

export async function getSharedCategoriesForUser(recipientId: string): Promise<SharedCategory[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("shared_categories")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false });
  if (!data?.length) return [];

  const senderIds = [...new Set(data.map((r: Record<string, unknown>) => r.shared_by_id as string))];
  const { data: senders } = await db.from("users").select("id,name,avatar_url").in("id", senderIds);
  const senderMap: Record<string, { name: string; avatarUrl?: string }> = {};
  for (const s of senders ?? []) {
    const r = s as Record<string, unknown>;
    senderMap[r.id as string] = { name: r.name as string, avatarUrl: r.avatar_url as string | undefined };
  }

  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    categoryKey: r.category_key as string,
    categoryName: r.category_name as string,
    sharedById: r.shared_by_id as string,
    sharedByName: senderMap[r.shared_by_id as string]?.name,
    sharedByAvatarUrl: senderMap[r.shared_by_id as string]?.avatarUrl,
    createdAt: r.created_at as string,
  }));
}
