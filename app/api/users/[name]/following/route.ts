import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users-supabase";
import { getFollowing } from "../../../../../lib/follows-supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const user = await findUserByName(decodeURIComponent(name));
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const following = await getFollowing(user.id);
  return NextResponse.json({ following });
}
