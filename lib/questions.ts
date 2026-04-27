import { getListById } from "./lists-supabase";
import { fetchQuizQuestions } from "./questions-supabase";

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

// ── GSAT (學測) questions remain in Supabase questions table ────────────────

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

// ── quiz_questions table (Supabase) ─────────────────────────────────────────

function rowToQuestion(row: Awaited<ReturnType<typeof fetchQuizQuestions>>[number]): Question {
  const options = row.options
    ? Object.entries(row.options)
        .map(([label, text]) => ({ label, text }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];
  return {
    id: String(row.number),
    number: row.number,
    title: row.title,
    type: (row.type as Question["type"]) ?? "single",
    options,
    answer: row.answer,
    level: row.level ?? null,
    groupContent: row.group_content ?? null,
  };
}

async function fetchCollectionQuestions(collectionId: string, levelsParam: string | null): Promise<Question[]> {
  const levels = levelsParam ? levelsParam.split(",").map(Number) : null;
  const rows = await fetchQuizQuestions({ collectionId, levels, revalidate: 3600 });
  return rows.map(rowToQuestion);
}

export async function fetchQuestions(opts: {
  id: string;
  levels?: string | null;
  listId?: string | null;
}): Promise<Question[]> {
  const { id, levels: levelsParam, listId } = opts;

  // ── list mode ──────────────────────────────────────────────────────────────
  if (listId) {
    const list = await getListById(listId);
    if (!list) return [];

    const byCollection: Record<string, number[]> = {};
    for (const q of list.questions) {
      const num = parseInt(q.questionId);
      if (!isNaN(num)) {
        (byCollection[q.collectionId] = byCollection[q.collectionId] ?? []).push(num);
      }
    }

    const allQuestions: Question[] = [];
    for (const [collectionId, numbers] of Object.entries(byCollection)) {
      const rows = await fetchQuizQuestions({ collectionId, numbers, revalidate: 3600 });
      allQuestions.push(...rows.map(rowToQuestion));
    }
    return allQuestions;
  }

  // ── GSAT ───────────────────────────────────────────────────────────────────
  if (id.startsWith("國文學測")) {
    return fetchGSATQuestions(id);
  }

  // ── regular collection from quiz_questions ─────────────────────────────────
  return fetchCollectionQuestions(id, levelsParam ?? null);
}
