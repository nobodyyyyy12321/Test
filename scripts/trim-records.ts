/**
 * 將 Firestore users collection 內所有文件的 records 欄位裁切至最近 10 筆
 * 用法：npx tsx scripts/trim-records.ts
 */

import fs from "fs";
import path from "path";
import { getFirestoreDB } from "../lib/firebase-admin";

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
      ) {
        val = val.slice(1, -1);
      }
      process.env[m[1]] = val;
    });
}

const KEEP = 10;

async function trimRecords() {
  const db = getFirestoreDB();
  const snapshot = await db.collection("users").get();

  if (snapshot.empty) {
    console.log('Collection "users" 不存在或已是空的');
    return;
  }

  const toUpdate = snapshot.docs.filter((doc) => {
    const data = doc.data() ?? {};
    // merge legacy fields
    const records: any[] = data.records ?? [
      ...(data.englishRecords ?? []),
      ...(data.quoteRecords ?? []),
    ];
    return records.length > KEEP;
  });

  if (toUpdate.length === 0) {
    console.log(`所有使用者的 records 均不超過 ${KEEP} 筆，無需裁切`);
    return;
  }

  const BATCH_SIZE = 500;
  let updated = 0;

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = db.batch();
    toUpdate.slice(i, i + BATCH_SIZE).forEach((doc) => {
      const data = doc.data() ?? {};
      const records: any[] = data.records ?? [
        ...(data.englishRecords ?? []),
        ...(data.quoteRecords ?? []),
      ];
      // sort by timestamp ascending, keep last KEEP
      const sorted = [...records].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const trimmed = sorted.slice(-KEEP);
      batch.update(doc.ref, { records: trimmed });
      updated++;
    });
    await batch.commit();
  }

  console.log(`已裁切 ${updated} 位使用者的 records 至最近 ${KEEP} 筆`);
}

trimRecords().catch(console.error);
