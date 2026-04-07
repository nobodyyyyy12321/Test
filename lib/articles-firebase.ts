import { getFirestoreDB } from "./firebase-admin";

const cache = new Map<string, { data: Article[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小時

function getCached(key: string): Article[] | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCached(key: string, data: Article[]) {
  cache.set(key, { data, ts: Date.now() });
}

export type Article = {
  id: string;
  title: string;
  category?: string;
  author?: string;
  content: string[] | string; // support array or single string
  type?: string; // e.g., 'poem'
  number?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
};

const COLLECTION_NAME = "articles";

function docToArticle(doc: any): Article {
  return {
    id: doc.id,
    ...doc.data(),
  } as Article;
}

export async function getArticles(filters?: { type?: string; category?: string }): Promise<Article[]> {
  try {
    const db = getFirestoreDB();
    let query: any = db.collection(COLLECTION_NAME);
    if (filters?.type) query = query.where("type", "==", filters.type);
    if (filters?.category) query = query.where("category", "==", filters.category);
    const snapshot = await query.get();
    return snapshot.docs.map((d: any) => docToArticle(d));
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
    const db = getFirestoreDB();
    let snapshot = await db.collection(COLLECTION_NAME).where("category", "==", category).get();
    if (!snapshot.empty) {
      const data = snapshot.docs.map((d: any) => docToArticle(d));
      setCached(key, data);
      return data;
    }
    snapshot = await db.collection(COLLECTION_NAME).where("type", "==", category).get();
    const data = snapshot.docs.map((d: any) => docToArticle(d));
    setCached(key, data);
    return data;
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
    const db = getFirestoreDB();
    const snapshot = await db.collection(COLLECTION_NAME).where("number", "==", number).limit(1).get();
    if (snapshot.empty) return undefined;
    const data = [docToArticle(snapshot.docs[0])];
    setCached(key, data);
    return data[0];
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
    const db = getFirestoreDB();
    const snapshot = await db.collection(COLLECTION_NAME).where("title", "==", title).limit(1).get();
    if (snapshot.empty) return undefined;
    const data = [docToArticle(snapshot.docs[0])];
    setCached(key, data);
    return data[0];
  } catch (err) {
    console.error("Error getting article by title:", err);
    return undefined;
  }
}

export async function createArticle(article: Omit<Article, "id" | "createdAt" | "updatedAt">) {
  try {
    const db = getFirestoreDB();
    const now = new Date().toISOString();
    const data: any = { ...article, createdAt: now, updatedAt: now };
    const docRef = await db.collection(COLLECTION_NAME).add(data);
    const doc = await docRef.get();
    return docToArticle(doc);
  } catch (err) {
    console.error("Error creating article:", err);
    throw err;
  }
}