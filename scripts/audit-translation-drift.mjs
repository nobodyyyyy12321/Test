/**
 * Detect translation drift: questions where a non-zh-TW row appears to be
 * a different problem rather than a translation of the zh-TW row.
 *
 * Heuristic: build a "math fingerprint" of each row by extracting:
 *   - LaTeX expressions ($...$ and $$...$$)
 *   - Numeric/expression-like option texts (digits, fractions, signs, x, y, etc.)
 * Compare zh-TW vs. other-language fingerprint via Jaccard overlap.
 * Low overlap = likely drift. Pure-prose questions naturally score low and
 * will produce some false positives, flagged for human review.
 *
 * Writes tmp-translation-drift.json sorted by lowest overlap.
 *
 * Usage:
 *   node scripts/audit-translation-drift.mjs
 */

import { writeFileSync } from "fs";

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
};

const OVERLAP_THRESHOLD = 0.3;
const PROSE_FINGERPRINT_MIN = 2;

function extractLatex(text) {
  if (!text) return [];
  const out = [];
  const re = /\$\$?([^$]+?)\$\$?/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1].replace(/\s+/g, ""));
  }
  return out;
}

function extractNumbers(text) {
  if (!text) return [];
  const out = [];
  const re = /-?\d+(?:\.\d+)?(?:\/\d+)?/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[0]);
  return out;
}

function fingerprint(content, options) {
  const set = new Set();
  for (const expr of extractLatex(content)) set.add(`L:${expr}`);
  for (const n of extractNumbers(content)) set.add(`N:${n}`);
  if (Array.isArray(options)) {
    for (const o of options) {
      const txt = o && typeof o === "object" ? o.text : o;
      if (txt == null) continue;
      const norm = String(txt).trim();
      for (const expr of extractLatex(norm)) set.add(`L:${expr}`);
      for (const n of extractNumbers(norm)) set.add(`N:${n}`);
    }
  }
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  const inter = [...a].filter((x) => b.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return inter / union;
}

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

console.log("Fetching all question_i18n rows (content + options)...");
const all = await fetchAllPaginated(
  "question_i18n?select=question_id,lang,answer,content,options"
);
console.log(`  got ${all.length} rows`);

const byQ = new Map();
for (const r of all) {
  if (!byQ.has(r.question_id)) byQ.set(r.question_id, new Map());
  byQ.get(r.question_id).set(r.lang, r);
}

const flagged = [];
let comparedPairs = 0;
let proseSkipped = 0;

for (const [qid, langs] of byQ) {
  const zh = langs.get("zh-TW");
  if (!zh) continue;
  const zhFp = fingerprint(zh.content, zh.options);

  for (const [lang, row] of langs) {
    if (lang === "zh-TW") continue;
    const otherFp = fingerprint(row.content, row.options);
    comparedPairs++;

    if (zhFp.size < PROSE_FINGERPRINT_MIN && otherFp.size < PROSE_FINGERPRINT_MIN) {
      proseSkipped++;
      continue;
    }

    const score = jaccard(zhFp, otherFp);
    if (score < OVERLAP_THRESHOLD) {
      flagged.push({
        question_id: qid,
        lang,
        overlap: Number(score.toFixed(3)),
        zh_fingerprint_size: zhFp.size,
        other_fingerprint_size: otherFp.size,
        answers_agree: (zh.answer || "").trim() === (row.answer || "").trim(),
        zh_content: zh.content,
        other_content: row.content,
        zh_options: zh.options,
        other_options: row.options,
      });
    }
  }
}

flagged.sort((a, b) => a.overlap - b.overlap);

console.log(`Compared ${comparedPairs} (zh-TW, other-lang) pairs`);
console.log(`Skipped ${proseSkipped} pure-prose pairs (insufficient math signal)`);
console.log(`Flagged ${flagged.length} pairs with overlap < ${OVERLAP_THRESHOLD}`);

const summary = {
  threshold: OVERLAP_THRESHOLD,
  total_pairs_compared: comparedPairs,
  prose_skipped: proseSkipped,
  flagged_count: flagged.length,
  flagged: flagged,
};

writeFileSync("tmp-translation-drift.json", JSON.stringify(summary, null, 2));
console.log(`Wrote tmp-translation-drift.json`);

const byLang = new Map();
const byAgreement = { both_drift_and_disagree: 0, drift_but_agree: 0 };
for (const f of flagged) {
  byLang.set(f.lang, (byLang.get(f.lang) || 0) + 1);
  if (f.answers_agree) byAgreement.drift_but_agree++;
  else byAgreement.both_drift_and_disagree++;
}
console.log("\nBreakdown by language:");
for (const [lang, n] of byLang) console.log(`  ${lang}: ${n}`);
console.log("\nAnswer-key intersection:");
console.log(`  drift AND answers disagree: ${byAgreement.both_drift_and_disagree}`);
console.log(`  drift BUT answers happen to agree (hidden until now): ${byAgreement.drift_but_agree}`);
