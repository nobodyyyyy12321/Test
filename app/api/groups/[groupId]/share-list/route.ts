import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail } from "../../../../../lib/users-supabase";
import { getListById } from "../../../../../lib/lists-supabase";
import { getGroupWithMembers, shareListWithGroup } from "../../../../../lib/groups-supabase";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId } = await params;
  const { listId } = await req.json();
  if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });

  const list = await getListById(listId);
  if (!list) return NextResponse.json({ error: "list not found" }, { status: 404 });
  if (list.ownerId !== user.id) return NextResponse.json({ error: "not list owner" }, { status: 403 });

  const group = await getGroupWithMembers(groupId);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const isMember = group.ownerId === user.id || group.members?.some(m => m.userId === user.id && m.status === "accepted");
  if (!isMember) return NextResponse.json({ error: "not in group" }, { status: 403 });

  const count = await shareListWithGroup(listId, groupId, user.id);
  return NextResponse.json({ ok: true, shared: count });
}
