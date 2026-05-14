/**
 * Fetch the per-language options/answer/content for every question where
 * languages disagree on the answer key. Writes the result to
 * tmp-disagreements.json so we can inspect it locally.
 *
 * Usage:
 *   node scripts/inspect-answer-disagreements.mjs
 */

import { writeFileSync } from "fs";

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const norm = (a) => (a == null ? null : String(a).trim() || null);

async function fetchAllPaginated(pathAndSelect) {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${pathAndSelect}&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

console.log("[1/2] Fetching (question_id, lang, answer) for all question_i18n rows...");
const minimal = await fetchAllPaginated("question_i18n?select=question_id,lang,answer");
console.log(`  got ${minimal.length} i18n rows`);

const byQ = new Map();
for (const r of minimal) {
  if (!byQ.has(r.question_id)) byQ.set(r.question_id, []);
  byQ.get(r.question_id).push({ lang: r.lang, answer: norm(r.answer) });
}

const disagreeing = [];
for (const [qid, rows] of byQ) {
  const distinct = new Set(rows.map((r) => r.answer).filter((a) => a != null));
  if (distinct.size > 1) disagreeing.push(qid);
}
console.log(`[1/2] ${disagreeing.length} questions have disagreeing answers across languages`);

if (disagreeing.length === 0) {
  writeFileSync("tmp-disagreements.json", "[]");
  console.log("Nothing to inspect. Wrote empty tmp-disagreements.json");
  process.exit(0);
}

console.log("[2/2] Fetching full rows for disagreeing questions...");
const idQuery = disagreeing.map(encodeURIComponent).join(",");
const fullRes = await fetch(
  `${SUPABASE_URL}/rest/v1/question_i18n?select=question_id,lang,answer,options,content&question_id=in.(${idQuery})&order=question_id,lang`,
  { headers }
);
if (!fullRes.ok) throw new Error(`${fullRes.status} ${await fullRes.text()}`);
const fullRows = await fullRes.json();

const grouped = new Map();
for (const r of fullRows) {
  if (!grouped.has(r.question_id)) grouped.set(r.question_id, []);
  grouped.get(r.question_id).push({
    lang: r.lang,
    answer: r.answer,
    options: r.options,
    content: r.content,
  });
}
const out = [...grouped.entries()].map(([question_id, langs]) => ({ question_id, langs }));

writeFileSync("tmp-disagreements.json", JSON.stringify(out, null, 2));
console.log(`Wrote tmp-disagreements.json with ${out.length} questions.`);
