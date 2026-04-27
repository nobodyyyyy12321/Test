import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { findUserByEmail } from "../../../../../../lib/users-supabase";
import { getGroupWithMembers, removeGroupMember } from "../../../../../../lib/groups-supabase";

type Params = { params: Promise<{ groupId: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const requester = await findUserByEmail(session.user.email);
  if (!requester) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId, userId } = await params;

  // Allow owner to remove anyone, or member to remove themselves (leave)
  if (requester.id !== userId) {
    const group = await getGroupWithMembers(groupId);
    if (!group) return NextResponse.json({ error: "group not found" }, { status: 404 });
    if (group.ownerId !== requester.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ok = await removeGroupMember(groupId, userId);
  if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
