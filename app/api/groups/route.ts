import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { findUserByEmail } from "../../../lib/users-supabase";
import { getGroupsByUser, createGroup } from "../../../lib/groups-supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const groups = await getGroupsByUser(user.id);
  return NextResponse.json(groups);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const group = await createGroup(user.id, name.trim());
  if (!group) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ group });
}
