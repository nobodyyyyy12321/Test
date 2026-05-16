import { getListById } from "./lists-supabase";
import {
  fetchQuizQuestions,
  collectionTableExists,
  resolveTableName,
  fetchFlatRowsByCategoryId,
  UUID_RE,
} from "./questions-supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

export type Question = {
  id: string;
  number: number;
  title: string;
  type?: "single" | "multiple" | "fill" | "group";
  options: { label: string; text: string }[];
  answer: string | string[];
  level?: number | null;
  groupContent?: string | null;
  groupRange?: string | null;
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
  // Group-header rows: title holds the shared content text
  if (row.type === "group") {
    const groupText = row.title?.trim()
      || row.group_content?.trim()
      || row.content?.trim()
      || "";
    return {
      id: String(row.number),
      number: row.number,
      title: groupText,
      type: "group",
      options: [],
      answer: "",
      level: null,
      groupContent: groupText,
      groupRange: row.group_range ?? null,
    };
  }

  const options = row.options
    ? Object.entries(row.options)
        .map(([label, text]) => ({ label, text }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : [];
  const normalizedAnswer = row.answer ?? ((row.type === "multiple" || row.type === "multiple_choice") ? [] : "");
  return {
    id: String(row.number),
    number: row.number,
    title: row.title,
    type: (row.type === "multiple_choice" ? "multiple"
      : row.type === "single_choice" ? "single"
      : (row.type as Question["type"])) ?? "single",
    options,
    answer: normalizedAnswer,
    level: row.level ?? null,
    groupContent: null,
    groupRange: null,
  };
}

async function fetchCollectionQuestions(collectionId: string, levelsParam: string | null, language?: string | null, viewerId?: string | null): Promise<Question[]> {
  const levels = levelsParam ? levelsParam.split(",").map(Number) : null;
  const tableId = resolveTableName(collectionId, language);
  const rows = await fetchQuizQuestions({ collectionId: tableId, levels, revalidate: 3600, language, viewerId });
  return rows.map(rowToQuestion);
}

async function fetchQuestionsByCategoryId(
  categoryId: string,
  levelsParam: string | null,
  numbers?: number[] | null
): Promise<Question[]> {
  const levels = levelsParam ? levelsParam.split(",").map(Number) : null;
  const rows = await fetchFlatRowsByCategoryId(categoryId, { levels, numbers });
  return rows.map((r) => {
    const options = r.options
      ? Object.entries(r.options)
          .map(([label, text]) => ({ label, text }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : [];
    const answer = typeof r.answer === "string" ? r.answer : Array.isArray(r.answer) ? r.answer.map(String) : String(r.answer ?? "");
    const type: Question["type"] =
      r.q_type === "multiple" ? "multiple" :
      r.q_type === "fill" ? "fill" :
      "single";
    return {
      id: String(r.id),
      number: Number(r.number),
      title: r.content,
      type,
      options,
      answer,
      level: r.level ?? null,
      groupContent: null,
      groupRange: null,
    };
  });
}

export async function fetchQuestions(opts: {
  id: string;
  levels?: string | null;
  listId?: string | null;
  language?: string | null;
  viewerId?: string | null;
}): Promise<Question[]> {
  const { id, levels: levelsParam, listId, language, viewerId } = opts;

  // ── new flat schema: id is a categories UUID → query by qsets_id ───────────
  if (UUID_RE.test(id)) {
    return fetchQuestionsByCategoryId(id, levelsParam ?? null);
  }

  // ── list mode ──────────────────────────────────────────────────────────────
  if (listId) {
    const list = await getListById(listId);
    if (!list) return [];

    const byCollection: Record<string, number[]> = {};
    for (const q of list.questions) {
      const num = Number.isFinite(q.number) && q.number > 0 ? q.number : parseInt(q.questionId, 10);
      if (!isNaN(num)) {
        (byCollection[q.collectionId] = byCollection[q.collectionId] ?? []).push(num);
      }
    }

    const allQuestions: Question[] = [];
    for (const [collectionId, numbers] of Object.entries(byCollection)) {
      if (UUID_RE.test(collectionId)) {
        allQuestions.push(...await fetchQuestionsByCategoryId(collectionId, null, numbers));
      } else {
        const rows = await fetchQuizQuestions({ collectionId, numbers, revalidate: 3600, language, viewerId });
        allQuestions.push(...rows.map(rowToQuestion));
      }
    }
    return allQuestions;
  }

  // ── GSAT compatibility ────────────────────────────────────────────────────
  // Prefer dynamic quiz collections if they exist (including uploaded group rows).
  // Fall back to legacy GSAT tables only when the collection table doesn't exist.
  if (id.startsWith("國文學測")) {
    try {
      if (await collectionTableExists(id)) {
        return fetchCollectionQuestions(id, levelsParam ?? null, language, viewerId);
      }
    } catch {
      // If table existence check fails, keep legacy behavior.
    }
    return fetchGSATQuestions(id);
  }

  // ── regular collection from quiz_questions ─────────────────────────────────
  return fetchCollectionQuestions(id, levelsParam ?? null, language, viewerId);
}
