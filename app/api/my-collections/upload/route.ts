import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { upsertQuizQuestions, collectionTableExists } from "@/lib/questions-supabase";
import { upsertUserCollection, userOwnsCollection } from "@/lib/user-collections-supabase";

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

  const results: Record<string, { upserted: number }> = {};
  const errors: Record<string, string> = {};

  for (const [collectionId, rows] of Object.entries(payload.collections)) {
    if (!Array.isArray(rows)) continue;

    const normalized = rows.filter(
      r => Number.isFinite(r.number) && typeof r.title === "string"
    );
    if (normalized.length === 0) continue;

    try {
      // Block if table exists AND this user does not own it
      if (await collectionTableExists(collectionId)) {
        const owns = await userOwnsCollection(user.id, collectionId);
        if (!owns) {
          errors[collectionId] = `題庫名稱「${collectionId}」已被使用，請改用其他名稱`;
          continue;
        }
      }
      const result = await upsertQuizQuestions(collectionId, normalized);
      const displayName =
        findCategoryName(payload.categories ?? [], collectionId) ?? collectionId;
      await upsertUserCollection(user.id, collectionId, displayName);
      results[collectionId] = result;
    } catch (err: any) {
      errors[collectionId] = err?.message ?? "未知錯誤";
    }
  }

  const hasSuccess = Object.keys(results).length > 0;
  if (!hasSuccess) {
    const firstError = Object.values(errors)[0] ?? "沒有有效的 collection";
    return NextResponse.json({ ok: false, error: firstError }, { status: 500 });
  }

  return NextResponse.json({ ok: true, results, errors: Object.keys(errors).length ? errors : undefined });
}
