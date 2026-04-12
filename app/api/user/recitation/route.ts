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

    // Parse or create a visitorId for anonymous users (stored in cookie)
    const cookieHeader = request.headers.get("cookie") || "";
    const getCookie = (name: string) => {
      const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
      return match ? decodeURIComponent(match[1]) : undefined;
    };
    let visitorId = getCookie("visitorId");
    let setVisitorCookie: string | null = null;
    if (!visitorId) {
      const rid = (globalThis as any).crypto?.randomUUID ? (globalThis as any).crypto.randomUUID() : `v_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
      visitorId = `anon_${rid}`;
      // set cookie for 1 year
      setVisitorCookie = `visitorId=${encodeURIComponent(visitorId)}; Path=/; Max-Age=${31536000}; SameSite=Lax`;
    }

    // If user is signed in, enforce a per-day quota for free accounts and append recitation
    if (session?.user?.email) {
      try {
        const userSnapshot = await usersCol.where("email", "==", session.user.email).limit(1).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          const userData: any = userDoc.data();

          // Free users: limit to 5 attempts per UTC day. Paid/pro users (userData.isPro === true) are exempt.
          const isPro = Boolean(userData.isPro || userData.paid || userData.isPaid);
          const LIMIT = 5;
          const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD in UTC

          const dailyCol = db.collection("userDailyRecitations");
          const dailyDocId = `${userDoc.id}_${today}`;
          const dailyRef = dailyCol.doc(dailyDocId);

          // Transactionally check and increment daily count
          try {
            await db.runTransaction(async (tx) => {
              const dailySnap = await tx.get(dailyRef);
              const current = (dailySnap.exists && (dailySnap.data() as any).count) ? (dailySnap.data() as any).count : 0;
              if (!isPro && current >= LIMIT) {
                // throw a sentinel error to abort transaction and inform caller
                const err: any = new Error("DAILY_QUOTA_EXCEEDED");
                err.code = "DAILY_QUOTA_EXCEEDED";
                throw err;
              }
              await tx.set(dailyRef, {
                userId: userDoc.id,
                date: today,
                count: current + 1,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            });
          } catch (quotaErr: any) {
            if (quotaErr && quotaErr.code === "DAILY_QUOTA_EXCEEDED") {
              return NextResponse.json({ error: `Free account daily limit reached (${LIMIT}/day)` }, { status: 429 });
            }
            console.error("Failed to update daily quota:", quotaErr);
            // continue — don't block the recitation if quota transaction failed for other reasons
          }

          // Append recitation to user's recitations array and update counters
          // Use a transaction to avoid double-counting simultaneous successes
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
              const trimmedRecords = [...existingRecords, recordEntry].slice(-50);

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

    // Anonymous (not signed in): enforce a smaller per-day quota using visitorId cookie
    if (!session?.user?.email) {
      try {
        const LIMIT_ANON = 3;
        const today = new Date().toISOString().slice(0, 10);
        const dailyCol = db.collection("userDailyRecitations");
        const dailyDocId = `${visitorId}_${today}`;
        const dailyRef = dailyCol.doc(dailyDocId);

        try {
          await db.runTransaction(async (tx) => {
            const dailySnap = await tx.get(dailyRef);
            const current = (dailySnap.exists && (dailySnap.data() as any).count) ? (dailySnap.data() as any).count : 0;
            if (current >= LIMIT_ANON) {
              const err: any = new Error("DAILY_QUOTA_EXCEEDED");
              err.code = "DAILY_QUOTA_EXCEEDED";
              throw err;
            }
            await tx.set(dailyRef, {
              visitorId,
              date: today,
              count: current + 1,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          });
        } catch (quotaErr: any) {
          if (quotaErr && quotaErr.code === "DAILY_QUOTA_EXCEEDED") {
            const headers: any = {};
            if (setVisitorCookie) headers["Set-Cookie"] = setVisitorCookie;
            return NextResponse.json({ error: `未登入帳號每日限次 (${LIMIT_ANON}/日)` }, { status: 429, headers });
          }
          console.error("Failed to update anonymous daily quota:", quotaErr);
        }
      } catch (e) {
        console.error("Anonymous quota check failed:", e);
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
          // try to find by number as fallback
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

        // Create a persistent recitation record in a dedicated collection
        try {
          const recordsCol = db.collection("recitationRecords");
          const record = {
            articleId,
            articleNumber,
            title,
            success,
            timestamp: timestamp || new Date().toISOString(),
            // For privacy, do not store user email in recitation records by default.
            userEmail: null,
            userName: session?.user?.name || null,
            anonymous: true,
            createdAt: new Date().toISOString(),
          };
          await recordsCol.add(record);
        } catch (recErr) {
          console.error("Failed to write recitation record doc:", recErr);
        }

        return NextResponse.json({ success: true, message: "Recitation recorded", attemptCount, successCount });
      } catch (err) {
        console.error("Failed updating article counters:", err);
        // Return success for user recitation but indicate counters not updated
        return NextResponse.json({ success: true, message: "Recitation recorded (article counters not updated)" });
      }
  } catch (error: any) {
    console.error("Error recording recitation:", error);
    return NextResponse.json({ error: error.message || "Failed to record recitation" }, { status: 500 });
  }
}
