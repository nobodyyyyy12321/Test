import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail, getBlockedList } from "../../../../lib/users-supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ blocked: [] });
  const blocked = await getBlockedList(me.id);
  return NextResponse.json({ blocked });
}
