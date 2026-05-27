import { getListById } from "./lists-supabase";

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

const QUIZ_SETS_TABLE = "quiz_sets";
const QUIZ_SET_I18N_TABLE = "quiz_set_i18n";
const QUESTIONS_TABLE = "questions_old";
const QUESTION_I18N_TABLE = "question_i18n";
const CATEGORIES_TABLE = "qsets";

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

type NewSchemaQuestionInput = {
  number: number;
  title: string;
  type?: string;
  options?: Record<string, string> | null;
  answer?: string | string[] | null;
  level?: number | null;
  groupRange?: string | null;
  group_range?: string | null;
};

function normalizeNewSchemaOptions(options?: Record<string, string> | null): Array<{ key: string; text: string }> {
  if (!options) return [];
  return Object.entries(options).map(([key, text]) => ({ key, text: String(text) }));
}

function normalizeNewSchemaAnswer(answer?: string | string[] | null): string {
  if (Array.isArray(answer)) return JSON.stringify(answer);
  if (answer == null) return "";
  return String(answer);
}

function canonicalQuizId(collectionId: string): string {
  return String(collectionId)
    .replace(/_(en|zhcn|ja|ko)$/i, "")
    .replace(/_(zh-tw|zh_tw|zh-cn|zh_cn)$/i, "");
}

function inferQuizLanguage(collectionId: string, language?: string | null): string {
  if (language) return language;
  if (/_en$/i.test(collectionId)) return "en";
  if (/_zhcn$/i.test(collectionId) || /_(zh-cn|zh_cn)$/i.test(collectionId)) return "zh-CN";
  if (/_ja$/i.test(collectionId)) return "ja";
  if (/_ko$/i.test(collectionId)) return "ko";
  return "zh-TW";
}

async function findGlobalQuizSetId(collectionId: string, viewerId?: string | null): Promise<string | null> {
  const candidates = Array.from(new Set([canonicalQuizId(collectionId), collectionId]));

  // Admin/global sets: any quiz_sets row with owner_id IS NULL is public by
  // design (see quiz_sets_global_source_uidx). Categories may live under a
  // dropdown rather than as their own row, so do not require a categories hit.
  for (const candidate of candidates) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?select=id&source_quiz_id=eq.${encodeURIComponent(candidate)}&owner_id=is.null&limit=1`,
      { headers: READ_HEADERS, cache: "no-store" }
    );
    if (!res.ok) throw new Error(await res.text());
    const rows: Array<{ id: string }> = await res.json();
    if (rows[0]?.id) return rows[0].id;
  }

  // Viewer's own personal set: owners can always see their own uploads,
  // regardless of is_public.
  if (viewerId) {
    for (const candidate of candidates) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?select=id&source_quiz_id=eq.${encodeURIComponent(candidate)}&owner_id=eq.${encodeURIComponent(viewerId)}&limit=1`,
        { headers: READ_HEADERS, cache: "no-store" }
      );
      if (!res.ok) throw new Error(await res.text());
      const rows: Array<{ id: string }> = await res.json();
      if (rows[0]?.id) return rows[0].id;
    }
  }

  // Personal sets shared publicly: gated by a categories row whose href matches
  // and is flagged is_public = true.
  const href = `/test/${encodeURIComponent(collectionId)}`;
  const catRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${CATEGORIES_TABLE}?select=owner_id&href=eq.${encodeURIComponent(href)}&is_public=eq.true&owner_id=not.is.null`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!catRes.ok) throw new Error(await catRes.text());
  const catRows: Array<{ owner_id: string | null }> = await catRes.json();
  const publicOwnerIds = Array.from(
    new Set(catRows.map((row) => row.owner_id).filter((id): id is string => !!id))
  );
  for (const ownerId of publicOwnerIds) {
    for (const candidate of candidates) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?select=id&source_quiz_id=eq.${encodeURIComponent(candidate)}&owner_id=eq.${encodeURIComponent(ownerId)}&limit=1`,
        { headers: READ_HEADERS, cache: "no-store" }
      );
      if (!res.ok) throw new Error(await res.text());
      const rows: Array<{ id: string }> = await res.json();
      if (rows[0]?.id) return rows[0].id;
    }
  }

  return null;
}

async function findPersonalQuizSetId(collectionId: string, userId: string): Promise<string | null> {
  const url = `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?select=id&source_quiz_id=eq.${encodeURIComponent(collectionId)}&owner_id=eq.${encodeURIComponent(userId)}&limit=1`;
  const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const rows: Array<{ id: string }> = await res.json();
  return rows[0]?.id ?? null;
}

async function fetchSetQuestions(setId: string): Promise<Map<string, string>> {
  const rows: Array<{ id: string; number: number }> = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?select=id,number&set_id=eq.${encodeURIComponent(setId)}&order=number.asc&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const page: Array<{ id: string; number: number }> = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return new Map(rows.map((row) => [String(row.number), row.id]));
}

type SetQuestionRow = { id: string; number: number; level: number | null; answer: string | null };

async function fetchSetQuestionRows(setId: string): Promise<SetQuestionRow[]> {
  const rows: SetQuestionRow[] = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?select=id,number,level,answer&set_id=eq.${encodeURIComponent(setId)}&order=number.asc&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const page: SetQuestionRow[] = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

function denormalizeNewSchemaOptions(options: unknown): Record<string, string> | null {
  if (!Array.isArray(options)) return null;
  const entries = options
    .map((option) => {
      if (!option || typeof option !== "object") return null;
      const key = typeof (option as { key?: unknown }).key === "string" ? (option as { key: string }).key : null;
      const text = typeof (option as { text?: unknown }).text === "string" ? (option as { text: string }).text : null;
      return key && text !== null ? [key, text] : null;
    })
    .filter(Boolean) as Array<[string, string]>;
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function denormalizeNewSchemaAnswer(answer: unknown): string | string[] | null {
  if (typeof answer !== "string") return null;
  const trimmed = answer.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {}
  }
  return trimmed;
}

function inferNewSchemaType(number: number, options: Record<string, string> | null, answer: string | string[] | null): string {
  if (!Number.isInteger(number)) return "group";
  if (!options || Object.keys(options).length === 0) return "fill";
  if (Array.isArray(answer)) return "multiple";
  return "single";
}

async function findQuestionIdByNumber(setId: string, number: number): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?select=id&set_id=eq.${encodeURIComponent(setId)}&number=eq.${number}&limit=1`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(await res.text());
  const rows: Array<{ id: string }> = await res.json();
  return rows[0]?.id ?? null;
}

async function fetchQuestionI18n(questionId: string, language: string): Promise<{
  content: string;
  group_content: string | null;
  options: unknown;
} | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=content,group_content,options&question_id=eq.${encodeURIComponent(questionId)}&lang=eq.${encodeURIComponent(language)}&limit=1`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] ?? null;
}

async function fetchSetQuestionRowsForRead(
  setId: string,
  revalidate: number | false = 3600,
  cacheTag?: string
): Promise<SetQuestionRow[]> {
  const rows: SetQuestionRow[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?select=id,number,level,answer&set_id=eq.${encodeURIComponent(setId)}&order=number.asc&limit=1000&offset=${offset}`,
      {
        headers: READ_HEADERS,
        ...(revalidate === false
          ? { cache: "no-store" as const }
          : { next: { revalidate, tags: cacheTag ? [cacheTag] : undefined } }),
      }
    );
    if (!res.ok) throw new Error(await res.text());
    const page: SetQuestionRow[] = await res.json();
    rows.push(...page);
    if (page.length < 1000) break;
    offset += 1000;
  }
  return rows;
}

async function fetchQuestionI18nMap(
  questionIds: string[],
  language: string,
  revalidate: number | false = 3600,
  cacheTag?: string
): Promise<Map<string, { content: string; group_content: string | null; options: unknown }>> {
  const preferred = new Map<string, { content: string; group_content: string | null; options: unknown }>();
  const fallback = new Map<string, { content: string; group_content: string | null; options: unknown }>();
  const fetchInit = revalidate === false
    ? { headers: READ_HEADERS, cache: "no-store" as const }
    : { headers: READ_HEADERS, next: { revalidate, tags: cacheTag ? [cacheTag] : undefined } };

  for (let i = 0; i < questionIds.length; i += 200) {
    const batch = questionIds.slice(i, i + 200);
    const batchQuery = batch.map((id) => encodeURIComponent(id)).join(",");

    const preferredRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=question_id,content,group_content,options&lang=eq.${encodeURIComponent(language)}&question_id=in.(${batchQuery})`,
      fetchInit
    );
    if (!preferredRes.ok) throw new Error(await preferredRes.text());
    const preferredRows: Array<{ question_id: string; content: string; group_content: string | null; options: unknown }> = await preferredRes.json();
    for (const row of preferredRows) {
      preferred.set(row.question_id, {
        content: row.content,
        group_content: row.group_content,
        options: row.options,
      });
    }

    if (language !== "zh-TW") {
      const missingIds = batch.filter((id) => !preferred.has(id));
      if (missingIds.length > 0) {
        const fallbackRes = await fetch(
          `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=question_id,content,group_content,options&lang=eq.zh-TW&question_id=in.(${missingIds.map((id) => encodeURIComponent(id)).join(",")})`,
          fetchInit
        );
        if (!fallbackRes.ok) throw new Error(await fallbackRes.text());
        const fallbackRows: Array<{ question_id: string; content: string; group_content: string | null; options: unknown }> = await fallbackRes.json();
        for (const row of fallbackRows) {
          fallback.set(row.question_id, {
            content: row.content,
            group_content: row.group_content,
            options: row.options,
          });
        }
      }
    }
  }

  const merged = new Map<string, { content: string; group_content: string | null; options: unknown }>();
  for (const id of questionIds) {
    const row = preferred.get(id) ?? fallback.get(id);
    if (row) merged.set(id, row);
  }
  return merged;
}

function rowToNewSchemaQuestionRow(
  question: SetQuestionRow,
  i18n: { content: string; group_content: string | null; options: unknown }
): QuizQuestionRow {
  const options = denormalizeNewSchemaOptions(i18n.options);
  const answer = denormalizeNewSchemaAnswer(question.answer);
  const type = inferNewSchemaType(question.number, options, answer);
  return {
    number: question.number,
    title: i18n.content,
    type,
    options,
    answer,
    level: question.level,
    group_range: i18n.group_content,
    group_content: i18n.group_content,
    content: i18n.content,
  };
}

async function postRows(table: string, rows: object[], onConflict?: string): Promise<any[]> {
  if (rows.length === 0) return [];
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const prefer = onConflict ? "resolution=merge-duplicates,return=representation" : "return=representation";
  const res = await fetch(url, {
    method: "POST",
    headers: { ...WRITE_HEADERS, Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function upsertPersonalQuizQuestionsNewSchema(opts: {
  userId: string;
  collectionId: string;
  language: string;
  displayName: string;
  questions: NewSchemaQuestionInput[];
}): Promise<{ setId: string; upserted: number }> {
  const { userId, collectionId, language, displayName, questions } = opts;

  let setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) {
    const insertedSets = await postRows(QUIZ_SETS_TABLE, [{
      owner_id: userId,
      source_quiz_id: collectionId,
      category_id: null,
      problems_per_test: 10,
      shuffle_problems: false,
    }]);
    setId = insertedSets[0]?.id;
  }
  if (!setId) throw new Error(`Failed to resolve quiz set for ${collectionId}`);

  await postRows(QUIZ_SET_I18N_TABLE, [{
    set_id: setId,
    lang: language,
    title: displayName,
  }], "set_id,lang");

  const existingQuestionIds = await fetchSetQuestions(setId);
  const missingQuestions = questions.filter((question) => !existingQuestionIds.has(String(question.number)));

  for (let i = 0; i < missingQuestions.length; i += 200) {
    const batch = missingQuestions.slice(i, i + 200).map((question) => ({
      set_id: setId,
      number: question.number,
      level: question.level ?? null,
      group_id: null,
      answer: normalizeNewSchemaAnswer(question.answer ?? null),
    }));
    const insertedQuestions = await postRows(QUESTIONS_TABLE, batch, "set_id,number");
    for (const row of insertedQuestions) {
      existingQuestionIds.set(String(row.number), row.id);
    }
  }

  const i18nRows = questions
    .map((question) => {
      const questionId = existingQuestionIds.get(String(question.number));
      if (!questionId) return null;
      return {
        question_id: questionId,
        lang: language,
        group_content: question.type === "group" ? question.title : null,
        content: question.title,
        options: normalizeNewSchemaOptions(question.options ?? null),
        is_machine_translated: language !== "zh-TW",
        is_reviewed: false,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  for (let i = 0; i < i18nRows.length; i += 200) {
    await postRows(QUESTION_I18N_TABLE, i18nRows.slice(i, i + 200), "question_id,lang");
  }

  return { setId, upserted: questions.length };
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FlatQuestionRow = {
  id: string;
  number: number;
  content: string;
  q_type: string;
  options: Record<string, string> | null;
  answer: unknown;
  level: number | null;
};

export async function fetchFlatRowsByCategoryId(
  categoryId: string,
  filters?: { levels?: number[] | null; numbers?: number[] | null }
): Promise<FlatQuestionRow[]> {
  const url = `${SUPABASE_URL}/rest/v1/questions?qsets_id=eq.${encodeURIComponent(categoryId)}&order=number.asc&select=id,number,content,q_type,options,answer,level`;
  const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(await res.text());
  const rows: FlatQuestionRow[] = await res.json();
  const levelSet = filters?.levels?.length ? new Set(filters.levels) : null;
  const numberSet = filters?.numbers?.length ? new Set(filters.numbers.map(String)) : null;
  return rows.filter((r) => {
    if (numberSet && !numberSet.has(String(r.number))) return false;
    if (levelSet) return r.level != null && levelSet.has(r.level);
    return true;
  });
}

function flatRowToQuizQuestionRow(r: FlatQuestionRow): QuizQuestionRow {
  return {
    number: Number(r.number),
    title: r.content,
    type: r.q_type,
    options: r.options ?? null,
    answer: typeof r.answer === "string"
      ? r.answer
      : Array.isArray(r.answer)
        ? r.answer.map(String)
        : r.answer == null ? null : String(r.answer),
    level: r.level ?? null,
    group_range: null,
    group_content: null,
    content: r.content,
  };
}

export async function fetchPersonalQuizQuestionsFresh(
  userId: string,
  collectionId: string,
  language: string
): Promise<QuizQuestionRow[]> {
  // UUID collectionId → new flat schema (questions.qsets_id = categories.id)
  if (UUID_RE.test(collectionId)) {
    const rows = await fetchFlatRowsByCategoryId(collectionId);
    return rows.map(flatRowToQuizQuestionRow);
  }

  const setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) return [];

  const questionRows = await fetchSetQuestionRows(setId);
  if (questionRows.length === 0) return [];

  const questionIds = questionRows.map((row) => row.id);
  const i18nByQuestionId = new Map<string, {
    content: string;
    group_content: string | null;
    options: unknown;
  }>();

  for (let i = 0; i < questionIds.length; i += 200) {
    const batch = questionIds.slice(i, i + 200);
    const encodedIds = batch.map((id) => encodeURIComponent(id)).join(",");
    const url = `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=question_id,content,group_content,options&lang=eq.${encodeURIComponent(language)}&question_id=in.(${encodedIds})`;

    const res = await fetch(url, { headers: READ_HEADERS, cache: "no-store" });
    if (!res.ok) throw new Error(await res.text());
    const rows: Array<{ question_id: string; content: string; group_content: string | null; options: unknown }> = await res.json();
    for (const row of rows) i18nByQuestionId.set(row.question_id, row);
  }

  return questionRows
    .map((question) => {
      const i18n = i18nByQuestionId.get(question.id);
      if (!i18n) return null;
      const options = denormalizeNewSchemaOptions(i18n.options);
      const answer = denormalizeNewSchemaAnswer(question.answer);
      return {
        number: question.number,
        title: i18n.content,
        type: inferNewSchemaType(question.number, options, answer),
        options,
        answer,
        level: question.level,
        group_range: i18n.group_content,
        group_content: i18n.group_content,
      } satisfies QuizQuestionRow;
    })
    .filter(Boolean) as QuizQuestionRow[];
}

async function updateFlatQuestion(
  categoryId: string,
  number: number,
  updates: {
    title?: string;
    type?: string;
    options?: Record<string, string> | null;
    answer?: string | string[] | null;
    level?: number | null;
  }
): Promise<void> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.title !== undefined) patch.content = updates.title;
  if (updates.type !== undefined) patch.q_type = updates.type;
  if (updates.options !== undefined) patch.options = updates.options ?? {};
  if (updates.answer !== undefined) patch.answer = updates.answer;
  if (updates.level !== undefined) patch.level = updates.level;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?qsets_id=eq.${encodeURIComponent(categoryId)}&number=eq.${number}`,
    { method: "PATCH", headers: WRITE_HEADERS, body: JSON.stringify(patch) }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function deleteFlatQuestion(categoryId: string, number: number): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/questions?qsets_id=eq.${encodeURIComponent(categoryId)}&number=eq.${number}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
}

async function reorderFlatQuestions(categoryId: string, orderedNumbers: number[]): Promise<void> {
  const tableUrl = `${SUPABASE_URL}/rest/v1/questions`;
  // Two-pass renumbering: first push existing numbers to negative space to dodge
  // the (qsets_id, number) unique constraint, then assign final positive numbers.
  await Promise.all(
    orderedNumbers.map((current, i) =>
      fetch(`${tableUrl}?qsets_id=eq.${encodeURIComponent(categoryId)}&number=eq.${current}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: -(i + 1) }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); })
    )
  );
  await Promise.all(
    orderedNumbers.map((_, i) =>
      fetch(`${tableUrl}?qsets_id=eq.${encodeURIComponent(categoryId)}&number=eq.${-(i + 1)}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: i + 1 }),
      }).then(async (r) => { if (!r.ok) throw new Error(await r.text()); })
    )
  );
}

export async function updatePersonalQuizQuestion(
  userId: string,
  collectionId: string,
  language: string,
  number: number,
  updates: {
    title?: string;
    type?: string;
    options?: Record<string, string> | null;
    answer?: string | string[] | null;
    level?: number | null;
    group_content?: string | null;
  }
): Promise<void> {
  if (UUID_RE.test(collectionId)) {
    return updateFlatQuestion(collectionId, number, updates);
  }

  const setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) throw new Error(`No personal quiz set found for ${collectionId}`);
  const questionId = await findQuestionIdByNumber(setId, number);
  if (!questionId) throw new Error(`No question ${number} found for ${collectionId}`);

  const questionPatch: Record<string, unknown> = {};
  if (updates.level !== undefined) questionPatch.level = updates.level;
  if (updates.answer !== undefined) questionPatch.answer = normalizeNewSchemaAnswer(updates.answer);
  if (Object.keys(questionPatch).length > 0) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?id=eq.${encodeURIComponent(questionId)}`,
      { method: "PATCH", headers: WRITE_HEADERS, body: JSON.stringify(questionPatch) }
    );
    if (!res.ok) throw new Error(await res.text());
  }

  const existingI18n = await fetchQuestionI18n(questionId, language);
  const mergedI18n = {
    question_id: questionId,
    lang: language,
    content: updates.title ?? existingI18n?.content ?? "",
    group_content:
      updates.group_content !== undefined
        ? updates.group_content
        : (existingI18n?.group_content ?? null),
    options:
      updates.options !== undefined
        ? normalizeNewSchemaOptions(updates.options)
        : (existingI18n?.options ?? []),
    is_machine_translated: language !== "zh-TW",
    is_reviewed: false,
  };

  await postRows(QUESTION_I18N_TABLE, [mergedI18n], "question_id,lang");
}

export async function deletePersonalQuizQuestion(
  userId: string,
  collectionId: string,
  language: string,
  number: number
): Promise<void> {
  if (UUID_RE.test(collectionId)) {
    return deleteFlatQuestion(collectionId, number);
  }

  const setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) throw new Error(`No personal quiz set found for ${collectionId}`);
  const questionId = await findQuestionIdByNumber(setId, number);
  if (!questionId) throw new Error(`No question ${number} found for ${collectionId}`);

  const i18nDeleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?question_id=eq.${encodeURIComponent(questionId)}&lang=eq.${encodeURIComponent(language)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!i18nDeleteRes.ok) throw new Error(await i18nDeleteRes.text());

  const remainingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=question_id&question_id=eq.${encodeURIComponent(questionId)}&limit=1`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!remainingRes.ok) throw new Error(await remainingRes.text());
  const remainingRows: Array<{ question_id: string }> = await remainingRes.json();
  if (remainingRows.length > 0) return;

  const questionDeleteRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?id=eq.${encodeURIComponent(questionId)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!questionDeleteRes.ok) throw new Error(await questionDeleteRes.text());
}

export async function reorderPersonalCollectionQuestions(
  userId: string,
  collectionId: string,
  orderedNumbers: number[]
): Promise<void> {
  if (UUID_RE.test(collectionId)) {
    return reorderFlatQuestions(collectionId, orderedNumbers);
  }

  const setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) throw new Error(`No personal quiz set found for ${collectionId}`);

  const tableUrl = `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}`;

  await Promise.all(
    orderedNumbers.map((current, i) =>
      fetch(`${tableUrl}?set_id=eq.${encodeURIComponent(setId)}&number=eq.${current}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: -(i + 1) }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
      })
    )
  );

  await Promise.all(
    orderedNumbers.map((_, i) =>
      fetch(`${tableUrl}?set_id=eq.${encodeURIComponent(setId)}&number=eq.${-(i + 1)}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: i + 1 }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
      })
    )
  );
}

export async function fetchQuizQuestions(opts: {
  collectionId: string;
  levels?: number[] | null;
  numbers?: number[] | null;
  revalidate?: number | false;
  language?: string | null;
  viewerId?: string | null;
}): Promise<QuizQuestionRow[]> {
  const { collectionId, levels, numbers, revalidate = 3600, language, viewerId } = opts;

  if (numbers !== undefined && numbers !== null && numbers.length === 0) return [];

  const setId = await findGlobalQuizSetId(collectionId, viewerId);
  if (!setId) return [];

  const cacheTag = `quiz-questions-${canonicalQuizId(collectionId)}`;
  const targetLanguage = inferQuizLanguage(collectionId, language);
  const levelSet = levels?.length ? new Set(levels) : null;
  const numberSet = numbers?.length ? new Set(numbers.map((value) => String(value))) : null;

  const questionRows = await fetchSetQuestionRowsForRead(setId, revalidate, cacheTag);
  const filteredQuestions = questionRows.filter((question) => {
    if (numberSet && !numberSet.has(String(question.number))) return false;
    if (!levelSet) return true;
    return !Number.isInteger(question.number) || (question.level != null && levelSet.has(question.level));
  });
  if (filteredQuestions.length === 0) return [];

  const i18nMap = await fetchQuestionI18nMap(
    filteredQuestions.map((question) => question.id),
    targetLanguage,
    revalidate,
    cacheTag
  );

  return filteredQuestions
    .map((question) => {
      const i18n = i18nMap.get(question.id);
      return i18n ? rowToNewSchemaQuestionRow(question, i18n) : null;
    })
    .filter(Boolean) as QuizQuestionRow[];
}

/**
 * Returns true if this collection already has a global quiz_set.
 */
export async function collectionTableExists(collectionId: string): Promise<boolean> {
  return (await findGlobalQuizSetId(collectionId)) !== null;
}

export async function fetchAllQuizQuestionsFresh(
  collectionId: string
): Promise<QuizQuestionRow[]> {
  return fetchQuizQuestions({ collectionId, revalidate: false });
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
  const setId = await findGlobalQuizSetId(collectionId);
  if (!setId) throw new Error(`No quiz set found for ${collectionId}`);
  const questionId = await findQuestionIdByNumber(setId, number);
  if (!questionId) throw new Error(`No question ${number} found for ${collectionId}`);

  const questionPatch: Record<string, unknown> = {};
  if (updates.level !== undefined) questionPatch.level = updates.level;
  if (updates.answer !== undefined) questionPatch.answer = normalizeNewSchemaAnswer(updates.answer);
  if (Object.keys(questionPatch).length > 0) {
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?id=eq.${encodeURIComponent(questionId)}`,
      { method: "PATCH", headers: WRITE_HEADERS, body: JSON.stringify(questionPatch) }
    );
    if (!patchRes.ok) throw new Error(await patchRes.text());
  }

  const language = inferQuizLanguage(collectionId);
  const existingI18n = await fetchQuestionI18n(questionId, language);
  await postRows(QUESTION_I18N_TABLE, [{
    question_id: questionId,
    lang: language,
    content: updates.title ?? existingI18n?.content ?? "",
    group_content: updates.group_range !== undefined ? updates.group_range : (existingI18n?.group_content ?? null),
    options: updates.options !== undefined ? normalizeNewSchemaOptions(updates.options) : (existingI18n?.options ?? []),
    is_machine_translated: language !== "zh-TW",
    is_reviewed: false,
  }], "question_id,lang");
}

export async function deleteQuizQuestion(
  collectionId: string,
  number: number
): Promise<void> {
  const setId = await findGlobalQuizSetId(collectionId);
  if (!setId) throw new Error(`No quiz set found for ${collectionId}`);
  const questionId = await findQuestionIdByNumber(setId, number);
  if (!questionId) throw new Error(`No question ${number} found for ${collectionId}`);

  const language = inferQuizLanguage(collectionId);
  const deleteI18nRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?question_id=eq.${encodeURIComponent(questionId)}&lang=eq.${encodeURIComponent(language)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!deleteI18nRes.ok) throw new Error(await deleteI18nRes.text());

  const remainingRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTION_I18N_TABLE}?select=question_id&question_id=eq.${encodeURIComponent(questionId)}&limit=1`,
    { headers: READ_HEADERS, cache: "no-store" }
  );
  if (!remainingRes.ok) throw new Error(await remainingRes.text());
  const remainingRows: Array<{ question_id: string }> = await remainingRes.json();
  if (remainingRows.length > 0) return;

  const deleteQuestionRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}?id=eq.${encodeURIComponent(questionId)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!deleteQuestionRes.ok) throw new Error(await deleteQuestionRes.text());
}

/**
 * Delete the global quiz_set for a collection, cascading to questions/i18n.
 */
export async function deleteAllQuizQuestions(collectionId: string): Promise<void> {
  const setId = await findGlobalQuizSetId(collectionId);
  if (!setId) return;
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?id=eq.${encodeURIComponent(setId)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!delRes.ok) {
    throw new Error(`delete-all-rows failed for ${collectionId}: ${await delRes.text()}`);
  }
}

export async function deletePersonalQuizSet(userId: string, collectionId: string): Promise<void> {
  const setId = await findPersonalQuizSetId(collectionId, userId);
  if (!setId) return;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${QUIZ_SETS_TABLE}?id=eq.${encodeURIComponent(setId)}`,
    { method: "DELETE", headers: WRITE_HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
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
  const setId = await findGlobalQuizSetId(collectionId);
  if (!setId) throw new Error(`No quiz set found for ${collectionId}`);
  const tableUrl = `${SUPABASE_URL}/rest/v1/${QUESTIONS_TABLE}`;

  await Promise.all(
    orderedNumbers.map((current, i) =>
      fetch(`${tableUrl}?set_id=eq.${encodeURIComponent(setId)}&number=eq.${current}`, {
        method: "PATCH",
        headers: WRITE_HEADERS,
        body: JSON.stringify({ number: -(i + 1) }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
      })
    )
  );
  await Promise.all(
    orderedNumbers.map((_, i) =>
      fetch(`${tableUrl}?set_id=eq.${encodeURIComponent(setId)}&number=eq.${-(i + 1)}`, {
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
  }>,
  options?: { language?: string | null; title?: string; problemsPerTest?: number; shuffleProblems?: boolean }
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

  const sourceQuizId = canonicalQuizId(collectionId);
  const language = inferQuizLanguage(collectionId, options?.language);
  const title = options?.title ?? collectionId;

  let setId = await findGlobalQuizSetId(collectionId);
  if (!setId) {
    const insertedSets = await postRows(QUIZ_SETS_TABLE, [{
      owner_id: null,
      source_quiz_id: sourceQuizId,
      category_id: null,
      problems_per_test: options?.problemsPerTest ?? 10,
      shuffle_problems: options?.shuffleProblems ?? false,
    }]);
    setId = insertedSets[0]?.id;
  }
  if (!setId) throw new Error(`Failed to resolve quiz set for ${collectionId}`);

  await postRows(QUIZ_SET_I18N_TABLE, [{
    set_id: setId,
    lang: language,
    title,
  }], "set_id,lang");

  const questionIdByNumber = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((row) => ({
      set_id: setId,
      number: row.number,
      level: row.level ?? null,
      group_id: null,
      answer: normalizeNewSchemaAnswer(row.answer as string | string[] | null),
    }));
    const upsertedQuestions = await postRows(QUESTIONS_TABLE, batch, "set_id,number");
    for (const row of upsertedQuestions) {
      questionIdByNumber.set(String(row.number), row.id);
    }
  }

  const i18nRows = rows.map((row) => {
    const questionId = questionIdByNumber.get(String(row.number));
    if (!questionId) throw new Error(`Missing question id for ${collectionId} #${row.number}`);
    return {
      question_id: questionId,
      lang: language,
      group_content: row.type === "group" ? row.title : null,
      content: row.title,
      options: normalizeNewSchemaOptions(row.options as Record<string, string> | null),
      is_machine_translated: language !== "zh-TW",
      is_reviewed: false,
    };
  });

  for (let i = 0; i < i18nRows.length; i += 200) {
    await postRows(QUESTION_I18N_TABLE, i18nRows.slice(i, i + 200), "question_id,lang");
  }

  return { upserted: rows.length };
}

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
