/**
 * 刪除 Firestore collection 內所有文件的某個欄位
 * 用法：npx tsx scripts/delete-field.ts <collectionName> <fieldName>
 * 例如：npx tsx scripts/delete-field.ts users quoteRecords
 */

import fs from "fs";
import path from "path";
import { getFirestoreDB } from "../lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

const [collectionName, fieldName] = process.argv.slice(2);
if (!collectionName || !fieldName) {
  console.error("請提供 collection 名稱與欄位名稱");
  console.error("用法：npx tsx scripts/delete-field.ts <collectionName> <fieldName>");
  process.exit(1);
}

async function deleteField(collection: string, field: string) {
  const db = getFirestoreDB();
  const snapshot = await db.collection(collection).get();

  if (snapshot.empty) {
    console.log(`Collection "${collection}" 不存在或已是空的`);
    return;
  }

  // 只處理有該欄位的文件
  const docsWithField = snapshot.docs.filter((doc) => field in (doc.data() ?? {}));

  if (docsWithField.length === 0) {
    console.log(`"${collection}" 中沒有文件包含欄位 "${field}"`);
    return;
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < docsWithField.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docsWithField.slice(i, i + BATCH_SIZE).forEach((doc) =>
      batch.update(doc.ref, { [field]: FieldValue.delete() })
    );
    await batch.commit();
  }

  console.log(`已從 "${collection}" 的 ${docsWithField.length} 筆文件中刪除欄位 "${field}"`);
}

deleteField(collectionName, fieldName).catch(console.error);
