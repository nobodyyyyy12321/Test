/**
 * 刪除 Firestore collection
 * 用法：npx tsx scripts/delete-collection.ts <collectionName>
 * 例如：npx tsx scripts/delete-collection.ts quoteQuestions
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

const collectionName = process.argv[2];
if (!collectionName) {
  console.error("請提供 collection 名稱");
  console.error("用法：npx tsx scripts/delete-collection.ts <collectionName>");
  process.exit(1);
}

async function deleteCollection(name: string) {
  const db = getFirestoreDB();
  const snapshot = await db.collection(name).get();

  if (snapshot.empty) {
    console.log(`Collection "${name}" 不存在或已是空的`);
    return;
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snapshot.docs.slice(i, i + BATCH_SIZE).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }

  console.log(`已刪除 "${name}" 共 ${snapshot.size} 筆`);
}

deleteCollection(collectionName).catch(console.error);
