import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail } from "../../../../../lib/users-supabase";
import { acceptGroupInvite } from "../../../../../lib/groups-supabase";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId } = await params;
  const ok = await acceptGroupInvite(groupId, user.id);
  if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
