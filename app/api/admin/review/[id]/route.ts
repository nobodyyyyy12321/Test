import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getPendingUpload, updatePendingUploadStatus } from "@/lib/pending-uploads";
import { upsertCategories } from "@/lib/categories";
import { upsertQuizQuestions } from "@/lib/questions-supabase";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const action: "approve" | "reject" = body.action;
  const note: string | undefined = body.note;

  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "action must be approve or reject" }, { status: 400 });
  }

  const record = await getPendingUpload(id);
  if (!record) return Response.json({ error: "Not found" }, { status: 404 });
  if (record.status !== "pending") {
    return Response.json({ error: `Already ${record.status}` }, { status: 409 });
  }

  if (action === "reject") {
    await updatePendingUploadStatus(id, "rejected", note);
    return Response.json({ ok: true, status: "rejected" });
  }

  // ── approve: write to DB ────────────────────────────────────────────────────
  const payload = record.payload as any;
  const results: Record<string, unknown> = {};

  try {
    if (Array.isArray(payload.categories) && payload.categories.length > 0 && typeof payload.categories[0]?.name === "string") {
      const lang = payload.language ?? "zh-TW";
      await upsertCategories(lang, payload.categories);
      revalidateTag("categories");
      results.categories = { language: lang, count: payload.categories.length };
    }

    if (payload.collections && typeof payload.collections === "object") {
      const collectionResults: Record<string, { upserted: number }> = {};

      for (const [collectionId, questions] of Object.entries(payload.collections as Record<string, any[]>)) {
        if (!Array.isArray(questions)) continue;
        const result = await upsertQuizQuestions(collectionId, questions);
        revalidateTag(`quiz-questions-${collectionId}`);
        collectionResults[collectionId] = result;
      }
      results.collections = collectionResults;
    }
  } catch (err: any) {
    console.error("approve error:", err);
    return Response.json({ ok: false, error: err?.message ?? "寫入失敗" }, { status: 500 });
  }

  await updatePendingUploadStatus(id, "approved", note);
  return Response.json({ ok: true, status: "approved", results });
}
