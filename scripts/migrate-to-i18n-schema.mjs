/**
 * Migrate existing quiz_questions_all + categories + pcategories data into the new i18n tables:
 *   quiz_sets, quiz_set_i18n, questions, question_i18n
 *
 * Ownership mapping:
 * - categories -> global sets (owner_id = null)
 * - pcategories -> personal sets (owner_id = user_id)
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
const GLOBAL_OWNER_KEY = "__global__";

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

function setMapKey(quizId, ownerId) {
  return `${ownerId ?? GLOBAL_OWNER_KEY}::${quizId}`;
}

// ── fetch all rows from a table (handles pagination) ─────────────────────────

async function fetchAll(table, select = "*", pageSize = 1000, extraQuery = "") {
  const rows = [];
  let from = 0;
  while (true) {
    const querySuffix = extraQuery ? `&${extraQuery}` : "";
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${from}${querySuffix}`,
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

// 1. Load categories (global metadata)
console.log("\n[1/5] Loading categories...");
const categories = await fetchAll(
  "categories",
  "id,href,name,language,problems_per_test,shuffle_problems"
);
// Build map: href → category row
const catByHref = new Map(categories.map((c) => [c.href, c]));
console.log(`  Found ${categories.length} categories`);

// 2. Load personal category ownership from pcategories
console.log("\n[2/5] Loading pcategories...");
const pcategories = await fetchAll(
  "pcategories",
  "user_id,quiz_id,language,name"
);
const personalByQuizId = new Map();
for (const row of pcategories) {
  if (!personalByQuizId.has(row.quiz_id)) personalByQuizId.set(row.quiz_id, []);
  personalByQuizId.get(row.quiz_id).push(row);
}
console.log(`  Found ${pcategories.length} personal category rows`);

// 3. Load all quiz_questions_all rows
console.log("\n[3/5] Loading quiz_questions_all...");
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

// Build owner-scoped migration targets (global + personal).
const targets = [];
for (const quizId of byQuizId.keys()) {
  const href = `/test/${quizId}`;
  const cat = catByHref.get(href) ?? null;

  // Global target (always create to preserve current category behavior).
  targets.push({
    quizId,
    ownerId: null,
    categoryId: cat?.id ?? null,
    lang: cat?.language ?? inferLang(quizId),
    setName: cat?.name ?? quizId,
    problemsPerTest: cat?.problems_per_test ?? 10,
    shuffleProblems: cat?.shuffle_problems ?? false,
  });

  // Personal targets from pcategories.
  const pRows = personalByQuizId.get(quizId) ?? [];
  for (const p of pRows) {
    targets.push({
      quizId,
      ownerId: p.user_id,
      categoryId: null,
      lang: p.language ?? inferLang(quizId),
      setName: p.name ?? quizId,
      problemsPerTest: cat?.problems_per_test ?? 10,
      shuffleProblems: cat?.shuffle_problems ?? false,
    });
  }
}
console.log(`  Migration targets: ${targets.length} (global + personal)`);

// 4. Upsert quiz_sets + quiz_set_i18n
console.log("\n[4/5] Upserting quiz_sets and quiz_set_i18n...");

// Load existing quiz_sets keyed by (owner_id, source_quiz_id).
const existingSets = await fetchAll("quiz_sets", "id,source_quiz_id,owner_id");
const setIdByKey = new Map(existingSets.map((s) => [setMapKey(s.source_quiz_id, s.owner_id), s.id]));

let setsCreated = 0;
let setsSkipped = 0;
let setTitlesUpserted = 0;

for (const target of targets) {
  const key = setMapKey(target.quizId, target.ownerId);
  let setId = setIdByKey.get(key);

  if (DRY_RUN) {
    const questions = byQuizId.get(target.quizId) ?? [];
    const scope = target.ownerId ? `owner=${target.ownerId}` : "global";
    console.log(`  [DRY] Would upsert set: ${target.quizId} (${scope}, lang=${target.lang}, name="${target.setName}", ${questions.length} q)`);
    if (!setId) setsCreated++;
    else setsSkipped++;
    setTitlesUpserted++;
    continue;
  }

  // source_quiz_id now uses owner-scoped uniqueness; avoid on_conflict with partial indexes.
  if (!setId) {
    const setRow = {
      owner_id: target.ownerId,
      source_quiz_id: target.quizId,
      category_id: target.categoryId,
      problems_per_test: target.problemsPerTest,
      shuffle_problems: target.shuffleProblems,
    };
    const [setResult] = await supabasePost("quiz_sets", [setRow]);
    setId = setResult.id;
    setIdByKey.set(key, setId);
    setsCreated++;
  } else {
    setsSkipped++;
  }

  // Ensure title row exists for target language.
  await supabasePost(
    "quiz_set_i18n",
    [{ set_id: setId, lang: target.lang, title: target.setName }],
    "set_id,lang"
  );
  setTitlesUpserted++;

  const scope = target.ownerId ? `owner=${target.ownerId}` : "global";
  process.stdout.write(`  ✓ ${target.quizId} (${scope}) set_id=${setId}\n`);
}

console.log(`  Created: ${setsCreated}, Existing: ${setsSkipped}, Title upserts: ${setTitlesUpserted}`);

// 5. Upsert questions + question_i18n
console.log("\n[5/5] Upserting questions and question_i18n...");

let qCreated = 0;
let i18nUpserts = 0;
const BATCH = 200; // insert in batches

for (const target of targets) {
  const key = setMapKey(target.quizId, target.ownerId);
  const setId = setIdByKey.get(key);
  if (!setId && !DRY_RUN) {
    console.warn(`  ⚠ No set_id for ${target.quizId}, skipping`);
    continue;
  }

  const rawQuestions = byQuizId.get(target.quizId) ?? [];
  const lang = target.lang;

  if (DRY_RUN) {
    const scope = target.ownerId ? `owner=${target.ownerId}` : "global";
    console.log(`  [DRY] Would upsert ${rawQuestions.length} questions for ${target.quizId} (${scope}, lang=${lang})`);
    qCreated += rawQuestions.length;
    i18nUpserts += rawQuestions.length;
    continue;
  }

  // Fetch existing questions to preserve IDs and support re-runs after partial failures.
  const existingQ = await fetchAll(
    "questions",
    "id,number",
    1000,
    `set_id=eq.${encodeURIComponent(setId)}`
  );
  const questionIdByNumber = new Map(existingQ.map((q) => [String(q.number), q.id]));

  const missingQuestions = rawQuestions.filter((q) => !questionIdByNumber.has(String(q.number)));

  // Insert only missing question rows.
  for (let i = 0; i < missingQuestions.length; i += BATCH) {
    const batch = missingQuestions.slice(i, i + BATCH);
    const questionRows = batch.map((q) => ({
      set_id: setId,
      number: q.number,
      level: q.level ?? null,
      group_id: null,
    }));

    const inserted = await supabasePost("questions", questionRows);
    inserted.forEach((ins) => {
      questionIdByNumber.set(String(ins.number), ins.id);
    });
    qCreated += batch.length;
  }

  // Upsert i18n rows for every question to recover from partial runs.
  const i18nAll = rawQuestions
    .map((q) => {
      const questionId = questionIdByNumber.get(String(q.number));
      if (!questionId) return null;
      return {
        question_id: questionId,
        lang,
        group_content: q.group_content ?? null,
        content: q.title ?? "",
        options: normalizeOptions(q.options),
        answer: normalizeAnswer(q.answer),
        is_machine_translated: lang !== "zh-TW",
        is_reviewed: false,
      };
    })
    .filter(Boolean);

  for (let i = 0; i < i18nAll.length; i += BATCH) {
    const batch = i18nAll.slice(i, i + BATCH);
    await supabasePost("question_i18n", batch, "question_id,lang");
    i18nUpserts += batch.length;
  }

  const scope = target.ownerId ? `owner=${target.ownerId}` : "global";
  console.log(`  ✓ ${target.quizId} (${scope}, lang=${lang}): ${missingQuestions.length} question rows inserted, ${i18nAll.length} i18n rows upserted`);
}

console.log(`  Question rows inserted: ${qCreated}, i18n rows upserted: ${i18nUpserts}`);
console.log("\n=== DONE ===");
if (DRY_RUN) console.log("(No data was written — dry run)");
