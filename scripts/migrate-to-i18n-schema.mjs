/**
 * Migrate existing quiz_questions_all + categories data into the new i18n tables:
 *   quiz_sets, quiz_set_i18n, questions, question_i18n
 *
 * SAFE TO RE-RUN: uses upsert / ON CONFLICT DO NOTHING.
 * Does NOT delete old data from quiz_questions_all or categories.
 *
 * Usage:
 *   node scripts/migrate-to-i18n-schema.mjs
 *   node scripts/migrate-to-i18n-schema.mjs --dry-run
 */

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const DRY_RUN = process.argv.includes("--dry-run");

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};
const headersMinimal = { ...headers, Prefer: "return=minimal" };

// ── helpers ──────────────────────────────────────────────────────────────────

async function supabaseGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} failed: ${await res.text()}`);
  return res.json();
}

async function supabasePost(table, rows, onConflict = null) {
  if (DRY_RUN || rows.length === 0) return [];
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const prefer = onConflict
    ? "resolution=merge-duplicates,return=representation"
    : "return=representation";
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers, Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`POST ${table} failed: ${await res.text()}`);
  return res.json();
}

/** Convert options object {"A":"text",...} OR array to canonical array format */
function normalizeOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options; // already new format
  return Object.entries(options).map(([key, text]) => ({ key, text: String(text) }));
}

/** Extract scalar answer string from jsonb value (may be stored as "\"A\"" or "A") */
function normalizeAnswer(answer) {
  if (answer === null || answer === undefined) return "";
  if (typeof answer === "string") return answer;
  // jsonb might decode to an object/array; stringify and strip quotes
  const s = JSON.stringify(answer);
  return s.replace(/^"|"$/g, "");
}

/** Infer language from quiz_id suffix when no category match found */
function inferLang(quizId) {
  if (/_en$/i.test(quizId)) return "en";
  if (/_zhcn$/i.test(quizId)) return "zh-CN";
  if (/_ja$/i.test(quizId)) return "ja";
  if (/_ko$/i.test(quizId)) return "ko";
  return "zh-TW";
}

// ── fetch all rows from a table (handles pagination) ─────────────────────────

async function fetchAll(table, select = "*", pageSize = 1000) {
  const rows = [];
  let from = 0;
  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${from}`,
      { headers: { ...headers, "Range-Unit": "items" } }
    );
    if (!res.ok) throw new Error(`fetchAll ${table} failed: ${await res.text()}`);
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

// ── main ─────────────────────────────────────────────────────────────────────

console.log(DRY_RUN ? "=== DRY RUN ===" : "=== MIGRATING ===");

// 1. Load categories (for title, language, problems_per_test, shuffle_problems, id)
console.log("\n[1/4] Loading categories...");
const categories = await fetchAll(
  "categories",
  "id,href,name,language,problems_per_test,shuffle_problems"
);
// Build map: href → category row
const catByHref = new Map(categories.map((c) => [c.href, c]));
console.log(`  Found ${categories.length} categories`);

// 2. Load all quiz_questions_all rows
console.log("\n[2/4] Loading quiz_questions_all...");
const allQuestions = await fetchAll(
  "quiz_questions_all",
  "id,quiz_id,number,title,type,options,answer,level,group_range,group_content"
);
console.log(`  Found ${allQuestions.length} questions`);

// Group by quiz_id
const byQuizId = new Map();
for (const q of allQuestions) {
  if (!byQuizId.has(q.quiz_id)) byQuizId.set(q.quiz_id, []);
  byQuizId.get(q.quiz_id).push(q);
}
console.log(`  Distinct quiz_ids: ${byQuizId.size}`);

// 3. Upsert quiz_sets + quiz_set_i18n
console.log("\n[3/4] Upserting quiz_sets and quiz_set_i18n...");

// Load existing quiz_sets to avoid duplicating (keyed by source_quiz_id)
const existingSets = await fetchAll("quiz_sets", "id,source_quiz_id");
const setIdByQuizId = new Map(existingSets.map((s) => [s.source_quiz_id, s.id]));

let setsCreated = 0;
let setsSkipped = 0;

for (const [quizId, questions] of byQuizId) {
  if (setIdByQuizId.has(quizId)) {
    setsSkipped++;
    continue; // already migrated
  }

  const href = `/test/${quizId}`;
  const cat = catByHref.get(href) ?? null;
  const lang = cat?.language ?? inferLang(quizId);
  const setName = cat?.name ?? quizId;

  const setRow = {
    source_quiz_id: quizId,
    category_id: cat?.id ?? null,
    problems_per_test: cat?.problems_per_test ?? 10,
    shuffle_problems: cat?.shuffle_problems ?? false,
  };

  if (DRY_RUN) {
    console.log(`  [DRY] Would create set: ${quizId} (lang=${lang}, name="${setName}", ${questions.length} q)`);
    setsCreated++;
    continue;
  }

  // Insert quiz_sets row
  const [setResult] = await supabasePost("quiz_sets", [setRow], "source_quiz_id");
  const setId = setResult.id;
  setIdByQuizId.set(quizId, setId);

  // Insert quiz_set_i18n row
  await supabasePost(
    "quiz_set_i18n",
    [{ set_id: setId, lang, title: setName }],
    "set_id,lang"
  );

  setsCreated++;
  process.stdout.write(`  ✓ ${quizId} (set_id=${setId})\n`);
}

console.log(`  Created: ${setsCreated}, Skipped (already exist): ${setsSkipped}`);

// 4. Upsert questions + question_i18n
console.log("\n[4/4] Upserting questions and question_i18n...");

let qCreated = 0;
let qSkipped = 0;
const BATCH = 200; // insert in batches

for (const [quizId, rawQuestions] of byQuizId) {
  const setId = setIdByQuizId.get(quizId);
  if (!setId && !DRY_RUN) {
    console.warn(`  ⚠ No set_id for ${quizId}, skipping`);
    continue;
  }

  const href = `/test/${quizId}`;
  const cat = catByHref.get(href) ?? null;
  const lang = cat?.language ?? inferLang(quizId);

  if (DRY_RUN) {
    console.log(`  [DRY] Would upsert ${rawQuestions.length} questions for ${quizId}`);
    qCreated += rawQuestions.length;
    continue;
  }

  // Fetch existing questions for this set to find those already migrated
  const existingQ = await fetchAll(
    `questions?set_id=eq.${setId}`,
    "id,number"
  );
  const existingNumbers = new Set(existingQ.map((q) => String(q.number)));

  const newQuestions = rawQuestions.filter((q) => !existingNumbers.has(String(q.number)));

  if (newQuestions.length === 0) {
    qSkipped += rawQuestions.length;
    continue;
  }

  // Insert questions rows in batches
  for (let i = 0; i < newQuestions.length; i += BATCH) {
    const batch = newQuestions.slice(i, i + BATCH);
    const questionRows = batch.map((q) => ({
      set_id: setId,
      number: q.number,
      level: q.level ?? null,
      group_id: null,
    }));

    const inserted = await supabasePost("questions", questionRows);

    // Build question_i18n rows from inserted UUIDs
    const i18nRows = inserted.map((ins, idx) => {
      const q = batch[idx];
      return {
        question_id: ins.id,
        lang,
        group_content: q.group_content ?? null,
        content: q.title ?? "",
        options: normalizeOptions(q.options),
        answer: normalizeAnswer(q.answer),
        is_machine_translated: lang !== "zh-TW", // source data is zh-TW; others are translated
        is_reviewed: false,
      };
    });

    await supabasePost("question_i18n", i18nRows);
    qCreated += batch.length;
  }

  qSkipped += rawQuestions.length - newQuestions.length;
  console.log(`  ✓ ${quizId}: ${newQuestions.length} questions migrated`);
}

console.log(`  Created: ${qCreated}, Skipped (already exist): ${qSkipped}`);
console.log("\n=== DONE ===");
if (DRY_RUN) console.log("(No data was written — dry run)");
