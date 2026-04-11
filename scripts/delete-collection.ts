
import fs from 'fs';
import path from 'path';
import { getFirestoreDB } from '../lib/firebase-admin';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#][^=\s]*)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1];
      let val = m[2] || '';
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  });
}

async function deleteCollection(collectionName: string) {
  const db = getFirestoreDB();
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    console.log(`Collection ${collectionName} is empty or does not exist`);
    return;
  }
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${snapshot.size} docs from ${collectionName}`);
}

deleteCollection('quoteQuestions').catch(console.error);
