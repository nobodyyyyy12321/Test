import { NextResponse } from "next/server";
import { getFirestoreDB } from "../../../lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const db = getFirestoreDB();
    const articlesCol = db.collection("articles");
    const snapshot = await articlesCol.get();

    let totalAttempts = 0;
    let totalSuccesses = 0;

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const a = Number(data.attemptCount || 0);
      const s = Number(data.successCount || 0);
      totalAttempts += a;
      totalSuccesses += s;
    });

    const url = new URL(request.url);
    const wantRecords = url.searchParams.get("records") === "1";

    // Read global site visits if present
    let visits = 0;
    try {
      const statsDoc = await db.collection("siteStats").doc("global").get();
      if (statsDoc.exists) {
        const sdata: any = statsDoc.data() || {};
        visits = Number(sdata.visits || 0);
      }
    } catch (vErr) {
      console.error("Failed to read site visits:", vErr);
    }

    if (!wantRecords) {
      return NextResponse.json({ success: true, totalAttempts, totalSuccesses, visits });
    }

    // Return recent records (recitation + quiz records). Limit to 10.
    try {
      const records: any[] = [];

      // Fetch recitation records
      const recCol = db.collection("recitationRecords");
      const recSnap = await recCol.orderBy("createdAt", "desc").limit(50).get();

      for (const d of recSnap.docs) {
        const data = d.data() || {};
        const record: any = { id: d.id, type: 'recitation', ...data };

        try {
          let articleUrl: string | null = null;

          if (data.articleId) {
            const artRef = articlesCol.doc(data.articleId);
            const artSnap = await artRef.get();
            if (artSnap.exists) {
              const art = artSnap.data() || {};
              const category = art.category || art.type || "all";
              const number = art.number ?? data.articleNumber;
              if (number !== undefined) articleUrl = `/${encodeURIComponent(category)}/${number}`;
            }
          }

          if (!articleUrl && data.articleNumber !== undefined) {
            const byNum = await articlesCol.where("number", "==", data.articleNumber).limit(1).get();
            if (!byNum.empty) {
              const art = byNum.docs[0].data() || {};
              const category = art.category || art.type || "all";
              const number = art.number ?? data.articleNumber;
              if (number !== undefined) articleUrl = `/${encodeURIComponent(category)}/${number}`;
            }
          }

          if (articleUrl) record.articleUrl = articleUrl;
        } catch (e: any) {
          console.error("Failed to attach article url for recitation record:", e);
        }

        records.push(record);
      }

      // Fetch quiz records from all users
      const usersCol = db.collection("users");
      const usersSnap = await usersCol.get();

      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data() || {};
        const userName = userData.name || "匿名";
        const userId = userDoc.id;

        // 統一 records（向下相容舊欄位）
        const userRecords = userData.records ?? [
          ...(userData.englishRecords ?? []),
          ...(userData.quoteRecords ?? []),
        ];
        if (Array.isArray(userRecords)) {
          userRecords.forEach((rec: any) => {
            records.push({
              id: `${userId}-${rec.category}-${rec.timestamp}`,
              type: 'quiz',
              category: rec.category,
              userName,
              userId,
              answered: rec.answered,
              correct: rec.correct,
              set: rec.set,
              timestamp: rec.timestamp,
              title: `${rec.category} ${rec.set}`,
            });
          });
        }

        // Study Chinese records
        if (Array.isArray(userData.studyChineseRecords)) {
          userData.studyChineseRecords.forEach((rec: any) => {
            records.push({
              id: `${userId}-studychinese-${rec.timestamp}`,
              type: 'quiz',
              category: '學中文',
              userName,
              userId,
              answered: rec.answered,
              correct: rec.correct,
              set: rec.set,
              timestamp: rec.timestamp,
              title: `學中文 ${rec.set}`,
            });
          });
        }

      }

      // Sort all records by timestamp (most recent first)
      records.sort((a, b) => {
        const timeA = a.timestamp || a.createdAt || '';
        const timeB = b.timestamp || b.createdAt || '';
        return timeB.localeCompare(timeA);
      });

      // Return top 10
      return NextResponse.json({ success: true, totalAttempts, totalSuccesses, visits, records: records.slice(0, 10) });
    } catch (recErr: any) {
      console.error("Failed to fetch records:", recErr);
      return NextResponse.json({ success: true, totalAttempts, totalSuccesses, visits, records: [] });
    }
  } catch (err: any) {
    console.error("Failed to compute stats:", err);
    return NextResponse.json({ error: err.message || "Failed to compute stats" }, { status: 500 });
  }
}
