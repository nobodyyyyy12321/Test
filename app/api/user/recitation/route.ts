import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { appendRecitation } from "../../../../lib/users";
import { incrementArticleCounters } from "../../../../lib/articles-supabase";

export async function POST(request: Request) {
  try {
    let session = null;
    try { session = await auth(); } catch { session = null; }

    const { articleId, articleNumber, title, success, timestamp } = await request.json();

    if (!articleId || !articleNumber || !title || success === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ts: string = timestamp || new Date().toISOString();

    // Save user records to Supabase
    if (session?.user?.email) {
      try {
        await appendRecitation(session.user.email, {
          articleId,
          articleNumber,
          title,
          success,
          timestamp: ts,
        });
      } catch (e) {
        console.error("Failed to save recitation to Supabase:", e);
      }
    }

    // Update article counters in Supabase
    try {
      const { attemptCount, successCount } = await incrementArticleCounters(articleId, articleNumber, success);
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
