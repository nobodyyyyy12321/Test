const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Resolves the actual Supabase table name for a collection.
 * zh-TW (default) uses the collectionId as-is.
 * Table name is always the collectionId as-is, regardless of language.
 */
export function resolveTableName(collectionId: string, language?: string | null): string {
  return collectionId;
}

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const READ_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

const WRITE_HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const QUIZ_QUESTIONS_TABLE = "quiz_questions_all";

export type QuizQuestionRow = {
  number: number;
  title: string;
  type: string;
  options: Record<string, string> | null;
  answer: string | string[] | null;
  level: number | null;
  group_range: string | null;
  group_content?: string | null;
  content?: string | null;
};

export async function fetchQuizQuestions(opts: {
  collectionId: string;
  levels?: number[] | null;
  numbers?: number[] | null;
  revalidate?: number | false;
}): Promise<QuizQuestionRow[]> {
  const { collectionId, levels, numbers, revalidate = 3600 } = opts;

  if (numbers !== undefined && numbers !== null && numbers.length === 0) return [];

  const chunks: QuizQuestionRow[][] = [];

  const numberBatches: (number[] | null)[] = numbers
    ? Array.from({ length: Math.ceil(numbers.length / 500) }, (_, i) => numbers.slice(i * 500, (i + 1) * 500))
    : [null];

  for (const batch of numberBatches) {
    const baseUrl = () => {
      let url = `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?select=number,title,type,options,answer,level,group_range,group_content&quiz_id=eq.${encodeURIComponent(collectionId)}&order=number.asc&limit=1000`;
      // Include group-header rows (type=group, level=null) even when level filter is active
      if (levels?.length) url += `&or=(level.in.(${levels.join(",")}),type.eq.group)`;
      if (batch !== null) url += `&number=in.(${batch.join(",")})`;
      return url;
    };

    let offset = 0;
    while (true) {
      const url = `${baseUrl()}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { ...READ_HEADERS, Prefer: "count=none" },
        next: revalidate === false ? { revalidate: 0 } : { revalidate, tags: [`quiz-questions-${collectionId}`] },
      });
      if (!res.ok) throw new Error(`Supabase fetch error: ${await res.text()}`);
      const page: QuizQuestionRow[] = await res.json();
      chunks.push(page);
      if (page.length < 1000) break;
      offset += 1000;
    }
  }

  return chunks.flat();
}

/**
 * Returns true if this collection already has questions in public.quiz_questions_all.
 */
export async function collectionTableExists(collectionId: string): Promise<boolean> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?select=quiz_id&quiz_id=eq.${encodeURIComponent(collectionId)}&limit=1`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!res.ok) return false;
  const rows: Array<{ quiz_id: string }> = await res.json();
  return rows.length > 0;
}

async function doUpsert(collectionId: string, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const payload = chunk.map((row) => ({
      ...row,
      quiz_id: collectionId,
      source_schema: "public",
      source_table: QUIZ_QUESTIONS_TABLE,
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?on_conflict=quiz_id,number`, {
      method: "POST",
      headers: { ...WRITE_HEADERS, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Supabase upsert error: ${text}`);
    }
  }
}

export async function fetchAllQuizQuestionsFresh(
  collectionId: string
): Promise<QuizQuestionRow[]> {
  const out: QuizQuestionRow[] = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?select=number,title,type,options,answer,level,group_range,group_content&quiz_id=eq.${encodeURIComponent(collectionId)}&order=number.asc&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
    if (!res.ok) {
      throw new Error(await res.text());
    }
    const page: QuizQuestionRow[] = await res.json();
    out.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return out;
}

export async function updateQuizQuestion(
  collectionId: string,
  number: number,
  updates: {
    title?: string;
    type?: string;
    options?: Record<string, string> | null;
    answer?: string | string[] | null;
    level?: number | null;
    group_range?: string | null;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.options !== undefined) row.options = updates.options;
  if (updates.answer !== undefined) row.answer = updates.answer;
  if (updates.level !== undefined) row.level = updates.level;
  if (updates.group_range !== undefined) row.group_range = updates.group_range;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?quiz_id=eq.${encodeURIComponent(collectionId)}&number=eq.${number}`,
    { method: "PATCH", headers: WRITE_HEADERS, body: JSON.stringify(row) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteQuizQuestion(
  collectionId: string,
  number: number
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?quiz_id=eq.${encodeURIComponent(collectionId)}&number=eq.${number}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
}

/**
 * Delete all question rows for one collection from public.quiz_questions_all.
 */
export async function deleteAllQuizQuestions(collectionId: string): Promise<void> {
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}?quiz_id=eq.${encodeURIComponent(collectionId)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!delRes.ok) {
    throw new Error(`delete-all-rows failed for ${collectionId}: ${await delRes.text()}`);
  }
}

/**
 * Reorder questions by renumbering them according to the desired order.
 * `orderedNumbers` is the array of current numbers in their new desired order:
 * orderedNumbers[i] is the current number of the row that should become number (i + 1).
 * Two-phase update (negative temp values → final values) avoids unique-constraint
 * conflicts during the swap.
 */
export async function reorderCollectionQuestions(
  collectionId: string,
  orderedNumbers: number[]
): Promise<void> {
  const tableUrl = `${SUPABASE_URL}/rest/v1/${QUIZ_QUESTIONS_TABLE}`;

  // phase 1: each row → unique negative temp number
  await Promise.all(
    orderedNumbers.map((current, i) =>
      fetch(`${tableUrl}?quiz_id=eq.${encodeURIComponent(collectionId)}&number=eq.${current}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: -(i + 1) }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
      })
    )
  );

  // phase 2: temp negative → final positive
  await Promise.all(
    orderedNumbers.map((_, i) =>
      fetch(`${tableUrl}?quiz_id=eq.${encodeURIComponent(collectionId)}&number=eq.${-(i + 1)}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: i + 1 }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
      })
    )
  );
}

export async function upsertQuizQuestions(
  collectionId: string,
  questions: Array<{
    number: number;
    title: string;
    type?: string;
    options?: Record<string, string> | null;
    answer?: string | string[] | null;
    level?: number | null;
    groupRange?: string | null;
    group_range?: string | null;
    [key: string]: unknown;
  }>
): Promise<{ upserted: number }> {
  const rows = questions
    .filter(q => q.number != null && q.title != null)
    .map(q => {
      // Normalize type: accept 'multiple_choice' → 'multiple', 'single_choice' → 'single'
      const rawType = (q.type as string) ?? "single";
      const normalizedType =
        rawType === "multiple_choice" ? "multiple"
        : rawType === "single_choice" ? "single"
        : rawType;
      const row: Record<string, unknown> = {
        number: q.number,
        title: q.title,
        type: normalizedType,
        options: (q.options as Record<string, string>) ?? null,
        answer: q.answer ?? null,
        level: q.level ?? null,
        group_range: (q.groupRange ?? q.group_range) ?? null,
      };
      return row;
    });

  await doUpsert(collectionId, rows);

  return { upserted: rows.length };
}
