import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteUserCollection } from "@/lib/user-collections-supabase";
import { deletePersonalQuizSet } from "@/lib/questions-supabase";
import { findUserByEmail, findUserByName } from "@/lib/users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

function parseCollectionId(href: string | null): string | null {
  if (!href) return null;
  try {
    const match = new URL(href, "http://x").pathname.match(/^\/test\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function getReviewerId(session: any): Promise<string | null> {
  const sessionUserId = (session?.user as any)?.id;
  if (typeof sessionUserId === "string" && sessionUserId.trim().length > 0) {
    return sessionUserId;
  }
  const email = (session?.user as any)?.email as string | undefined;
  const name = (session?.user as any)?.name ?? undefined;
  try {
    const user = email ? await findUserByEmail(email) : (name ? await findUserByName(name) : null);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const language = searchParams.get("language") ?? "zh-TW";

  const url = `${SUPABASE_URL}/rest/v1/qsets?select=id,owner_id,name,href,language,approval_status,created_at,updated_at&owner_id=not.is.null&approval_status=eq.${encodeURIComponent(status)}&language=eq.${encodeURIComponent(language)}&order=created_at.desc`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch pending categories" }, { status: 500 });
  }

  const categories: Array<{
    id: string;
    owner_id: string;
    name: string;
    href: string | null;
    language: string;
    approval_status: string;
    created_at: string;
    updated_at: string;
  }> = await res.json();

  return NextResponse.json({ categories });
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const reviewerId = await getReviewerId(session);

  let body: { categoryId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const categoryId = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
  const action = typeof body.action === "string" ? body.action.trim() : "";

  if (!categoryId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "categoryId and action (approve|reject) required" }, { status: 400 });
  }

  const newStatus = action === "approve" ? "approved" : "rejected";
  const lookupUrl = `${SUPABASE_URL}/rest/v1/qsets?select=id,owner_id,name,href,language&id=eq.${encodeURIComponent(categoryId)}&limit=1`;
  const lookupRes = await fetch(lookupUrl, { headers: HEADERS, cache: "no-store" });
  if (!lookupRes.ok) {
    return NextResponse.json({ error: "Failed to load category for review" }, { status: 500 });
  }
  const rows: Array<{ id: string; owner_id: string; name: string; href: string | null; language: string }> = await lookupRes.json();
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  if (action === "reject") {
    try {
      const collectionId = parseCollectionId(row.href);
      if (!collectionId) {
        return NextResponse.json({ error: "Failed to parse collection id from category href" }, { status: 400 });
      }
      await deleteUserCollection(row.owner_id, collectionId, row.language);
      await deletePersonalQuizSet(row.owner_id, collectionId);
    } catch (err) {
      console.error("Failed to delete rejected upload:", err);
      return NextResponse.json({ error: "Failed to delete rejected upload" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, categoryId, newStatus, deleted: true });
  }

  const url = `${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(categoryId)}`;
  const updateBody: Record<string, unknown> = {
    approval_status: newStatus,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (reviewerId) {
    updateBody.reviewed_by = reviewerId;
  }

  try {
  const updateRes = await fetch(url, {
    method: "PATCH",
    headers: HEADERS,
    body: JSON.stringify(updateBody),
  });

  if (!updateRes.ok) {
    const details = await updateRes.text();
    return NextResponse.json({ error: "Failed to update category status", details }, { status: 500 });
  }

  return NextResponse.json({ ok: true, categoryId, newStatus });
  } catch (error) {
    console.error("PATCH /api/admin/reviews/categories unexpected error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Review API crashed", details: message }, { status: 500 });
  }
}
