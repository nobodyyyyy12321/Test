import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getFirestoreDB } from "../../../../lib/firebase-admin";

export async function POST(request: Request) {
  try {
    let session = null;
    try {
      session = await auth();
    } catch (e) {
      session = null;
    }

    const { articleId, articleNumber, title, success, timestamp } = await request.json();

    if (!articleId || !articleNumber || !title || success === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = getFirestoreDB();
    const usersCol = db.collection("users");

    // If user is signed in, append recitation record and update counters
    if (session?.user?.email) {
      try {
        const userSnapshot = await usersCol.where("email", "==", session.user.email).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userRef = usersCol.doc(userDoc.id);
          try {
            await db.runTransaction(async (tx) => {
              const fresh = await tx.get(userRef);
              const freshData: any = fresh.exists ? fresh.data() : {};
              const recitationsFresh = freshData.recitations || [];
              const hadSuccessBefore = recitationsFresh.some((r: any) => r.articleId === articleId && r.success === true);
              const ts = timestamp || new Date().toISOString();

              const existingRecords: any[] = freshData.records ?? [
                ...(freshData.englishRecords ?? []),
                ...(freshData.quoteRecords ?? []),
              ];
              const recordEntry = {
                set: title,
                timestamp: ts,
                category: "詩文背誦",
                success,
                answered: 1,
                correct: success ? 1 : 0,
              };
              const trimmedRecords = [...existingRecords, recordEntry].slice(-10);

              const attemptCountUser = (freshData.attemptCount || 0) + 1;
              const successCountUser = (freshData.successCount || 0) + (success && !hadSuccessBefore ? 1 : 0);

              tx.update(userRef, {
                records: trimmedRecords,
                attemptCount: attemptCountUser,
                successCount: successCountUser,
                updatedAt: new Date().toISOString(),
              });
            });
          } catch (txErr) {
            console.error("Failed to update user recitations in transaction:", txErr);
          }
        }
      } catch (e) {
        console.error("Failed to update user recitations:", e);
      }
    }

    // Update article counters (attempts and successes)
    try {
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
