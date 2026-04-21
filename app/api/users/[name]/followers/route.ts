import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users";
import { getFollowers } from "../../../../../lib/follows-firebase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const user = await findUserByName(decodeURIComponent(name));
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const followers = await getFollowers(user.id);
  return NextResponse.json({ followers });
}
