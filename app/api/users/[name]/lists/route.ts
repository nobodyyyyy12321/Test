import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users";
import { getPublicListsByOwner } from "../../../../../lib/lists-supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const user = await findUserByName(decodeURIComponent(name));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const lists = await getPublicListsByOwner(user.id);
    return NextResponse.json({ lists });
  } catch (e) {
    console.error("GET /api/users/[name]/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
