/**
 * 上傳一或多個 quiz JSON 檔到 Supabase quiz_questions_all 表
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
 *   --category-only          只新增 category，不上傳題目
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

const TABLE = "quiz_questions_all";
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
  } else if (args[i] === "--category-only") {
    categoryOnly = true;
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

  // ── 上傳題目 ──────────────────────────────────────────────────────────────
  if (!categoryOnly) {
    for (const quizId of collectionIds) {
      const questions = data.collections[quizId].map((q) => ({
        quiz_id: quizId,
        number: q.number,
        title: q.title,
        type: q.type,
        options: q.options ?? null,
        answer: q.answer ?? null,
        level: q.level ?? null,
        group_range: q.group_range ?? null,
        group_content: q.group_content ?? null,
        source_schema: "public",
        source_table: quizId,
      }));

      console.log(`準備上傳 ${questions.length} 題（quiz_id = ${quizId}，來源：${filePath}）`);

      const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: "POST",
        headers,
        body: JSON.stringify(questions),
      });

      if (res.ok) {
        console.log(`✓ 成功上傳 ${questions.length} 題（${quizId}）`);
      } else {
        const err = await res.text();
        console.error(`✗ 上傳失敗（${quizId}）:`, err);
      }
    }
  }

  // ── 新增 category ─────────────────────────────────────────────────────────
  if (parentId !== null || problemsPerTest !== null || shuffleProblems !== null || categoryOnly) {
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
}

for (const filePath of filePaths) {
  await uploadFile(filePath);
}
