import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const language = searchParams.get("language") ?? "zh-TW";

  if (!q) return NextResponse.json({ results: [] });

  const db = getSupabaseAdmin();

  // Search public owner categories matching name
  const { data: cats, error } = await db
    .from("categories")
    .select("id, name, href, owner_id, parent_id, problems_per_test, shuffle_problems")
    .eq("language", language)
    .eq("is_public", true)
    .not("owner_id", "is", null)
    .ilike("name", `%${q}%`)
    .limit(30);

  if (error || !cats || cats.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // For matched folders (no href), recursively fetch all descendants
  type RawCat = { id: string; name: string; href?: string | null; owner_id: string; parent_id?: string | null; problems_per_test?: number | null; shuffle_problems?: boolean | null };
  const allCats: RawCat[] = [...(cats as RawCat[])];
  const seenIds = new Set(allCats.map(c => c.id));

  let pendingFolderIds = allCats.filter(c => !c.href).map(c => c.id);
  while (pendingFolderIds.length > 0) {
    const { data: childData } = await db
      .from("categories")
      .select("id, name, href, owner_id, parent_id, problems_per_test, shuffle_problems")
      .eq("language", language)
      .eq("is_public", true)
      .in("parent_id", pendingFolderIds);
    const newChildren = ((childData ?? []) as RawCat[]).filter(c => !seenIds.has(c.id));
    if (newChildren.length === 0) break;
    for (const c of newChildren) { allCats.push(c); seenIds.add(c.id); }
    pendingFolderIds = newChildren.filter(c => !c.href).map(c => c.id);
  }

  // Collect unique owner IDs
  const ownerIds = [...new Set(allCats.map(c => c.owner_id))];

  // Fetch owner names and avatars
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

  const results = allCats.map(c => ({
    id: c.id,
    name: c.name,
    href: c.href ?? null,
    parentId: c.parent_id ?? null,
    ownerId: c.owner_id,
    ownerName: userMap.get(c.owner_id)?.name ?? null,
    ownerAvatarUrl: userMap.get(c.owner_id)?.avatarUrl ?? null,
    problemsPerTest: c.problems_per_test ?? null,
    shuffleProblems: c.shuffle_problems ?? null,
  }));

  return NextResponse.json({ results });
}
