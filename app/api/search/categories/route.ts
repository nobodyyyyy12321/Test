import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return NextResponse.json({ results: [] });

  const db = getSupabaseAdmin();

  // Search public owner collections matching name across all languages.
  const { data: cats, error } = await db
    .from("qsets")
    .select("id, name, owner_id, problems_per_test, shuffle_problems")
    .eq("is_public", true)
    .not("owner_id", "is", null)
    .ilike("name", `%${q}%`)
    .limit(30);

  if (error || !cats || cats.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const ownerIds = [...new Set(cats.map((c: { owner_id: string }) => c.owner_id))];

  const { data: users } = await db
    .from("users")
    .select("id, name, avatar_url")
    .in("id", ownerIds);

  const userMap = new Map<string, { name: string; avatarUrl: string | null }>(
    (users ?? []).map((u: { id: string; name: string; avatar_url?: string | null }) => [
      u.id,
      { name: u.name, avatarUrl: u.avatar_url ?? null },
    ])
  );

  const results = cats.map((c: { id: string; name: string; owner_id: string; problems_per_test: number | null; shuffle_problems: boolean | null }) => ({
    id: c.id,
    name: c.name,
    href: null,
    ownerId: c.owner_id,
    ownerName: userMap.get(c.owner_id)?.name ?? null,
    ownerAvatarUrl: userMap.get(c.owner_id)?.avatarUrl ?? null,
    problemsPerTest: c.problems_per_test ?? null,
    shuffleProblems: c.shuffle_problems ?? null,
  }));

  return NextResponse.json({ results });
}
