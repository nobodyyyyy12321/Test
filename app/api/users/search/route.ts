import { NextResponse } from "next/server";
import { searchUsersByName } from "../../../../lib/users-supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ users: [] });
  try {
    const users = await searchUsersByName(q);
    return NextResponse.json({ users });
  } catch (e) {
    console.error("GET /api/users/search error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
