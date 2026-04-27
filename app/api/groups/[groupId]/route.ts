import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail } from "../../../../lib/users-supabase";
import { getGroupWithMembers, deleteGroup } from "../../../../lib/groups-supabase";

type Params = { params: Promise<{ groupId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { groupId } = await params;
  const group = await getGroupWithMembers(groupId);
  if (!group) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({ group });
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId } = await params;
  const ok = await deleteGroup(groupId, user.id);
  if (!ok) return NextResponse.json({ error: "failed or not owner" }, { status: 403 });

  return NextResponse.json({ ok: true });
}
