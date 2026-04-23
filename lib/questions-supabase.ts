const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

export type QuizQuestionRow = {
  number: number;
  title: string;
  type: string;
  options: Record<string, string> | null;
  answer: string | string[];
  level: number | null;
  category: string | null;
  group_content: string | null;
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
    let url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?order=number.asc`;
    if (levels?.length) url += `&level=in.(${levels.join(",")})`;
    if (batch !== null) url += `&number=in.(${batch.join(",")})`;

    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: revalidate === false ? { revalidate: 0 } : { revalidate, tags: [`quiz-questions-${collectionId}`] },
    });
    if (!res.ok) throw new Error(`Supabase fetch error: ${await res.text()}`);
    chunks.push(await res.json());
  }

  return chunks.flat();
}

async function createCollectionTable(collectionId: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/create_collection_table_if_not_exists`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ p_table_name: collectionId }),
  });
  if (!res.ok) throw new Error(`建表失敗 (${collectionId}): ${await res.text()}`);
  // wait briefly for PostgREST to reload schema
  await new Promise(r => setTimeout(r, 1500));
}

async function doUpsert(collectionId: string, rows: object[]): Promise<void> {
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}`, {
      method: "POST",
      headers: { ...HEADERS, Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) {
      const text = await res.text();
      // 404 means the table doesn't exist yet
      if (res.status === 404) throw Object.assign(new Error(text), { tableNotFound: true });
      throw new Error(`Supabase upsert error: ${text}`);
    }
  }
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
    category?: string | null;
    groupContent?: string | null;
    group_content?: string | null;
    [key: string]: unknown;
  }>
): Promise<{ upserted: number }> {
  const rows = questions
    .filter(q => q.number != null && q.title != null)
    .map(q => ({
      number: q.number,
      title: q.title,
      type: (q.type as string) ?? "single",
      options: (q.options as Record<string, string>) ?? null,
      answer: q.answer ?? null,
      level: q.level ?? null,
      category: (q.category as string) ?? null,
      group_content: (q.groupContent ?? q.group_content) ?? null,
    }));

  try {
    await doUpsert(collectionId, rows);
  } catch (err: any) {
    if (!err.tableNotFound) throw err;
    // table doesn't exist — create it and retry once
    await createCollectionTable(collectionId);
    await doUpsert(collectionId, rows);
  }

  return { upserted: rows.length };
}
