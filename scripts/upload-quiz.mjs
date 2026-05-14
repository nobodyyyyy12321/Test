/**
 * 上傳一或多個 quiz JSON 檔到 Supabase 新 i18n 四表
 * 可選擇同時在 categories 表新增一筆分類資料
 *
 * 用法：
 *   node scripts/upload-quiz.mjs <檔案路徑1> [檔案路徑2] ... [選項]
 *
 * 選項：
 *   --parentId <uuid>        將 category 掛在此父節點下
 *   --problemsPerTest <n>    每次測驗題數限制（整數）
 *   --shuffle                啟用題目隨機排序（預設 null = 隨機）
 *   --no-shuffle             固定題目順序（shuffleProblems = false）
 *   --language <lang>        語言標籤（預設 zh-TW）
 *   --position <n>           排列順序（預設 0）
 *   --userId <id>            個人上傳使用者 ID（寫入 categories.owner_id）
 *   --category-only          只新增 category，不上傳題目
 *   --new-schema             已預設寫入新 i18n 表（保留相容，不需另外指定）
 *
 * 範例：
 *   node scripts/upload-quiz.mjs app/data/senior/TrigSenior.json --parentId abc-123 --problemsPerTest 10 --shuffle
 *   node scripts/upload-quiz.mjs app/data/junior/SeqSeries.json app/data/junior/QuaEqu.json
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const CATEGORIES_TABLE = "categories";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// ── 解析 CLI 參數 ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const filePaths = [];
let parentId = null;
let problemsPerTest = null;
let shuffleProblems = null; // null = 不設定（資料庫預設隨機）
let language = "zh-TW";
let position = 0;
let categoryOnly = false;
let newSchema = true;
let userId = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--parentId" && args[i + 1]) {
    parentId = args[++i];
  } else if (args[i] === "--problemsPerTest" && args[i + 1]) {
    problemsPerTest = parseInt(args[++i], 10);
  } else if (args[i] === "--shuffle") {
    shuffleProblems = true;
  } else if (args[i] === "--no-shuffle") {
    shuffleProblems = false;
  } else if (args[i] === "--language" && args[i + 1]) {
    language = args[++i];
  } else if (args[i] === "--position" && args[i + 1]) {
    position = parseInt(args[++i], 10);
  } else if (args[i] === "--userId" && args[i + 1]) {
    userId = args[++i];
  } else if (args[i] === "--category-only") {
    categoryOnly = true;
  } else if (args[i] === "--new-schema") {
    // Kept for backward compatibility; new-schema upload is now always on.
    newSchema = true;
  } else if (!args[i].startsWith("--")) {
    filePaths.push(args[i]);
  }
}

if (filePaths.length === 0) {
  console.error("用法：node scripts/upload-quiz.mjs <檔案路徑1> [檔案路徑2] ... [--parentId <id>] [--problemsPerTest <n>] [--shuffle|--no-shuffle]");
  process.exit(1);
}

function newUUID() {
  return crypto.randomUUID();
}

function personalCategoryId(ownerId, lang, quizId) {
  return `personal:${ownerId}:${lang}:${quizId}`;
}

// ── New i18n schema helpers ──────────────────────────────────────────────────

/** Convert options object {"A":"text",...} to canonical array [{key,text},...] */
function normalizeOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  return Object.entries(options).map(([key, text]) => ({ key, text: String(text) }));
}

async function findExistingSetId(sourceQuizId, ownerId) {
  let url = `${SUPABASE_URL}/rest/v1/quiz_sets?select=id&source_quiz_id=eq.${encodeURIComponent(sourceQuizId)}&limit=1`;
  if (ownerId) {
    url += `&owner_id=eq.${encodeURIComponent(ownerId)}`;
  } else {
    url += `&owner_id=is.null`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error("✗ quiz_sets lookup failed:", await res.text());
    return null;
  }
  const rows = await res.json().catch(() => []);
  return rows[0]?.id ?? null;
}

/**
 * Upload one collection into quiz_sets + quiz_set_i18n + questions + question_i18n.
 * Safe to re-run with owner-aware identity: (owner_id, source_quiz_id).
 */
async function uploadNewSchema(quizId, rawQuestions, setName, lang, categoryId, ownerId) {
  const reprHeaders = { ...headers, Prefer: "resolution=merge-duplicates,return=representation" };

  // 1. Resolve existing set by (owner_id, source_quiz_id), otherwise insert.
  let setId = await findExistingSetId(quizId, ownerId);
  if (!setId) {
    const setRow = {
      owner_id: ownerId ?? null,
      source_quiz_id: quizId,
      category_id: ownerId ? null : (categoryId ?? null),
      problems_per_test: problemsPerTest ?? 10,
      shuffle_problems: shuffleProblems ?? false,
    };
    const setRes = await fetch(`${SUPABASE_URL}/rest/v1/quiz_sets`, {
      method: "POST",
      headers: reprHeaders,
      body: JSON.stringify([setRow]),
    });
    if (!setRes.ok) { console.error("✗ quiz_sets insert failed:", await setRes.text()); return; }
    const [setResult] = await setRes.json();
    setId = setResult.id;
  }

  // 2. Upsert quiz_set_i18n (key = set_id + lang)
  await fetch(
    `${SUPABASE_URL}/rest/v1/quiz_set_i18n?on_conflict=set_id,lang`,
    { method: "POST", headers: reprHeaders, body: JSON.stringify([{ set_id: setId, lang, title: setName }]) }
  );

  // 3. Insert questions (key = set_id + number)
  const BATCH = 200;
  let totalInserted = 0;

  for (let i = 0; i < rawQuestions.length; i += BATCH) {
    const batch = rawQuestions.slice(i, i + BATCH);

    const qRows = batch.map((q) => ({
      set_id: setId,
      number: q.number,
      level: q.level ?? null,
      group_id: null,
      answer: typeof q.answer === "string" ? q.answer : JSON.stringify(q.answer ?? ""),
    }));

    const qRes = await fetch(
      `${SUPABASE_URL}/rest/v1/questions?on_conflict=set_id,number`,
      { method: "POST", headers: reprHeaders, body: JSON.stringify(qRows) }
    );
    if (!qRes.ok) { console.error("✗ questions upsert failed:", await qRes.text()); continue; }
    const insertedQs = await qRes.json();

    // 4. Upsert question_i18n (key = question_id + lang)
    const i18nRows = insertedQs.map((ins, idx) => {
      const q = batch[idx];
      return {
        question_id: ins.id,
        lang,
        group_content: q.group_content ?? null,
        content: q.title ?? "",
        options: normalizeOptions(q.options),
        is_machine_translated: lang !== "zh-TW",
        is_reviewed: false,
      };
    });

    const i18nRes = await fetch(
      `${SUPABASE_URL}/rest/v1/question_i18n?on_conflict=question_id,lang`,
      { method: "POST", headers: reprHeaders, body: JSON.stringify(i18nRows) }
    );
    if (!i18nRes.ok) { console.error("✗ question_i18n upsert failed:", await i18nRes.text()); continue; }
    totalInserted += batch.length;
  }

  console.log(`✓ [new-schema] ${quizId}: set_id=${setId}, owner=${ownerId ?? "global"}, ${totalInserted} questions`);
}

// ────────────────────────────────────────────────────────────────────────────

async function upsertCategory(categoryRow) {
  const catHeaders = { ...headers, Prefer: "resolution=merge-duplicates,return=representation" };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${CATEGORIES_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: catHeaders,
    body: JSON.stringify([categoryRow]),
  });
  if (res.ok) {
    const rows = await res.json().catch(() => []);
    const id = rows[0]?.id ?? categoryRow.id;
    console.log(`✓ category 已新增／更新（id = ${id}，name = ${categoryRow.name}）`);
  } else {
    const err = await res.text();
    console.error(`✗ category 操作失敗:`, err);
  }
}

async function uploadFile(filePath) {
  const absPath = resolve(ROOT, filePath);
  const data = JSON.parse(readFileSync(absPath, "utf-8"));

  const collectionIds = Object.keys(data.collections);
  if (collectionIds.length === 0) {
    console.warn(`⚠ ${filePath}：找不到 collections，略過`);
    return;
  }

  // ── 上傳題目（新 i18n 四表）──────────────────────────────────────────────
  if (!categoryOnly) {
    for (const quizId of collectionIds) {
      const rawQuestions = data.collections[quizId] ?? [];
      console.log(`準備上傳 ${rawQuestions.length} 題到新 i18n 表（quiz_id = ${quizId}，來源：${filePath}）`);
      const catEntry = Array.isArray(data.categories) ? data.categories[0] : null;
      const setName = catEntry?.name ?? quizId;
      await uploadNewSchema(quizId, rawQuestions, setName, language, null, userId);
    }
  }

  // ── 新增 category（global 或 personal）────────────────────────────────────
  if (userId) {
    const catEntry = Array.isArray(data.categories) ? data.categories[0] : null;
    const name = catEntry?.name ?? collectionIds[0];
    for (const quizId of collectionIds) {
      const categoryRow = {
        id: personalCategoryId(userId, language, quizId),
        parent_id: parentId,
        language,
        owner_id: userId,
        name,
        href: `/test/${quizId}`,
        position,
        dropdown: [],
        dropdown_align: null,
        ...(problemsPerTest !== null && { problems_per_test: problemsPerTest }),
        ...(shuffleProblems !== null && { shuffle_problems: shuffleProblems }),
      };
      console.log(`\n新增 personal category（categories.owner_id）：`, JSON.stringify(categoryRow, null, 2));
      await upsertCategory(categoryRow);
    }
  } else if (parentId !== null || problemsPerTest !== null || shuffleProblems !== null || categoryOnly) {
    // 從 JSON 的 categories 陣列取名稱與 href
    const catEntry = Array.isArray(data.categories) ? data.categories[0] : null;
    const name = catEntry?.name ?? collectionIds[0];
    const href = catEntry?.href ?? null;

    const categoryRow = {
      id: newUUID(),
      parent_id: parentId,
      name,
      href,
      language,
      position,
      dropdown: [],
      dropdown_align: null,
      ...(problemsPerTest !== null && { problems_per_test: problemsPerTest }),
      ...(shuffleProblems !== null && { shuffle_problems: shuffleProblems }),
    };

    console.log(`\n新增 category：`, JSON.stringify(categoryRow, null, 2));
    await upsertCategory(categoryRow);
  }

  // ── category-only 時仍建立 set metadata（不含 questions）──────────────────
  if (categoryOnly) {
    const catEntry = Array.isArray(data.categories) ? data.categories[0] : null;
    const name = catEntry?.name ?? collectionIds[0];
    for (const quizId of collectionIds) {
      await uploadNewSchema(quizId, [], name, language, null, userId);
    }
  }
}

for (const filePath of filePaths) {
  await uploadFile(filePath);
}
