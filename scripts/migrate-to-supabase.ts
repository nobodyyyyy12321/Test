/**
 * Migrate user data from Firebase Firestore → Supabase
 *
 * Collections migrated: users, lists, follows, articles
 *
 * Run AFTER applying scripts/supabase-schema.sql in the Supabase SQL editor.
 * Usage:  npx tsx scripts/migrate-to-supabase.ts
 */

import fs from "fs";
import path from "path";

// ── load .env.local ──────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const m = line.match(/^\s*([^#][^=\s]*)\s*=\s*(.*)\s*$/);
      if (!m) return;
      let val = m[2] || "";
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      )
        val = val.slice(1, -1);
      process.env[m[1]] = val;
    });
}

import { createClient } from "@supabase/supabase-js";
import { getFirestoreDB } from "../lib/firebase-admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!,
  process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!
);

// ── helpers ──────────────────────────────────────────────────────────────────

function toTs(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function upsertBatch<T extends object>(
  table: string,
  rows: T[],
  chunkSize = 200
) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk);
    if (error) {
      console.error(`[${table}] upsert error (offset ${i}):`, error.message);
      throw error;
    }
  }
  console.log(`  ✓ ${rows.length} rows → ${table}`);
}

// ── migrate users ─────────────────────────────────────────────────────────────
async function migrateUsers() {
  console.log("\n[users]");
  const db = getFirestoreDB();
  const snap = await db.collection("users").get();
  console.log(`  Firestore docs: ${snap.size}`);

  const userRows: object[] = [];
  const recordRows: object[] = [];
  const recitationRows: object[] = [];
  const seenNames = new Set<string>();
  const seenEmails = new Set<string>();

  for (const doc of snap.docs) {
    const d = doc.data();
    const name = d.name ?? "";
    const email = d.email ? d.email.toLowerCase() : null;

    if (seenNames.has(name)) {
      console.warn(`  skip duplicate name="${name}" (doc ${doc.id})`);
      continue;
    }
    if (email && seenEmails.has(email)) {
      console.warn(`  skip duplicate email="${email}" (doc ${doc.id})`);
      continue;
    }
    if (name) seenNames.add(name);
    if (email) seenEmails.add(email);

    userRows.push({
      id: doc.id,
      name: d.name ?? "",
      email: d.email ? d.email.toLowerCase() : null,
      password_hash: d.passwordHash ?? null,
      email_verified: d.emailVerified ?? false,
      verification_token: d.verificationToken ?? null,
      verification_expires: toTs(d.verificationExpires),
      bio: d.bio ?? null,
      avatar_url: d.avatarUrl ?? null,
      social_links: d.socialLinks ?? {},
      recitations_public: d.recitationsPublic ?? false,
      email_public: d.emailPublic ?? false,
    });

    // records (unified from records / englishRecords / quoteRecords)
    const records: any[] = d.records ?? [
      ...(d.englishRecords ?? []),
      ...(d.quoteRecords ?? []),
    ];
    for (const r of records) {
      recordRows.push({
        user_id: doc.id,
        answered: r.answered ?? 0,
        correct: r.correct ?? 0,
        set: r.set ?? "",
        timestamp: toTs(r.timestamp) ?? new Date().toISOString(),
        category: r.category ?? "",
        answers: r.answers ?? null,
      });
    }

    // studyChineseRecords
    for (const r of d.studyChineseRecords ?? []) {
      recordRows.push({
        user_id: doc.id,
        answered: r.answered ?? 0,
        correct: r.correct ?? 0,
        set: r.set ?? "",
        timestamp: toTs(r.timestamp) ?? new Date().toISOString(),
        category: r.category ?? "學中文",
        answers: null,
      });
    }

    // recitations
    for (const rec of d.recitations ?? []) {
      recitationRows.push({
        user_id: doc.id,
        article_id: rec.articleId ?? "",
        article_number: rec.articleNumber ?? 0,
        title: rec.title ?? "",
        success: rec.success ?? false,
        timestamp: toTs(rec.timestamp) ?? new Date().toISOString(),
      });
    }
  }

  await upsertBatch("users", userRows);
  await upsertBatch("quiz_records", recordRows);
  await upsertBatch("recitations", recitationRows);
}

// ── migrate lists ─────────────────────────────────────────────────────────────
async function migrateLists() {
  console.log("\n[lists]");
  const db = getFirestoreDB();
  const snap = await db.collection("lists").get();
  console.log(`  Firestore docs: ${snap.size}`);

  const listRows: object[] = [];
  const questionRows: object[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    listRows.push({
      id: doc.id,
      title: d.title ?? "",
      owner_id: d.ownerId ?? "",
      is_public: d.isPublic ?? false,
      created_at: toTs(d.createdAt) ?? new Date().toISOString(),
      shared_with: d.sharedWith ?? [],
      shared_results: d.sharedResults ?? {},
    });

    const questions: any[] = d.questions ?? [];
    questions.forEach((q, idx) => {
      questionRows.push({
        list_id: doc.id,
        question_id: q.questionId ?? "",
        collection_id: q.collectionId ?? "",
        title: q.title ?? "",
        number: q.number ?? 0,
        level: q.level ?? null,
        position: idx,
      });
    });
  }

  await upsertBatch("lists", listRows);
  await upsertBatch("list_questions", questionRows);
}

// ── migrate follows ───────────────────────────────────────────────────────────
async function migrateFollows() {
  console.log("\n[follows]");
  const db = getFirestoreDB();
  const snap = await db.collection("follows").get();
  console.log(`  Firestore docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      follower_id: d.followerId ?? "",
      follower_name: d.followerName ?? "",
      follower_avatar_url: d.followerAvatarUrl ?? null,
      following_id: d.followingId ?? "",
      following_name: d.followingName ?? "",
      following_avatar_url: d.followingAvatarUrl ?? null,
      created_at: toTs(d.createdAt) ?? new Date().toISOString(),
    };
  });

  await upsertBatch("follows", rows);
}

// ── migrate articles ──────────────────────────────────────────────────────────
async function migrateArticles() {
  console.log("\n[articles]");
  const db = getFirestoreDB();
  const snap = await db.collection("articles").get();
  console.log(`  Firestore docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      title: d.title ?? "",
      category: d.category ?? null,
      author: d.author ?? null,
      // content may be string or array; store as jsonb
      content: Array.isArray(d.content)
        ? d.content
        : typeof d.content === "string"
        ? d.content
        : [],
      type: d.type ?? null,
      number: typeof d.number === "number" ? d.number : null,
      language: d.language ?? "中文",
      attempt_count: d.attemptCount ?? 0,
      success_count: d.successCount ?? 0,
      created_at: toTs(d.createdAt) ?? null,
      updated_at: toTs(d.updatedAt) ?? null,
    };
  });

  await upsertBatch("articles", rows);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function clearTable(table: string, filterCol: string, sentinel: string) {
  const { error } = await supabase.from(table).delete().neq(filterCol, sentinel);
  if (error && error.code !== "PGRST116") {
    console.warn(`  warn clearing ${table}:`, error.message);
  } else {
    console.log(`  cleared ${table}`);
  }
}

async function truncateTables() {
  console.log("\n[truncate] clearing existing data...");
  // order: child tables first to satisfy FK constraints
  await clearTable("list_questions", "list_id",    "\x00");
  await clearTable("quiz_records",   "user_id",    "\x00");
  await clearTable("recitations",    "user_id",    "\x00");
  await clearTable("follows",        "id",         "\x00");
  await clearTable("lists",          "id",         "\x00");
  await clearTable("users",          "id",         "\x00");
  await clearTable("articles",       "id",         "\x00");
}

async function main() {
  console.log("=== Firebase → Supabase migration ===");
  console.log(`Supabase: ${process.env.NEXT_PUBLIC_TEST_SUPABASE_URL}`);

  await truncateTables();
  await migrateUsers();
  await migrateLists();
  await migrateFollows();
  await migrateArticles();

  console.log("\n✅ Migration complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
