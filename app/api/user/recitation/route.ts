import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { appendQuizRecord, appendRecitation } from "../../../../lib/users";
import { getFirestoreDB } from "../../../../lib/firebase-admin";

export async function POST(request: Request) {
  try {
    let session = null;
    try { session = await auth(); } catch { session = null; }

    const { articleId, articleNumber, title, success, timestamp } = await request.json();

    if (!articleId || !articleNumber || !title || success === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ts: string = timestamp || new Date().toISOString();

    // Save user recitation record to Supabase
    if (session?.user?.email) {
      try {
        await Promise.all([
          appendQuizRecord(session.user.email, {
            answered: 1,
            correct: success ? 1 : 0,
            set: title,
            category: "詩文背誦",
          }),
          appendRecitation(session.user.email, {
            articleId,
            articleNumber,
            title,
            success,
            timestamp: ts,
          }),
        ]);
      } catch (e) {
        console.error("Failed to save recitation to Supabase:", e);
      }
    }

    // Update article counters in Firebase (articles collection not yet migrated)
    try {
      const db = getFirestoreDB();
      const articlesCol = db.collection("articles");
      const articleRef = articlesCol.doc(articleId);
      const articleSnap = await articleRef.get();

      let attemptCount = 0;
      let successCount = 0;

      if (!articleSnap.exists) {
        const byNumber = await articlesCol.where("number", "==", articleNumber).limit(1).get();
        if (!byNumber.empty) {
          const doc = byNumber.docs[0];
          attemptCount = (doc.data().attemptCount || 0) + 1;
          successCount = (doc.data().successCount || 0) + (success ? 1 : 0);
          await doc.ref.update({ attemptCount, successCount, updatedAt: new Date().toISOString() });
        }
      } else {
        const data = articleSnap.data() || {};
        attemptCount = (data.attemptCount || 0) + 1;
        successCount = (data.successCount || 0) + (success ? 1 : 0);
        await articleRef.update({ attemptCount, successCount, updatedAt: new Date().toISOString() });
      }

      return NextResponse.json({ success: true, message: "Recitation recorded", attemptCount, successCount });
    } catch (err) {
      console.error("Failed updating article counters:", err);
      return NextResponse.json({ success: true, message: "Recitation recorded (article counters not updated)" });
    }
  } catch (error: any) {
    console.error("Error recording recitation:", error);
    return NextResponse.json({ error: error.message || "Failed to record recitation" }, { status: 500 });
  }
}
