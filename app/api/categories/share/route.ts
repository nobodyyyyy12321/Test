import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../lib/users-supabase";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { shareCategoryWithUser } from "../../../../lib/shared-categories-supabase";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const { categoryKey, categoryName, targetUserName, groupId } = await req.json();
  if (!categoryKey?.trim() || !categoryName?.trim()) {
    return NextResponse.json({ error: "categoryKey and categoryName required" }, { status: 400 });
  }

  // Share to a single user
  if (targetUserName) {
    const target = await findUserByName(targetUserName.trim());
    if (!target) return NextResponse.json({ error: "user not found" }, { status: 404 });
    if (target.id === me.id) return NextResponse.json({ error: "cannot share with yourself" }, { status: 400 });
    await shareCategoryWithUser(me.id, target.id, categoryKey, categoryName);
    return NextResponse.json({ ok: true, count: 1 });
  }

  // Share to all accepted members of a group
  if (groupId) {
    const db = getSupabaseAdmin();
    const { data: groupRow } = await db.from("groups").select("owner_id").eq("id", groupId).single();
    if (!groupRow) return NextResponse.json({ error: "group not found" }, { status: 404 });
    const ownerId = (groupRow as Record<string, unknown>).owner_id as string;
    const isOwner = ownerId === me.id;
    if (!isOwner) {
      const { data: membership } = await db
        .from("group_members").select("status")
        .eq("group_id", groupId).eq("user_id", me.id).maybeSingle();
      if (membership?.status !== "accepted") {
        return NextResponse.json({ error: "not a member" }, { status: 403 });
      }
    }
    const { data: members } = await db
      .from("group_members").select("user_id")
      .eq("group_id", groupId).eq("status", "accepted");
    const recipientIds = (members ?? [])
      .map((m: Record<string, unknown>) => m.user_id as string)
      .filter(id => id !== me.id);
    await Promise.all(
      recipientIds.map(id => shareCategoryWithUser(me.id, id, categoryKey, categoryName))
    );
    return NextResponse.json({ ok: true, count: recipientIds.length });
  }

  return NextResponse.json({ error: "targetUserName or groupId required" }, { status: 400 });
}
