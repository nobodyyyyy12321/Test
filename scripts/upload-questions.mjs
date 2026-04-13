import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const EXAM_NAME = "國文學測115";

const all = JSON.parse(
  readFileSync(join(__dirname, "../app/data/國文學測115.json"), "utf-8")
);

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

async function insert(table, rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (res.ok) {
    console.log(`✓ 上傳 ${rows.length} 筆到 ${table}`);
  } else {
    const err = await res.text();
    console.error(`✗ ${table} 上傳失敗:`, err);
  }
}

// 閱讀文章段落
const groups = all
  .filter((item) => item.type === "group")
  .map((item) => ({
    exam_name: EXAM_NAME,
    group_id: String(item.id),
    content: item.content,
  }));

// 選擇題（單選 + 多選）
const questions = all
  .filter((item) => item.type === "single_choice" || item.type === "multiple_choice")
  .map((item) => ({
    exam_name: EXAM_NAME,
    number: typeof item.id === "number" ? item.id : parseInt(item.id),
    title: item.title,
    type: item.type,
    options: item.options,
    answer: item.answer ?? null,
  }));

console.log(`閱讀段落: ${groups.length} 筆，選擇題: ${questions.length} 筆`);

if (groups.length > 0) await insert("question_groups", groups);
if (questions.length > 0) await insert("questions", questions);
