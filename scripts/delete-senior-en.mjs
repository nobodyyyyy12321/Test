// Delete senior_en quiz questions from Supabase quiz_questions_all
// Only deletes the explicit list of 16 quiz_ids. Does NOT touch categories.

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const QUIZ_IDS = [
  "Binomial_en",
  "CircleEqu_en",
  "Complex_en",
  "ExpLog_en",
  "ExpLogFunc_en",
  "Function_en",
  "LineEqu_en",
  "MathInduction_en",
  "Matrix_en",
  "Permutation_en",
  "PolyFunc_en",
  "Polynomial_en",
  "Probability_en",
  "SeqSeriesSr_en",
  "SetLogic_en",
  "Trigonometry_en",
];

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const inList = `(${QUIZ_IDS.join(",")})`;

// Step 1: count per quiz_id
console.log("=== Pre-delete counts ===");
let total = 0;
for (const qid of QUIZ_IDS) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quiz_questions_all?select=id&quiz_id=eq.${qid}`,
    { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } }
  );
  const range = res.headers.get("content-range");
  const count = parseInt(range.split("/")[1], 10);
  console.log(`  ${qid.padEnd(20)} ${count}`);
  total += count;
}
console.log(`  ${"TOTAL".padEnd(20)} ${total}`);

if (total === 0) {
  console.log("\nNothing to delete. Exiting.");
  process.exit(0);
}

// Step 2: delete
console.log("\n=== Deleting ===");
const delRes = await fetch(
  `${SUPABASE_URL}/rest/v1/quiz_questions_all?quiz_id=in.${inList}`,
  {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation,count=exact" },
  }
);

if (!delRes.ok) {
  const err = await delRes.text();
  console.error(`✗ Delete failed: ${delRes.status} ${err}`);
  process.exit(1);
}

const deleted = await delRes.json().catch(() => []);
console.log(`✓ Deleted ${deleted.length} rows (server returned representation)`);

// Step 3: re-count to confirm
console.log("\n=== Post-delete counts ===");
let remaining = 0;
for (const qid of QUIZ_IDS) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/quiz_questions_all?select=id&quiz_id=eq.${qid}`,
    { headers: { ...headers, Prefer: "count=exact", Range: "0-0" } }
  );
  const range = res.headers.get("content-range");
  const count = parseInt(range.split("/")[1], 10);
  if (count > 0) console.log(`  ${qid.padEnd(20)} ${count} (still present!)`);
  remaining += count;
}
console.log(`  ${"REMAINING".padEnd(20)} ${remaining}`);
