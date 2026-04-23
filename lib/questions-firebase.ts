import { unstable_cache } from "next/cache";
import { getFirestoreDB } from "./firebase-admin";
import { getListById } from "./lists-firebase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

export type Question = {
  id: string;
  number: number;
  title: string;
  type?: "single" | "multiple" | "fill";
  options: { label: string; text: string }[];
  answer: string | string[];
  level?: number | null;
  groupContent?: string | null;
};

async function fetchGSATQuestions(examName: string): Promise<Question[]> {
  const [qRes, gRes] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/questions?exam_name=eq.${encodeURIComponent(examName)}&order=number.asc&select=number,title,type,options,answer`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, next: { revalidate: 3600 } }
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/question_groups?exam_name=eq.${encodeURIComponent(examName)}&select=group_id,content`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }, next: { revalidate: 3600 } }
    ),
  ]);
  if (!qRes.ok) throw new Error("Supabase fetch failed");

  const rows: { number: number; title: string; type: string; options: Record<string, string>; answer: string | null }[] = await qRes.json();
  const groupRows: { group_id: string; content: string }[] = gRes.ok ? await gRes.json() : [];

  const groups: Record<number, string> = {};
  for (const g of groupRows) {
    const start = parseInt(g.group_id.split("-")[0]);
    if (!isNaN(start)) groups[start] = g.content;
  }

  return rows.map(row => {
    const options = Object.entries(row.options)
      .map(([label, text]) => ({ label, text }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const isMultiple = row.type === "multiple_choice";
    const answer = isMultiple && row.answer ? row.answer.split("") : (row.answer ?? "");
    return {
      id: String(row.number),
      number: row.number,
      title: row.title,
      type: isMultiple ? "multiple" : "single",
      options,
      answer,
      groupContent: groups[row.number] ?? null,
    };
  });
}

// Next.js data cache — 跨 request、跨 instance 有效，可用 revalidateTag 清除
const fetchFirestoreQuestions = unstable_cache(
  async (id: string, levelsParam: string | null): Promise<Question[]> => {
    const db = getFirestoreDB();
    const snapshot = await db.collection(id).orderBy("number").get();
    const levels = levelsParam ? levelsParam.split(",").map(Number) : null;

    let questions: Question[] = snapshot.docs.map(doc => {
      const data = doc.data();
      const options = data.options && typeof data.options === "object"
        ? Object.entries(data.options as Record<string, string>)
            .map(([label, text]) => ({ label, text }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : [];
      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        level: data.level ?? null,
        type: data.type ?? "single",
        options,
        answer: data.answer,
        groupContent: null,
      };
    });

    if (levels) {
      questions = questions.filter(q => q.level !== null && levels.includes(q.level!));
    }
    return questions;
  },
  ["firestore-questions"],
  { revalidate: 3600 }
);

export async function fetchQuestions(opts: {
  id: string;
  levels?: string | null;
  listId?: string | null;
}): Promise<Question[]> {
  const { id, levels: levelsParam, listId } = opts;

  if (listId) {
    const list = await getListById(listId);
    if (!list) return [];

    const db = getFirestoreDB();
    const byCollection: Record<string, string[]> = {};
    for (const q of list.questions) {
      (byCollection[q.collectionId] = byCollection[q.collectionId] ?? []).push(q.questionId);
    }

    const allQuestions: Question[] = [];
    for (const [collectionId, ids] of Object.entries(byCollection)) {
      for (let i = 0; i < ids.length; i += 30) {
        const batch = ids.slice(i, i + 30);
        const snap = await db.collection(collectionId).where("__name__", "in", batch).get();
        snap.docs.forEach(doc => {
          const data = doc.data();
          const options = data.options && typeof data.options === "object"
            ? Object.entries(data.options as Record<string, string>)
                .map(([label, text]) => ({ label, text }))
                .sort((a, b) => a.label.localeCompare(b.label))
            : [];
          allQuestions.push({
            id: doc.id,
            number: data.number,
            title: data.title,
            level: data.level ?? null,
            type: data.type ?? "single",
            options,
            answer: data.answer,
            groupContent: null,
          });
        });
      }
    }
    return allQuestions;
  }

  if (id.startsWith("國文學測")) {
    return fetchGSATQuestions(id);
  }

  return fetchFirestoreQuestions(id, levelsParam ?? null);
}
