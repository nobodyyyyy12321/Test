import { getFirestoreDB } from "@/lib/firebase-admin";

// 記憶體快取，server restart 前有效
const cache = new Map<string, { data: unknown[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小時

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id") || "englishQuestions";

    const cached = cache.get(id);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return Response.json({ questions: cached.data }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    const db = getFirestoreDB();
    const snapshot = await db.collection(id).orderBy("number").get();

    const questions = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Convert options object to array format
      const optionsArray = data.options && typeof data.options === 'object'
        ? Object.entries(data.options).map(([label, text]) => ({
            label,
            text: text as string
          }))
        : [];

      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        options: optionsArray,
        answer: data.answer,
      };
    });

    cache.set(id, { data: questions, ts: Date.now() });

    return Response.json({ questions }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
