/**
 * Find every question where questions.answer differs from the
 * corresponding question_i18n.answer (per language). Helps diagnose
 * "old answer" issues after Phase A backfill diverged from later edits.
 */

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

async function paged(path) {
  const out = [];
  let off = 0;
  while (true) {
    const url = `${SUPABASE_URL}/rest/v1/${path}&limit=1000&offset=${off}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
    const rows = await r.json();
    if (!Array.isArray(rows)) throw new Error(`Unexpected: ${JSON.stringify(rows)}`);
    out.push(...rows);
    if (rows.length < 1000) break;
    off += 1000;
  }
  return out;
}

console.log("Fetching questions + question_i18n in parallel...");
const [qs, qi] = await Promise.all([
  paged("questions?select=id,answer"),
  paged("question_i18n?select=question_id,lang,answer"),
]);
console.log(`  ${qs.length} questions, ${qi.length} i18n rows`);

const qById = new Map(qs.map((r) => [r.id, r.answer]));
const norm = (a) => (a == null ? "" : String(a).trim());

const diverged = [];
for (const r of qi) {
  const qa = norm(qById.get(r.question_id));
  const ia = norm(r.answer);
  if (ia !== "" && qa !== ia) {
    diverged.push({
      question_id: r.question_id,
      q_answer: qa,
      lang: r.lang,
      i18n_answer: ia,
    });
  }
}

console.log(`\nDiverged (non-empty i18n.answer != questions.answer): ${diverged.length}`);

const byLang = new Map();
for (const d of diverged) byLang.set(d.lang, (byLang.get(d.lang) || 0) + 1);
console.log("By language:", Object.fromEntries(byLang));

console.log("\nFirst 20:");
console.log(JSON.stringify(diverged.slice(0, 20), null, 2));
