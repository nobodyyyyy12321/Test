import { auth } from "@/auth";
import { upsertQuizQuestions, collectionTableExists } from "@/lib/questions-supabase";
import { ensureTopLevelItem } from "@/lib/categories";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

type QuestionRow = {
  number: number | string;
  title?: string;
  type?: "single" | "multiple" | "fill" | "group";
  content?: string | null;     // group header shared content
  options?: Record<string, string> | null;
  answer?: string | string[] | null;
  level?: number | null;
  groupRange?: string | null;
  group_range?: string | null;
};

/** Keep `type=group` as its own row and persist the original range in `group_range`. */
function normalizeRows(rows: QuestionRow[]) {
  const out: { number: number; title: string; type?: string; options?: Record<string, string> | null; answer?: string | string[] | null; level?: number | null; groupRange?: string | null }[] = [];
  for (const r of rows) {
    if (r.type === "group") {
      // Parse range like "6-8" → first number 6; store group header as number 5.5
      const rawRange = String(r.number ?? "").trim();
      const firstNum = parseInt(rawRange.split("-")[0]);
      const lastInOut = out.length > 0 ? out[out.length - 1].number : 0;
      const groupNumber = Number.isFinite(firstNum) && firstNum > 0
        ? firstNum - 0.5
        : lastInOut + 0.5;
      const groupTitle = r.title ?? r.content ?? null;
      out.push({
        number: groupNumber,
        title: groupTitle ?? "",
        type: "group",
        options: null,
        answer: null,
        level: null,
        groupRange: r.groupRange ?? r.group_range ?? (rawRange || (Number.isFinite(firstNum) ? String(firstNum) : null)),
      });
      continue;
    }
    const num = Number(r.number);
    if (!Number.isFinite(num) || typeof r.title !== "string") continue;
    out.push({
      number: num,
      title: r.title,
      type: r.type,
      options: r.options ?? null,
      answer: r.answer ?? null,
      level: r.level ?? null,
    });
  }
  return out;
}

type CategoryNode = {
  name: string;
  href?: string;
  children?: CategoryNode[];
};

type UploadPayload = {
  language?: string;
  categories?: CategoryNode[];
  collections?: Record<string, QuestionRow[]>;
  force?: string[]; // collectionIds to overwrite without confirmation
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
  const conflicts: Record<string, string> = {}; // existing collections the admin can overwrite
  const forceSet = new Set(payload.force ?? []);

  for (const [collectionId, rows] of Object.entries(payload.collections)) {
    if (!Array.isArray(rows)) {
      errors[collectionId] = "questions 必須為陣列";
      continue;
    }
    const normalized = normalizeRows(rows);
    if (normalized.length === 0) {
      errors[collectionId] = "沒有有效題目（需有 number 與 title）";
      continue;
    }

    try {
      if (await collectionTableExists(collectionId) && !forceSet.has(collectionId)) {
        conflicts[collectionId] = `題庫「${collectionId}」已存在，確定要覆蓋嗎？`;
        continue;
      }
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

  // If there are conflicts but no successes, ask frontend to confirm
  if (Object.keys(conflicts).length > 0 && Object.keys(results).length === 0 && Object.keys(errors).length === 0) {
    return Response.json({ ok: false, conflicts }, { status: 409 });
  }

  const hasSuccess = Object.keys(results).length > 0;
  if (!hasSuccess) {
    const firstError = Object.values(errors)[0] ?? "沒有有效的 collection";
    return Response.json({ ok: false, error: firstError, conflicts: Object.keys(conflicts).length ? conflicts : undefined }, { status: 500 });
  }

  return Response.json({
    ok: true,
    language,
    results,
    errors: Object.keys(errors).length ? errors : undefined,
    conflicts: Object.keys(conflicts).length ? conflicts : undefined,
  });
}
