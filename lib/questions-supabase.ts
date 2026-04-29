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
    const baseUrl = () => {
      let url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?order=number.asc&limit=1000`;
      if (levels?.length) url += `&level=in.(${levels.join(",")})`;
      if (batch !== null) url += `&number=in.(${batch.join(",")})`;
      return url;
    };

    let offset = 0;
    while (true) {
      const url = `${baseUrl()}&offset=${offset}`;
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, Prefer: "count=none" },
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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?on_conflict=number`, {
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

export async function fetchAllQuizQuestionsFresh(
  collectionId: string
): Promise<QuizQuestionRow[]> {
  const out: QuizQuestionRow[] = [];
  let offset = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?order=number.asc&limit=1000&offset=${offset}`;
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) return out;
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
    group_content?: string | null;
  }
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (updates.title !== undefined) row.title = updates.title;
  if (updates.type !== undefined) row.type = updates.type;
  if (updates.options !== undefined) row.options = updates.options;
  if (updates.answer !== undefined) row.answer = updates.answer;
  if (updates.level !== undefined) row.level = updates.level;
  if (updates.group_content !== undefined) row.group_content = updates.group_content;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?number=eq.${number}`,
    { method: "PATCH", headers: HEADERS, body: JSON.stringify(row) }
  );
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteQuizQuestion(
  collectionId: string,
  number: number
): Promise<void> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?number=eq.${number}`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!res.ok) throw new Error(await res.text());
}

/**
 * Drop a collection's underlying table entirely. Requires this Postgres function:
 *
 *   create or replace function drop_collection_table_if_exists(p_table_name text)
 *   returns void
 *   language plpgsql
 *   security definer
 *   as $$
 *   begin
 *     execute format('drop table if exists public.%I cascade', p_table_name);
 *     perform pg_notify('pgrst', 'reload schema');
 *   end
 *   $$;
 *
 * If the RPC isn't installed yet, falls back to deleting every row in the table
 * (table shell remains, but data is gone).
 */
export async function deleteAllQuizQuestions(collectionId: string): Promise<void> {
  // 1) try drop-table RPC — fully removes the collection from Supabase
  const dropRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/drop_collection_table_if_exists`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ p_table_name: collectionId }),
  });
  if (dropRes.ok) return;

  // 404 means the RPC isn't installed → fall back to row-level delete
  if (dropRes.status !== 404) {
    const errText = await dropRes.text().catch(() => "");
    // If RPC exists but fails, surface a clear error rather than silently retrying
    if (!errText.includes("Could not find the function")) {
      throw new Error(`drop_collection_table_if_exists failed: ${errText}`);
    }
  }

  // 2) fallback: delete every row. Supabase REST requires a filter; "not.is.null" on a non-null column matches all rows.
  const delRes = await fetch(
    `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}?number=not.is.null`,
    { method: "DELETE", headers: HEADERS }
  );
  if (!delRes.ok && delRes.status !== 404) {
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
  const tableUrl = `${SUPABASE_URL}/rest/v1/${encodeURIComponent(collectionId)}`;

  // phase 1: each row → unique negative temp number
  await Promise.all(
    orderedNumbers.map((current, i) =>
      fetch(`${tableUrl}?number=eq.${current}`, {
        method: "PATCH",
        headers: HEADERS,
        body: JSON.stringify({ number: -(i + 1) }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
      })
    )
  );

  // phase 2: temp negative → final positive
  await Promise.all(
    orderedNumbers.map((_, i) =>
      fetch(`${tableUrl}?number=eq.${-(i + 1)}`, {
        method: "PATCH",
        headers: HEADERS,
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
    groupContent?: string | null;
    group_content?: string | null;
    [key: string]: unknown;
  }>
): Promise<{ upserted: number }> {
  const rows = questions
    .filter(q => q.number != null && q.title != null)
    .map(q => {
      const row: Record<string, unknown> = {
        number: q.number,
        title: q.title,
        type: (q.type as string) ?? "single",
        options: (q.options as Record<string, string>) ?? null,
        answer: q.answer ?? null,
        level: q.level ?? null,
        group_content: (q.groupContent ?? q.group_content) ?? null,
      };
      return row;
    });

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
