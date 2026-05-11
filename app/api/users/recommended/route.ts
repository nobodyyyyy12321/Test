import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") ?? "zh-TW";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 20);

  try {
    const db = getSupabaseAdmin();

    // Get users who own categories in the given language
    const { data: collections, error } = await db
      .from("categories")
      .select("owner_id")
      .eq("language", language)
      .not("owner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Fetch collections error:", error);
      return NextResponse.json({ users: [] });
    }

    if (!collections || collections.length === 0) {
      return NextResponse.json({ users: [] });
    }

    // Group by owner_id and count occurrences
    const userMap = new Map<string, number>();
    for (const row of collections) {
      if (row.owner_id) {
        userMap.set(row.owner_id, (userMap.get(row.owner_id) ?? 0) + 1);
      }
    }

    if (userMap.size === 0) {
      return NextResponse.json({ users: [] });
    }

    // Get top users (most collections first)
    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(e => e[0]);

    // Fetch user details
    const { data: users, error: userError } = await db
      .from("users")
      .select("id,name,avatar_url")
      .in("id", topUserIds);

    if (userError || !users) {
      console.error("Fetch users error:", userError);
      return NextResponse.json({ users: [] });
    }

    // Fetch public categories for each user
    const { data: userCategories, error: catError } = await db
      .from("categories")
      .select("id,name,href,owner_id,is_public,problems_per_test,shuffle_problems")
      .in("owner_id", topUserIds)
      .eq("language", language)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (catError) {
      console.error("Fetch categories error:", catError);
    }

    // Group categories by owner_id
    const categoriesByOwner = new Map<string, typeof userCategories>();
    if (userCategories) {
      for (const cat of userCategories) {
        if (!categoriesByOwner.has(cat.owner_id)) {
          categoriesByOwner.set(cat.owner_id, []);
        }
        categoriesByOwner.get(cat.owner_id)!.push(cat);
      }
    }

    // Map to response format, maintaining order from topUserIds
    const result = topUserIds
      .map(uid => users.find(u => u.id === uid))
      .filter(Boolean)
      .map(u => ({
        id: u!.id,
        name: u!.name,
        avatarUrl: u!.avatar_url,
        categories: (categoriesByOwner.get(u!.id) || []).map(cat => ({
          id: cat.id,
          name: cat.name,
          href: cat.href,
          problemsPerTest: cat.problems_per_test,
          shuffleProblems: cat.shuffle_problems,
        })),
      }));

    return NextResponse.json({ users: result });
  } catch (err) {
    console.error("Recommended users error:", err);
    return NextResponse.json({ users: [] });
  }
}
