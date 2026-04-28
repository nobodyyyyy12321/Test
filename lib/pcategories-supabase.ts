import { getSupabaseAdmin } from "./supabase-admin";

export type PCategory = {
  id: string;
  ownerId: string;
  name: string;
  description?: string;
  collections: string[];   // collection keys, e.g. ["english", "jlpt:1,2"]
  language: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

function rowToCategory(r: Record<string, unknown>): PCategory {
  return {
    id: r.id as string,
    ownerId: r.owner_id as string,
    name: r.name as string,
    description: r.description as string | undefined,
    collections: (r.collections as string[]) ?? [],
    language: (r.language as string) ?? "zh-TW",
    isPublic: r.is_public as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function getPCategoriesByOwner(ownerId: string): Promise<PCategory[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("pcategories")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => rowToCategory(r));
}

export async function getPublicPCategories(): Promise<PCategory[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("pcategories")
    .select("*")
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => rowToCategory(r));
}

export async function getPCategoryById(id: string): Promise<PCategory | null> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("pcategories").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  return rowToCategory(data as Record<string, unknown>);
}

export async function createPCategory(
  ownerId: string,
  name: string,
  collections: string[] = [],
  language = "zh-TW",
  description?: string,
  isPublic = false,
): Promise<PCategory> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("pcategories")
    .insert({ owner_id: ownerId, name, collections, language, description, is_public: isPublic })
    .select()
    .single();
  if (error) throw error;
  return rowToCategory(data as Record<string, unknown>);
}

export async function updatePCategory(
  id: string,
  fields: { name?: string; description?: string; collections?: string[]; language?: string; isPublic?: boolean },
): Promise<void> {
  const db = getSupabaseAdmin();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.name !== undefined) update.name = fields.name;
  if (fields.description !== undefined) update.description = fields.description;
  if (fields.collections !== undefined) update.collections = fields.collections;
  if (fields.language !== undefined) update.language = fields.language;
  if (fields.isPublic !== undefined) update.is_public = fields.isPublic;
  const { error } = await db.from("pcategories").update(update).eq("id", id);
  if (error) throw error;
}

export async function deletePCategory(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("pcategories").delete().eq("id", id);
  if (error) throw error;
}
