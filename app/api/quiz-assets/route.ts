import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users-supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "quiz-assets";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const prefix = `${user.id}/`;

  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
    sortBy: { column: "created_at", order: "desc" },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? [])
    .filter((f) => !f.name.endsWith("/"))
    .map((f) => {
      const fullPath = `${prefix}${f.name}`;
      return {
        name: f.name,
        path: fullPath,
        url: supabase.storage.from(BUCKET).getPublicUrl(fullPath).data.publicUrl,
        previewUrl: `/api/quiz-assets/serve?path=${encodeURIComponent(fullPath)}`,
        created_at: f.created_at,
        size: f.metadata?.size ?? null,
      };
    });

  return NextResponse.json({ items });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json({ error: "path query param is required" }, { status: 400 });
  }

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(BUCKET).remove([path]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
