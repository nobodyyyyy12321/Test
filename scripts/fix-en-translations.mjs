/**
 * Fix the 29 English question_i18n rows flagged by audit-translation-drift.mjs.
 *
 * The English rows had drifted into entirely different problems from the
 * zh-TW source. This script rewrites each English row so the content,
 * options, and answer match the zh-TW row (same answer key works because
 * option order is preserved).
 *
 * Usage:
 *   node scripts/fix-en-translations.mjs            # dry run (prints diff)
 *   node scripts/fix-en-translations.mjs --apply    # PATCH the rows
 */

const SUPABASE_URL = "https://wjfslomoaqsglojzybmb.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndqZnNsb21vYXFzZ2xvanp5Ym1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk0ODgzMCwiZXhwIjoyMDkxNTI0ODMwfQ.HwWC6j7TO343TuT8xz-YH1pQNW1YbSQ7Sv8Q3BZ5AE4";

const APPLY = process.argv.includes("--apply");

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=minimal",
};

// 29 hand-authored English translations of the zh-TW source rows.
// Option order matches zh-TW exactly, so `answer` is the same key.
const rows = [
  {
    question_id: "13416fb3-5a4e-46ef-88aa-cd3d09d07edd",
    content: "If $A \\cap B = \\emptyset$, then $A$ and $B$ are called?",
    options: [
      { key: "A", text: "Mutually exclusive" },
      { key: "B", text: "Independent" },
      { key: "C", text: "Complementary" },
      { key: "D", text: "Equal" },
    ],
    answer: "A",
  },
  {
    question_id: "1ccf59cb-6304-43cd-9d44-63d14810267a",
    content: "If $x=-1$ is a solution of $2x+k=5$, then $k=?$",
    options: [
      { key: "A", text: "3" },
      { key: "B", text: "7" },
      { key: "C", text: "-3" },
      { key: "D", text: "-7" },
    ],
    answer: "B",
  },
  {
    question_id: "2020212c-d69a-47dd-9d8a-bc82599a7635",
    content: "If $\\frac{x}{2} + \\frac{y}{3} = 1$, then $3x+2y=?$",
    options: [
      { key: "A", text: "1" },
      { key: "B", text: "6" },
      { key: "C", text: "5" },
      { key: "D", text: "12" },
    ],
    answer: "B",
  },
  {
    question_id: "219daf14-9c2f-4372-b640-0926e684cc2f",
    content:
      "Sum of the first $n$ terms of a geometric sequence ($r \\ne 1$, first term $a$, common ratio $r$)?",
    options: [
      { key: "A", text: "$S_n = \\frac{a(r^n - 1)}{r - 1}$" },
      { key: "B", text: "$S_n = \\frac{a(1 - r^n)}{1 - r}$" },
      { key: "C", text: "$S_n = na$" },
      { key: "D", text: "Both A and B are correct" },
    ],
    answer: "D",
  },
  {
    question_id: "23939aa9-0f0b-4e85-afb6-b5c219268e31",
    content:
      "If the lines $x+y=3$ and $x-y=1$ intersect at $(a, b)$, then $a+b=?$",
    options: [
      { key: "A", text: "3" },
      { key: "B", text: "1" },
      { key: "C", text: "2" },
      { key: "D", text: "4" },
    ],
    answer: "A",
  },
  {
    question_id: "24187ba3-c0d1-4003-a4df-050994690563",
    content: "If one row is multiplied by $k$, the determinant becomes?",
    options: [
      { key: "A", text: "$k$ times the original" },
      { key: "B", text: "$1/k$ times the original" },
      { key: "C", text: "$k^2$ times the original" },
      { key: "D", text: "Unchanged" },
    ],
    answer: "A",
  },
  {
    question_id: "27acf976-09b2-4516-8788-9885f31234b1",
    content: "$\\sum_{k=1}^{\\infty} \\frac{2}{3^k} = ?$",
    options: [
      { key: "A", text: "$\\frac{1}{3}$" },
      { key: "B", text: "$\\frac{2}{3}$" },
      { key: "C", text: "$1$" },
      { key: "D", text: "$2$" },
    ],
    answer: "C",
  },
  {
    question_id: "32bb6897-79d6-4219-b9ab-6a41489be42d",
    content:
      "Solve the system $\\begin{cases} x=y+2 \\\\ 3x+y=14 \\end{cases}$. Find $y=?$",
    options: [
      { key: "A", text: "2" },
      { key: "B", text: "4" },
      { key: "C", text: "3" },
      { key: "D", text: "5" },
    ],
    answer: "A",
  },
  {
    question_id: "358b0735-75c3-4071-a413-534d2f1bd061",
    content: "$\\sum_{k=1}^{n} 1 = ?$",
    options: [
      { key: "A", text: "$0$" },
      { key: "B", text: "$n$" },
      { key: "C", text: "$n+1$" },
      { key: "D", text: "$n-1$" },
    ],
    answer: "B",
  },
  {
    question_id: "3b1fda51-9371-4637-905e-6915796bdbc1",
    content: "$\\sum_{k=1}^{n} k(k+1)(k+2) = ?$",
    options: [
      { key: "A", text: "$\\frac{n(n+1)(n+2)(n+3)}{4}$" },
      { key: "B", text: "$\\frac{n(n+1)(n+2)}{6}$" },
      { key: "C", text: "$\\frac{n^4}{4}$" },
      { key: "D", text: "$n^3$" },
    ],
    answer: "A",
  },
  {
    question_id: "5bfc2518-f585-46db-99cc-47d01d534c92",
    content: "If the inverse of $A$ exists, then $A^{-1}A = ?$",
    options: [
      { key: "A", text: "$0$" },
      { key: "B", text: "$I$" },
      { key: "C", text: "$A$" },
      { key: "D", text: "$2I$" },
    ],
    answer: "B",
  },
  {
    question_id: "5dbf1f37-f6b5-4177-aaa3-16d279cade20",
    content:
      "If $A = \\begin{pmatrix}a&b\\\\0&d\\end{pmatrix}$, then $\\det A = ?$",
    options: [
      { key: "A", text: "$ad$" },
      { key: "B", text: "$ab$" },
      { key: "C", text: "$bd$" },
      { key: "D", text: "$ad-bc$" },
    ],
    answer: "A",
  },
  {
    question_id: "6b800114-b60d-4b36-a297-b2a32c4a958b",
    content: "If both $f$ and $g$ are odd functions, then $f + g$ is?",
    options: [
      { key: "A", text: "Even" },
      { key: "B", text: "Odd" },
      { key: "C", text: "Neither" },
      { key: "D", text: "Depends" },
    ],
    answer: "B",
  },
  {
    question_id: "6cfbe2ac-4f71-4ec5-bff7-5a5bb3fd703f",
    content: "$1^2+2^2+\\cdots+10^2 = ?$",
    options: [
      { key: "A", text: "385" },
      { key: "B", text: "550" },
      { key: "C", text: "385" },
      { key: "D", text: "100" },
    ],
    answer: "A",
  },
  {
    question_id: "6deefd85-504b-4b68-80b4-f77b6965044a",
    content: "Find the sum of all odd numbers from 1 to 100.",
    options: [
      { key: "A", text: "2400" },
      { key: "B", text: "2500" },
      { key: "C", text: "2600" },
      { key: "D", text: "5000" },
    ],
    answer: "B",
  },
  {
    question_id: "6feab7f8-9ea1-490d-b09a-5a3e67ac8490",
    content: "If $1+2+3+\\cdots+n = 210$, then $n = ?$",
    options: [
      { key: "A", text: "19" },
      { key: "B", text: "20" },
      { key: "C", text: "21" },
      { key: "D", text: "22" },
    ],
    answer: "B",
  },
  {
    question_id: "70b8e834-4507-45fc-b8e3-d24c8faa87a5",
    content:
      "If $A$ and $B$ are independent events, what is the relationship between $A^c$ and $B^c$?",
    options: [
      { key: "A", text: "Independent" },
      { key: "B", text: "Mutually exclusive" },
      { key: "C", text: "Dependent" },
      { key: "D", text: "None of the above" },
    ],
    answer: "A",
  },
  {
    question_id: "710956ea-cdc8-4763-81e7-d53f6d371fe2",
    content: "If $p$ and $q$ are both true, then $p \\land q$ is?",
    options: [
      { key: "A", text: "True" },
      { key: "B", text: "False" },
      { key: "C", text: "Unknown" },
      { key: "D", text: "Contradiction" },
    ],
    answer: "A",
  },
  {
    question_id: "79bc74ff-8fe5-4641-a726-d65d4f789c2e",
    content: "Solve $\\frac{2x}{5} - \\frac{x}{2} = 1$. Find $x=?$",
    options: [
      { key: "A", text: "10" },
      { key: "B", text: "-10" },
      { key: "C", text: "20" },
      { key: "D", text: "-20" },
    ],
    answer: "B",
  },
  {
    question_id: "84aa9938-1a3e-44c3-b226-d173237761a8",
    content:
      "The intersection of the line $y=2x-4$ with the $y$-axis is?",
    options: [
      { key: "A", text: "(2, 0)" },
      { key: "B", text: "(0, -4)" },
      { key: "C", text: "(0, 4)" },
      { key: "D", text: "(-4, 0)" },
    ],
    answer: "B",
  },
  {
    question_id: "8a34f436-0137-4d3c-a0bd-bb5ee2631e83",
    content:
      "For the geometric sequence with $a_1 = 81, r = \\frac{1}{3}$, what is the sum of the first 4 terms?",
    options: [
      { key: "A", text: "120" },
      { key: "B", text: "121" },
      { key: "C", text: "118" },
      { key: "D", text: "$\\frac{120}{1}$" },
    ],
    answer: "A",
  },
  {
    question_id: "9e6b4cc1-c0bd-4cfd-8a8c-b4bfa643d0e9",
    content:
      "If $AB = I$ and $A, B$ are $n \\times n$ matrices, then the inverse of $A$ is?",
    options: [
      { key: "A", text: "$A$" },
      { key: "B", text: "$B$" },
      { key: "C", text: "$I$" },
      { key: "D", text: "$0$" },
    ],
    answer: "B",
  },
  {
    question_id: "ab4898c4-465f-42b1-b8ed-664ff43b9807",
    content:
      "If $S_n = ar^n + b$ with $r \\ne 1$ and $a+b=0$, the sequence is?",
    options: [
      { key: "A", text: "Arithmetic" },
      { key: "B", text: "Geometric" },
      { key: "C", text: "Constant" },
      { key: "D", text: "Unrelated" },
    ],
    answer: "B",
  },
  {
    question_id: "c5970af4-2c06-4325-9717-dd93faca05ac",
    content: "If $x+y=k$ passes through the point $(2, 3)$, then $k=?$",
    options: [
      { key: "A", text: "5" },
      { key: "B", text: "1" },
      { key: "C", text: "-1" },
      { key: "D", text: "6" },
    ],
    answer: "A",
  },
  {
    question_id: "cafffda2-f76a-439d-b495-2aff9eb91d20",
    content:
      "If $2x+3y=13$ and $x, y$ are both positive integers, how many solutions are there?",
    options: [
      { key: "A", text: "1" },
      { key: "B", text: "2" },
      { key: "C", text: "3" },
      { key: "D", text: "0" },
    ],
    answer: "B",
  },
  {
    question_id: "d3346346-8e11-472e-a0da-f0e6b4e7ea95",
    content: "If $A^3 = I$ and $A \\ne I$, then $A$ is a?",
    options: [
      { key: "A", text: "Cube-root-of-unity matrix" },
      { key: "B", text: "Diagonal matrix" },
      { key: "C", text: "Zero matrix" },
      { key: "D", text: "Symmetric matrix" },
    ],
    answer: "A",
  },
  {
    question_id: "e6f9c52c-2f68-4074-a191-81860ae9bd45",
    content:
      "If both $f$ and $g$ are odd functions, then $f \\cdot g$ is?",
    options: [
      { key: "A", text: "Even" },
      { key: "B", text: "Odd" },
      { key: "C", text: "Neither" },
      { key: "D", text: "Depends" },
    ],
    answer: "A",
  },
  {
    question_id: "ea851215-2a69-4c16-b7f8-631fcc19217c",
    content:
      "If $a_n = 5 - 2n$, what is the smallest positive integer $n$ such that $a_n < 0$?",
    options: [
      { key: "A", text: "2" },
      { key: "B", text: "3" },
      { key: "C", text: "4" },
      { key: "D", text: "5" },
    ],
    answer: "B",
  },
  {
    question_id: "fc2ca212-201c-455b-aa60-28a45c7f2585",
    content:
      "Solve the system $\\begin{cases} 3x-2y=1 \\\\ 2x+3y=18 \\end{cases}$. Find $x=?$",
    options: [
      { key: "A", text: "3" },
      { key: "B", text: "4" },
      { key: "C", text: "2" },
      { key: "D", text: "5" },
    ],
    answer: "A",
  },
  {
    question_id: "fd3bd317-6e4d-40c1-9234-e0eb56e2089b",
    content: "If $a_n = n(n+1)$, then $a_5 = ?$",
    options: [
      { key: "A", text: "20" },
      { key: "B", text: "25" },
      { key: "C", text: "30" },
      { key: "D", text: "35" },
    ],
    answer: "C",
  },
];

console.log(`Loaded ${rows.length} English translations.`);

if (!APPLY) {
  console.log("\n=== DRY RUN ===\n");
  for (const r of rows) {
    console.log(`[${r.question_id}]  answer=${r.answer}`);
    console.log(`  content: ${r.content}`);
    for (const o of r.options) console.log(`    ${o.key}. ${o.text}`);
    console.log();
  }
  console.log("Re-run with --apply to PATCH question_i18n.");
  process.exit(0);
}

console.log("\n=== APPLYING ===\n");
let ok = 0;
let fail = 0;
for (const r of rows) {
  const url =
    `${SUPABASE_URL}/rest/v1/question_i18n` +
    `?question_id=eq.${encodeURIComponent(r.question_id)}` +
    `&lang=eq.en`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      content: r.content,
      options: r.options,
      answer: r.answer,
    }),
  });
  if (!res.ok) {
    fail++;
    console.error(`  FAIL ${r.question_id}: ${res.status} ${await res.text()}`);
  } else {
    ok++;
    console.log(`  ok   ${r.question_id}`);
  }
}
console.log(`\nDone. ${ok} updated, ${fail} failed.`);
