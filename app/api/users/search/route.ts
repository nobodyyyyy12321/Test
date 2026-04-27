import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { searchUsersByName, findUserByEmail } from "../../../../lib/users-supabase";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ users: [] });
  try {
    const session = await auth();
    const me = session?.user?.email ? await findUserByEmail(session.user.email) : null;

    const users = await searchUsersByName(q);
    if (!me || !users.length) return NextResponse.json({ users });

    // Single query: fetch block rows where me is either side AND the other side is one of the results
    const userIds = users.map((u) => u.id);
    const db = getSupabaseAdmin();
    const idList = userIds.join(",");
    const { data: blockRows } = await db
      .from("blocks")
      .select("blocker_id,blocked_id")
      .or(
        `and(blocker_id.eq.${me.id},blocked_id.in.(${idList})),and(blocked_id.eq.${me.id},blocker_id.in.(${idList}))`
      );

    const blockedSet = new Set<string>();
    for (const row of blockRows ?? []) {
      const r = row as { blocker_id: string; blocked_id: string };
      blockedSet.add(r.blocker_id === me.id ? r.blocked_id : r.blocker_id);
    }

    return NextResponse.json({ users: users.filter((u) => !blockedSet.has(u.id)) });
  } catch (e) {
    console.error("GET /api/users/search error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
