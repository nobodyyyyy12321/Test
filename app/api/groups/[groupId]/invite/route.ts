import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users-supabase";
import { getGroupWithMembers, inviteToGroup } from "../../../../../lib/groups-supabase";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const owner = await findUserByEmail(session.user.email);
  if (!owner) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId } = await params;
  const group = await getGroupWithMembers(groupId);
  if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
  if (group.ownerId !== owner.id) return NextResponse.json({ error: "not owner" }, { status: 403 });

  const { userName } = await req.json();
  if (!userName?.trim()) return NextResponse.json({ error: "userName required" }, { status: 400 });

  const invitee = await findUserByName(userName.trim());
  if (!invitee) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (invitee.id === owner.id) return NextResponse.json({ error: "cannot invite yourself" }, { status: 400 });

  const already = group.members?.find(m => m.userId === invitee.id);
  if (already) return NextResponse.json({ error: "already invited" }, { status: 400 });

  const ok = await inviteToGroup(groupId, invitee.id);
  if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true, userName: invitee.name });
}
