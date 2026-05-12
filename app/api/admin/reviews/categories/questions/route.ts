import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchPersonalQuizQuestionsFresh } from "@/lib/questions-supabase";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
};

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

function parseCollectionId(href: string | null): string | null {
  if (!href) return null;
  try {
    const pathname = new URL(href, "http://x").pathname;
    const match = pathname.match(/^\/test\/([^/]+)\/?$/);
    return match ? decodeURIComponent(match[1]) : null;
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
  const categoryId = searchParams.get("categoryId")?.trim();
  if (!categoryId) {
    return NextResponse.json({ error: "categoryId required" }, { status: 400 });
  }

  const lookupUrl = `${SUPABASE_URL}/rest/v1/categories?select=id,owner_id,href,language,approval_status&id=eq.${encodeURIComponent(categoryId)}&owner_id=not.is.null&limit=1`;
  const lookupRes = await fetch(lookupUrl, { headers: HEADERS, cache: "no-store" });
  if (!lookupRes.ok) {
    console.error("[admin questions] Failed to load category:", await lookupRes.text());
    return NextResponse.json({ error: "Failed to load category" }, { status: 500 });
  }

  const rows: Array<{
    id: string;
    owner_id: string;
    href: string | null;
    language: string | null;
    approval_status: string | null;
  }> = await lookupRes.json();

  const row = rows[0];
  if (!row) {
    console.warn(`[admin questions] Category not found: categoryId=${categoryId}`);
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  const collectionId = parseCollectionId(row.href);
  if (!collectionId) {
    console.error(`[admin questions] Failed to parse collection id from href: href=${row.href}`);
    return NextResponse.json({ error: "Invalid category href" }, { status: 400 });
  }

  const language = row.language ?? "zh-TW";

  try {
    const questions = await fetchPersonalQuizQuestionsFresh(row.owner_id, collectionId, language);
    const normalized = questions.map((q) => ({
      id: String(q.number),
      number: q.number,
      title: q.title,
      type: q.type,
      options: q.options
        ? Object.entries(q.options)
            .map(([label, text]) => ({ label, text }))
            .sort((a, b) => a.label.localeCompare(b.label))
        : [],
      answer: q.answer,
      level: q.level,
      groupContent: q.group_content ?? null,
      groupRange: q.group_range ?? null,
    }));

    console.log(`[admin questions] Successfully loaded ${questions.length} questions for categoryId=${categoryId}, collectionId=${collectionId}, language=${language}`);

    return NextResponse.json({
      categoryId,
      ownerId: row.owner_id,
      collectionId,
      language,
      questions: normalized,
    });
  } catch (error) {
    console.error("GET /api/admin/reviews/categories/questions error:", error);
    return NextResponse.json({ error: "Failed to load uploaded questions" }, { status: 500 });
  }
}
