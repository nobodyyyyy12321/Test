import { getFirestoreDB } from "@/lib/firebase-admin";
import { getListById } from "@/lib/lists-firebase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

async function fetchGSATQuestions(examName: string) {
  const [qRes, gRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/questions?exam_name=eq.${encodeURIComponent(examName)}&order=number.asc&select=number,title,type,options,answer`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: { revalidate: 3600 },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/question_groups?exam_name=eq.${encodeURIComponent(examName)}&select=group_id,content`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      next: { revalidate: 3600 },
    }),
  ]);
  if (!qRes.ok) throw new Error("Supabase fetch failed");

  const rows: { number: number; title: string; type: string; options: Record<string, string>; answer: string | null }[] = await qRes.json();
  const groupRows: { group_id: string; content: string }[] = gRes.ok ? await gRes.json() : [];

  // group_id 如 "6-8"，取起始題號
  const groups: Record<number, string> = {};
  for (const g of groupRows) {
    const start = parseInt(g.group_id.split("-")[0]);
    if (!isNaN(start)) groups[start] = g.content;
  }

  const questions = rows.map((row) => {
    const options = Object.entries(row.options)
      .map(([label, text]) => ({ label, text }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const isMultiple = row.type === "multiple_choice";
    const answer = isMultiple && row.answer ? row.answer.split("") : (row.answer ?? "");
    return { id: String(row.number), number: row.number, title: row.title, type: isMultiple ? "multiple" : "single", options, answer, groupContent: groups[row.number] ?? null };
  });

  return questions;
}

// 記憶體快取，server restart 前有效
const cache = new Map<string, { data: unknown[]; ts: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 小時

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // 從清單作答模式
    const listId = searchParams.get("listId");
    if (listId) {
      const list = await getListById(listId);
      if (!list) return Response.json({ error: "List not found" }, { status: 404 });

      const db = getFirestoreDB();
      // 按 collectionId 分組
      const byCollection: Record<string, string[]> = {};
      for (const q of list.questions) {
        (byCollection[q.collectionId] = byCollection[q.collectionId] ?? []).push(q.questionId);
      }

      const allQuestions: unknown[] = [];
      for (const [collectionId, ids] of Object.entries(byCollection)) {
        // Firestore `in` 最多 30 筆，分批處理
        for (let i = 0; i < ids.length; i += 30) {
          const batch = ids.slice(i, i + 30);
          const snap = await db.collection(collectionId)
            .where("__name__", "in", batch)
            .get();
          snap.docs.forEach(doc => {
            const data = doc.data();
            const optionsArray = data.options && typeof data.options === "object"
              ? Object.entries(data.options)
                  .map(([label, text]) => ({ label, text: text as string }))
                  .sort((a, b) => a.label.localeCompare(b.label))
              : [];
            allQuestions.push({
              id: doc.id,
              number: data.number,
              title: data.title,
              level: data.level ?? null,
              type: data.type ?? "single",
              options: optionsArray,
              answer: data.answer,
            });
          });
        }
      }
      return Response.json({ questions: allQuestions });
    }

    const id = searchParams.get("id") || "englishWords";
    const levelsParam = searchParams.get("levels"); // e.g. "1,2"
    const levels = levelsParam ? levelsParam.split(",").map(Number) : null;

    // 國文學測題目從 Supabase 載入
    if (id.startsWith("國文學測")) {
      const questions = await fetchGSATQuestions(id);
      return Response.json({ questions });
    }

    const cacheKey = levels ? `${id}:levels=${levelsParam}` : id;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return Response.json({ questions: cached.data }, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    const db = getFirestoreDB();
    const snapshot = await db.collection(id).orderBy("number").get();

    let questions = snapshot.docs.map((doc) => {
      const data = doc.data();
      const optionsArray = data.options && typeof data.options === 'object'
        ? Object.entries(data.options)
            .map(([label, text]) => ({ label, text: text as string }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : [];

      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        level: data.level ?? null,
        options: optionsArray,
        answer: data.answer,
      };
    });

    if (levels) {
      questions = questions.filter((q) => q.level !== null && levels.includes(q.level));
    }

    cache.set(cacheKey, { data: questions, ts: Date.now() });

    return Response.json({ questions }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
