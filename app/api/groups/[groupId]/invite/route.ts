import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName, hasBlockRelationship } from "../../../../../lib/users-supabase";
import { inviteToGroup } from "../../../../../lib/groups-supabase";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

type Params = { params: Promise<{ groupId: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const currentUser = await findUserByEmail(session.user.email);
  if (!currentUser) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { groupId } = await params;
  const sb = getSupabaseAdmin();

  const { data: groupRow } = await sb.from("groups").select("owner_id").eq("id", groupId).single();
  if (!groupRow) return NextResponse.json({ error: "group not found" }, { status: 404 });

  const isOwner = (groupRow as Record<string, unknown>).owner_id === currentUser.id;
  if (!isOwner) {
    const { data: membership } = await sb
      .from("group_members")
      .select("status")
      .eq("group_id", groupId)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (membership?.status !== "accepted") {
      return NextResponse.json({ error: "not a member" }, { status: 403 });
    }
  }

  const { userName } = await req.json();
  if (!userName?.trim()) return NextResponse.json({ error: "userName required" }, { status: 400 });

  const invitee = await findUserByName(userName.trim());
  if (!invitee) return NextResponse.json({ error: "user not found" }, { status: 404 });
  if (invitee.id === currentUser.id) return NextResponse.json({ error: "cannot invite yourself" }, { status: 400 });

  const blocked = await hasBlockRelationship(currentUser.id, invitee.id);
  if (blocked) return NextResponse.json({ error: "無法邀請該帳號" }, { status: 403 });

  const { data: existing } = await sb
    .from("group_members")
    .select("status")
    .eq("group_id", groupId)
    .eq("user_id", invitee.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "already invited" }, { status: 400 });

  const ok = await inviteToGroup(groupId, invitee.id);
  if (!ok) return NextResponse.json({ error: "failed" }, { status: 500 });

  return NextResponse.json({ ok: true, userName: invitee.name });
}
