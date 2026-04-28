import { getSupabaseAdmin } from "./supabase-admin";
import { v4 as uuidv4 } from "uuid";

export type ListQuestion = {
  questionId: string;
  collectionId: string;
  title: string;
  number: number;
  level?: number | null;
};

export type SharedResult = {
  answered: number;
  correct: number;
  timestamp: string;
};

export type QuestionList = {
  id: string;
  title: string;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  questions: ListQuestion[];
  sharedWith?: string[];
  sharedResults?: Record<string, SharedResult[]>;
  ownerName?: string;
};

// ── helpers ───────────────────────────────────────────────────────────────────

async function fetchQuestions(listId: string): Promise<ListQuestion[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("list_questions")
    .select("question_id,collection_id,title,number,level,position")
    .eq("list_id", listId)
    .order("position", { ascending: true });
  return (data ?? []).map((r: any) => ({
    questionId: r.question_id,
    collectionId: r.collection_id,
    title: r.title,
    number: r.number,
    level: r.level ?? null,
  }));
}

function rowToList(row: any, questions: ListQuestion[]): QuestionList {
  return {
    id: row.id,
    title: row.title,
    ownerId: row.owner_id,
    isPublic: row.is_public,
    createdAt: row.created_at,
    questions,
    sharedWith: row.shared_with ?? [],
    sharedResults: row.shared_results ?? {},
  };
}

// ── public API (same shape as lists-firebase.ts) ──────────────────────────────

export async function getListsByOwner(ownerId: string): Promise<QuestionList[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("lists")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (!data) return [];
  return Promise.all(
    data.map(async (row) => rowToList(row, await fetchQuestions(row.id)))
  );
}

export async function getPublicListsByOwner(ownerId: string): Promise<QuestionList[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("lists")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (!data) return [];
  return Promise.all(
    data.map(async (row) => rowToList(row, await fetchQuestions(row.id)))
  );
}

export async function getListById(id: string): Promise<QuestionList | undefined> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lists").select("*").eq("id", id).maybeSingle();
  if (!data) return undefined;
  return rowToList(data, await fetchQuestions(id));
}

export async function createList(ownerId: string, title: string): Promise<QuestionList> {
  const db = getSupabaseAdmin();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await db.from("lists").insert({
    id,
    title,
    owner_id: ownerId,
    is_public: false,
    created_at: now,
    shared_with: [],
    shared_results: {},
  });
  if (error) throw error;
  return { id, title, ownerId, isPublic: false, createdAt: now, questions: [], sharedWith: [], sharedResults: {} };
}

export async function updateList(
  id: string,
  updates: Partial<Pick<QuestionList, "title" | "isPublic">>
): Promise<void> {
  const db = getSupabaseAdmin();
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.isPublic !== undefined) row.is_public = updates.isPublic;
  const { error } = await db.from("lists").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteList(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("lists").delete().eq("id", id);
  if (error) throw error;
}

export async function addQuestionToList(
  listId: string,
  question: ListQuestion
): Promise<void> {
  const db = getSupabaseAdmin();
  const existing = await fetchQuestions(listId);
  const alreadyIn = existing.some(
    (q) => q.questionId === question.questionId && q.collectionId === question.collectionId
  );
  if (alreadyIn) return;
  const { error } = await db.from("list_questions").insert({
    list_id: listId,
    question_id: question.questionId,
    collection_id: question.collectionId,
    title: question.title,
    number: question.number,
    level: question.level ?? null,
    position: existing.length,
  });
  if (error) throw error;
}

export async function addQuestionsToList(
  listId: string,
  incoming: ListQuestion[]
): Promise<void> {
  const db = getSupabaseAdmin();
  const existing = await fetchQuestions(listId);
  const toAdd = incoming.filter(
    (q) =>
      !existing.some(
        (e) => e.questionId === q.questionId && e.collectionId === q.collectionId
      )
  );
  if (toAdd.length === 0) return;
  const rows = toAdd.map((q, i) => ({
    list_id: listId,
    question_id: q.questionId,
    collection_id: q.collectionId,
    title: q.title,
    number: q.number,
    level: q.level ?? null,
    position: existing.length + i,
  }));
  const { error } = await db.from("list_questions").insert(rows);
  if (error) throw error;
}

export async function removeQuestionFromList(
  listId: string,
  questionId: string,
  collectionId: string
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("list_questions")
    .delete()
    .eq("list_id", listId)
    .eq("question_id", questionId)
    .eq("collection_id", collectionId);
  if (error) throw error;
}

export async function getListsSharedWithUser(userName: string): Promise<QuestionList[]> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("lists")
    .select("*")
    .contains("shared_with", [userName])
    .order("created_at", { ascending: false });
  if (!data) return [];
  return Promise.all(
    data.map(async (row) => rowToList(row, await fetchQuestions(row.id)))
  );
}

export async function copyList(sourceListId: string, newOwnerId: string): Promise<QuestionList> {
  const source = await getListById(sourceListId);
  if (!source) throw new Error("List not found");
  const db = getSupabaseAdmin();
  const id = uuidv4();
  const now = new Date().toISOString();
  const { error } = await db.from("lists").insert({
    id,
    title: source.title,
    owner_id: newOwnerId,
    is_public: false,
    created_at: now,
    shared_with: [],
    shared_results: {},
  });
  if (error) throw error;
  if (source.questions.length > 0) {
    const rows = source.questions.map((q, i) => ({
      list_id: id,
      question_id: q.questionId,
      collection_id: q.collectionId,
      title: q.title,
      number: q.number,
      level: q.level ?? null,
      position: i,
    }));
    const { error: qErr } = await db.from("list_questions").insert(rows);
    if (qErr) throw qErr;
  }
  return { id, title: source.title, ownerId: newOwnerId, isPublic: false, createdAt: now, questions: source.questions, sharedWith: [], sharedResults: {} };
}

export async function addSharedResult(
  listId: string,
  userName: string,
  result: SharedResult
): Promise<void> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lists").select("shared_results").eq("id", listId).maybeSingle();
  if (!data) throw new Error("List not found");
  const current: Record<string, SharedResult[]> = data.shared_results ?? {};
  const prev = current[userName] ?? [];
  const updated = [...prev, result].slice(-3);
  const { error } = await db
    .from("lists")
    .update({ shared_results: { ...current, [userName]: updated } })
    .eq("id", listId);
  if (error) throw error;
}

export async function shareListWithUser(listId: string, userName: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lists").select("owner_id,title,shared_with").eq("id", listId).maybeSingle();
  if (!data) throw new Error("List not found");
  const r = data as Record<string, unknown>;
  const current: string[] = (r.shared_with as string[]) ?? [];
  if (!current.includes(userName)) {
    const { error } = await db.from("lists").update({ shared_with: [...current, userName] }).eq("id", listId);
    if (error) throw error;
  }
  // mirror into shared_categories so the recipient's inbox sees it
  const { data: recipientRow } = await db.from("users").select("id").eq("name", userName).maybeSingle();
  if (recipientRow) {
    const recipientId = (recipientRow as Record<string, unknown>).id as string;
    await db.from("shared_categories").upsert(
      { shared_by_id: r.owner_id as string, recipient_id: recipientId, category_key: `list:${listId}`, category_name: r.title as string },
      { onConflict: "recipient_id,category_key,shared_by_id" },
    );
  }
}

export async function unshareListWithUser(listId: string, userName: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("lists").select("shared_with").eq("id", listId).maybeSingle();
  if (!data) throw new Error("List not found");
  const r = data as Record<string, unknown>;
  const current: string[] = (r.shared_with as string[]) ?? [];
  const { error } = await db.from("lists").update({ shared_with: current.filter((n) => n !== userName) }).eq("id", listId);
  if (error) throw error;
  // remove from shared_categories mirror
  const { data: recipientRow } = await db.from("users").select("id").eq("name", userName).maybeSingle();
  if (recipientRow) {
    const recipientId = (recipientRow as Record<string, unknown>).id as string;
    await db.from("shared_categories").delete().eq("recipient_id", recipientId).eq("category_key", `list:${listId}`);
  }
}
