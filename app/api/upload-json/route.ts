import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { upsertQuizQuestions } from "@/lib/questions-supabase";

/**
 * 從 app/data/ 讀取 JSON 並上傳到 Supabase quiz_questions
 * POST /api/upload-json?file=xxx.json&collection=xxx
 *
 * JSON 格式支援：
 *   1. 舊格式：flat array  → collection param 指定 collection_id
 *   2. 新格式：{ collections: { collectionId: [...] } }
 */
export async function POST(req: Request) {
  const secret = process.env.UPLOAD_SECRET;
  if (secret) {
    const auth = req.headers.get("x-upload-secret");
    if (auth !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const url = new URL(req.url);
    const qs = url.searchParams;
    let body: any = {};
    try { body = await req.json(); } catch {}

    const file = (qs.get("file") || body.file || "").trim();
    const collectionParam = (qs.get("collection") || body.collection || "").trim();

    if (!file) {
      return Response.json({ error: "Missing file param" }, { status: 400 });
    }
    if (!file.endsWith(".json")) {
      return Response.json({ error: "Only .json files allowed" }, { status: 400 });
    }

    const filePath = join(process.cwd(), "app/data", file);
    if (!existsSync(filePath)) {
      return Response.json({ error: `File not found: ${file}` }, { status: 404 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {
      return Response.json({ error: "Invalid JSON file" }, { status: 400 });
    }

    // 判斷格式
    let collectionsMap: Record<string, any[]>;

    if (Array.isArray(parsed)) {
      // 舊格式：flat array，需要 collection param
      if (!collectionParam) {
        return Response.json({ error: "Missing collection param for flat array format" }, { status: 400 });
      }
      collectionsMap = { [collectionParam]: parsed };
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "collections" in (parsed as object) &&
      typeof (parsed as any).collections === "object"
    ) {
      // 新格式：{ collections: { collectionId: [...] } }
      collectionsMap = (parsed as any).collections;
    } else {
      return Response.json({ error: "JSON must be a flat array or new format { collections: {...} }" }, { status: 400 });
    }

    const results: Record<string, { upserted: number }> = {};

    for (const [collectionId, questions] of Object.entries(collectionsMap)) {
      if (!Array.isArray(questions)) continue;
      const result = await upsertQuizQuestions(collectionId, questions);
      results[collectionId] = result;
    }

    const totalUpserted = Object.values(results).reduce((s, r) => s + r.upserted, 0);

    return Response.json({
      success: true,
      total: totalUpserted,
      collections: results,
      file,
    });
  } catch (error) {
    console.error("Error uploading json:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
