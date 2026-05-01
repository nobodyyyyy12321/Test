import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { upsertQuizQuestions, collectionTableExists } from "@/lib/questions-supabase";
import { upsertUserCollection, userOwnsCollection } from "@/lib/user-collections-supabase";

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

/** Recursively search category tree for a node whose href contains /test/<collectionId> */
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

async function getUser() {
  const session = await auth();
  const email = (session?.user as any)?.email as string | undefined;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: UploadPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.collections || typeof payload.collections !== "object") {
    return NextResponse.json({ error: "collections 欄位為必填" }, { status: 400 });
  }

  const language = payload.language ?? "zh-TW";
  if (!SUPPORTED_LANGS.includes(language)) {
    return NextResponse.json({ error: `Unsupported language: ${language}` }, { status: 400 });
  }
  const activeLanguage = language;

  const results: Record<string, { upserted: number }> = {};
  const errors: Record<string, string> = {};
  const conflicts: Record<string, string> = {}; // own collections the user can overwrite
  const forceSet = new Set(payload.force ?? []);

  for (const [collectionId, rows] of Object.entries(payload.collections)) {
    if (!Array.isArray(rows)) continue;

    const normalized = normalizeRows(rows);
    if (normalized.length === 0) continue;

    try {
      // Block if table exists AND this user does not own it
      if (await collectionTableExists(collectionId)) {
        const owns = await userOwnsCollection(user.id, collectionId, activeLanguage);
        if (!owns) {
          errors[collectionId] = `題庫名稱「${collectionId}」已被使用，請改用其他名稱`;
          continue;
        }
        if (!forceSet.has(collectionId)) {
          conflicts[collectionId] = `題庫「${collectionId}」已存在，確定要覆蓋嗎？`;
          continue;
        }
      }
      const result = await upsertQuizQuestions(collectionId, normalized);
      const displayName =
        findCategoryName(payload.categories ?? [], collectionId) ?? collectionId;
      await upsertUserCollection(user.id, collectionId, displayName, false, activeLanguage);
      results[collectionId] = result;
    } catch (err: any) {
      errors[collectionId] = err?.message ?? "未知錯誤";
    }
  }

  // If there are conflicts but no successes, ask frontend to confirm
  if (Object.keys(conflicts).length > 0 && Object.keys(results).length === 0 && Object.keys(errors).length === 0) {
    return NextResponse.json({ ok: false, conflicts }, { status: 409 });
  }

  const hasSuccess = Object.keys(results).length > 0;
  if (!hasSuccess) {
    const firstError = Object.values(errors)[0] ?? "沒有有效的 collection";
    return NextResponse.json({ ok: false, error: firstError, conflicts: Object.keys(conflicts).length ? conflicts : undefined }, { status: 500 });
  }

  return NextResponse.json({ ok: true, results, errors: Object.keys(errors).length ? errors : undefined, conflicts: Object.keys(conflicts).length ? conflicts : undefined });
}
