/**
 * Fetch the zh-TW source rows for every question_id flagged in
 * tmp-translation-drift.json. Writes tmp-en-translation-source.json
 * with the data needed to author correct English translations.
 */

import { readFileSync, writeFileSync } from "fs";

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const drift = JSON.parse(readFileSync("tmp-translation-drift.json", "utf8"));
const ids = drift.flagged.map((f) => f.question_id);
console.log(`Fetching zh-TW source for ${ids.length} question_ids...`);

const idQuery = ids.map(encodeURIComponent).join(",");
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/question_i18n?select=question_id,content,options,answer&lang=eq.zh-TW&question_id=in.(${idQuery})`,
  { headers }
);
if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
const rows = await res.json();
console.log(`  got ${rows.length} zh-TW rows`);

const out = rows.map((r) => ({
  question_id: r.question_id,
  zh_content: r.content,
  zh_options: r.options,
  zh_answer: r.answer,
}));

writeFileSync("tmp-en-translation-source.json", JSON.stringify(out, null, 2));
console.log(`Wrote tmp-en-translation-source.json`);
