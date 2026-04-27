import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { searchUsersByName, findUserByEmail, hasBlockRelationship } from "../../../../lib/users-supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ users: [] });
  try {
    const session = await auth();
    const me = session?.user?.email ? await findUserByEmail(session.user.email) : null;

    const users = await searchUsersByName(q);

    if (!me) return NextResponse.json({ users });

    const filtered = await Promise.all(
      users.map(async (u) => {
        const blocked = await hasBlockRelationship(me.id, u.id);
        return blocked ? null : u;
      })
    );
    return NextResponse.json({ users: filtered.filter(Boolean) });
  } catch (e) {
    console.error("GET /api/users/search error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
