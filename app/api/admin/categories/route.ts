import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getCategoriesFlatCached, replaceCategoriesFlat, type FlatCategory } from "@/lib/categories";

const SUPPORTED_LANGS = ["zh-TW", "zh-CN", "en", "ko", "es", "th", "id"];

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export async function GET() {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const entries = await Promise.all(
    SUPPORTED_LANGS.map(async lang => ({
      language: lang,
      items: await getCategoriesFlatCached(lang),
    }))
  );
  return Response.json({ entries });
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.language || !Array.isArray(body?.items)) {
    return Response.json({ error: "language and items required" }, { status: 400 });
  }
  if (!SUPPORTED_LANGS.includes(body.language)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  try {
    await replaceCategoriesFlat(body.language, body.items as FlatCategory[]);
  } catch (err: any) {
    console.error("replaceCategoriesFlat error:", err);
    return Response.json({ error: err?.message ?? "儲存失敗" }, { status: 500 });
  }
  revalidateTag("categories");
  return Response.json({ ok: true });
}
