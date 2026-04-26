import { getSupabaseAdmin } from "./supabase-admin";

export type Article = {
  id: string;
  title: string;
  category?: string;
  author?: string;
  content: string[] | string;
  type?: string;
  number?: number;
  language?: string;
  attemptCount?: number;
  successCount?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

// ── in-memory cache (1 hr TTL, same as Firebase version) ─────────────────────

const cache = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000;

function getCached(key: string): Article[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}
function setCached(key: string, data: Article[]) {
  cache.set(key, { data, ts: Date.now() });
}

// ── row → Article ─────────────────────────────────────────────────────────────

function rowToArticle(row: Record<string, unknown>): Article {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as string | null) ?? undefined,
    author: (row.author as string | null) ?? undefined,
    content: (row.content as string[] | string) ?? [],
    type: (row.type as string | null) ?? undefined,
    number: (row.number as number | null) ?? undefined,
    language: (row.language as string | null) ?? "中文",
    attemptCount: (row.attempt_count as number | null) ?? 0,
    successCount: (row.success_count as number | null) ?? 0,
    createdAt: (row.created_at as string | null) ?? undefined,
    updatedAt: (row.updated_at as string | null) ?? undefined,
  };
}

// ── public API (same shape as articles-firebase.ts) ──────────────────────────

export async function getArticles(filters?: { type?: string; category?: string }): Promise<Article[]> {
  try {
    const db = getSupabaseAdmin();
    let q = db.from("articles").select("*");
    if (filters?.type) q = q.eq("type", filters.type) as typeof q;
    if (filters?.category) q = q.eq("category", filters.category) as typeof q;
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(rowToArticle);
  } catch (err) {
    console.error("Error getting articles:", err);
    return [];
  }
}

export async function getArticlesByCategory(category: string): Promise<Article[]> {
  const key = `category:${category}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const db = getSupabaseAdmin();
    let { data } = await db.from("articles").select("*").eq("category", category);
    if (!data || data.length === 0) {
      ({ data } = await db.from("articles").select("*").eq("type", category));
    }
    const result = (data ?? []).map(rowToArticle);
    setCached(key, result);
    return result;
  } catch (err) {
    console.error("Error getting articles by category:", err);
    return [];
  }
}

export async function getArticleByNumber(number: number): Promise<Article | undefined> {
  const key = `number:${number}`;
  const cached = getCached(key);
  if (cached) return cached[0];

  try {
    const db = getSupabaseAdmin();
    const { data } = await db.from("articles").select("*").eq("number", number).limit(1);
    if (!data || data.length === 0) return undefined;
    const result = [rowToArticle(data[0])];
    setCached(key, result);
    return result[0];
  } catch (err) {
    console.error("Error getting article by number:", err);
    return undefined;
  }
}

export async function getArticleByTitle(title: string): Promise<Article | undefined> {
  const key = `title:${title}`;
  const cached = getCached(key);
  if (cached) return cached[0];

  try {
    const db = getSupabaseAdmin();
    const { data } = await db.from("articles").select("*").eq("title", title).limit(1);
    if (!data || data.length === 0) return undefined;
    const result = [rowToArticle(data[0])];
    setCached(key, result);
    return result[0];
  } catch (err) {
    console.error("Error getting article by title:", err);
    return undefined;
  }
}

export async function createArticle(
  article: Omit<Article, "id" | "createdAt" | "updatedAt">
): Promise<Article> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await db
    .from("articles")
    .insert({
      title: article.title,
      category: article.category ?? null,
      author: article.author ?? null,
      content: article.content,
      type: article.type ?? null,
      number: article.number ?? null,
      language: article.language ?? "中文",
      attempt_count: 0,
      success_count: 0,
      created_at: now,
      updated_at: now,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToArticle(data);
}

export async function incrementArticleCounters(
  articleId: string,
  articleNumber: number,
  success: boolean
): Promise<{ attemptCount: number; successCount: number }> {
  const db = getSupabaseAdmin();

  // Try by ID first
  let { data } = await db.from("articles").select("id,attempt_count,success_count").eq("id", articleId).maybeSingle();

  // Fall back to lookup by number
  if (!data) {
    const res = await db.from("articles").select("id,attempt_count,success_count").eq("number", articleNumber).limit(1);
    data = res.data?.[0] ?? null;
  }

  if (!data) {
    return { attemptCount: 0, successCount: 0 };
  }

  const attemptCount = (data.attempt_count ?? 0) + 1;
  const successCount = (data.success_count ?? 0) + (success ? 1 : 0);

  await db
    .from("articles")
    .update({ attempt_count: attemptCount, success_count: successCount, updated_at: new Date().toISOString() })
    .eq("id", data.id);

  return { attemptCount, successCount };
}
