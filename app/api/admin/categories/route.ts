import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { getCategoriesCached, upsertCategories } from "@/lib/categories";

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
      data: await getCategoriesCached(lang),
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
  if (!body?.language || !Array.isArray(body?.data)) {
    return Response.json({ error: "language and data required" }, { status: 400 });
  }
  if (!SUPPORTED_LANGS.includes(body.language)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }

  await upsertCategories(body.language, body.data);
  revalidateTag("categories");
  return Response.json({ ok: true });
}
