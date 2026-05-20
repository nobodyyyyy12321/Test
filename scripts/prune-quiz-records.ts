// One-time cleanup: keep only the 10 most recent quiz_records per user.
// Run: npx tsx scripts/prune-quiz-records.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
loadEnv(".env.local");
loadEnv(".env");

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: users, error: userErr } = await supabase
    .from("quiz_records")
    .select("user_id")
    .order("user_id");
  if (userErr) throw userErr;

  const userIds = [...new Set((users ?? []).map((r) => r.user_id))];
  console.log(`Found ${userIds.length} users with quiz_records`);

  let totalDeleted = 0;

  for (const userId of userIds) {
    const { data: ids, error: fetchErr } = await supabase
      .from("quiz_records")
      .select("id")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false });
    if (fetchErr) throw fetchErr;

    if (!ids || ids.length <= 10) continue;

    const idsToDelete = ids.slice(10).map((r) => r.id);
    const { error: delErr } = await supabase
      .from("quiz_records")
      .delete()
      .in("id", idsToDelete);
    if (delErr) throw delErr;

    totalDeleted += idsToDelete.length;
    console.log(`  user ${userId.slice(0, 8)}...: kept 10, deleted ${idsToDelete.length}`);
  }

  console.log(`\nDone. Total deleted: ${totalDeleted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
