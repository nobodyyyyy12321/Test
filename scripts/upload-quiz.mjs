/**
 * 上傳一或多個 quiz JSON 檔到 Supabase quiz_questions_all 表
 *
 * 用法：
 *   node scripts/upload-quiz.mjs <檔案路徑1> [檔案路徑2] ...
 *
 * 路徑可為相對路徑（相對於專案根目錄）或絕對路徑，例如：
 *   node scripts/upload-quiz.mjs app/data/junior/SeqSeries.json
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

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

const filePaths = process.argv.slice(2);
if (filePaths.length === 0) {
  console.error("用法：node scripts/upload-quiz.mjs <檔案路徑1> [檔案路徑2] ...");
  process.exit(1);
}

async function uploadFile(filePath) {
  const absPath = resolve(ROOT, filePath);
  const data = JSON.parse(readFileSync(absPath, "utf-8"));

  const collectionIds = Object.keys(data.collections);
  if (collectionIds.length === 0) {
    console.warn(`⚠ ${filePath}：找不到 collections，略過`);
    return;
  }

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

for (const filePath of filePaths) {
  await uploadFile(filePath);
}
