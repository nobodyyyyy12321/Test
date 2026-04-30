import { auth } from "@/auth";
import { upsertQuizQuestions } from "@/lib/questions-supabase";
import { ensureTopLevelItem } from "@/lib/categories";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

type QuestionRow = {
  number: number;
  title: string;
  type?: "single" | "multiple" | "fill";
  options?: Record<string, string> | null;
  answer?: string | string[] | null;
  level?: number | null;
  groupContent?: string | null;
};

type CategoryNode = {
  name: string;
  href?: string;
  children?: CategoryNode[];
};

type UploadPayload = {
  language?: string;
  categories?: CategoryNode[];
  collections?: Record<string, QuestionRow[]>;
};

const SUPPORTED_LANGS = ["zh-TW", "zh-CN", "en", "ko", "es", "th", "id"];

function findCategoryName(nodes: CategoryNode[], collectionId: string): string | null {
  for (const node of nodes) {
    if (node.href) {
      try {
        const pathname = new URL(node.href, "http://x").pathname;
        if (pathname === `/test/${collectionId}`) return node.name;
      } catch {}
    }
    if (node.children) {
      const found = findCategoryName(node.children, collectionId);
      if (found) return found;
    }
  }
  return null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: UploadPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.collections || typeof payload.collections !== "object") {
    return Response.json({ error: "collections 欄位為必填" }, { status: 400 });
  }

  const language = payload.language ?? "zh-TW";
  if (!SUPPORTED_LANGS.includes(language)) {
    return Response.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  }

  const results: Record<string, {
    upserted: number;
    gridName: string;
    navCreated: boolean;
    navWarning?: string;
  }> = {};
  const errors: Record<string, string> = {};

  for (const [collectionId, rows] of Object.entries(payload.collections)) {
    if (!Array.isArray(rows)) {
      errors[collectionId] = "questions 必須為陣列";
      continue;
    }
    const normalized = rows.filter(r => Number.isFinite(r.number) && typeof r.title === "string");
    if (normalized.length === 0) {
      errors[collectionId] = "沒有有效題目（需有 number 與 title）";
      continue;
    }

    try {
      const result = await upsertQuizQuestions(collectionId, normalized);
      const gridName = findCategoryName(payload.categories ?? [], collectionId) ?? collectionId;

      // Add (or rename) the homepage nav entry. Failure here doesn't fail the whole upload.
      let navCreated = false;
      let navWarning: string | undefined;
      try {
        const nav = await ensureTopLevelItem({
          language,
          name: gridName,
          href: `/test/${encodeURIComponent(collectionId)}`,
        });
        navCreated = nav.created;
      } catch (err: any) {
        navWarning = `首頁導覽列更新失敗：${err?.message ?? err}`;
      }

      results[collectionId] = {
        upserted: result.upserted,
        gridName,
        navCreated,
        navWarning,
      };
    } catch (err: any) {
      errors[collectionId] = err?.message ?? "未知錯誤";
    }
  }

  const hasSuccess = Object.keys(results).length > 0;
  if (!hasSuccess) {
    const firstError = Object.values(errors)[0] ?? "沒有有效的 collection";
    return Response.json({ ok: false, error: firstError }, { status: 500 });
  }

  return Response.json({
    ok: true,
    language,
    results,
    errors: Object.keys(errors).length ? errors : undefined,
  });
}
