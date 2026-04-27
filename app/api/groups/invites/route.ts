import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail } from "../../../../lib/users-supabase";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await findUserByEmail(session.user.email);
  if (!user) return NextResponse.json({ error: "user not found" }, { status: 404 });

  const sb = getSupabaseAdmin();
  const { data: memberRows } = await sb
    .from("group_members")
    .select("group_id, invited_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("invited_at", { ascending: false });

  if (!memberRows?.length) return NextResponse.json({ invites: [] });

  const groupIds = memberRows.map((r: Record<string, unknown>) => r.group_id as string);
  const { data: groups } = await sb
    .from("groups")
    .select("id, name, owner_id")
    .in("id", groupIds);

  const ownerIds = [...new Set((groups ?? []).map((g: Record<string, unknown>) => g.owner_id as string))];
  const { data: owners } = ownerIds.length
    ? await sb.from("users").select("id, name").in("id", ownerIds)
    : { data: [] };

  const ownerMap = Object.fromEntries(
    (owners ?? []).map((o: Record<string, unknown>) => [o.id as string, o.name as string])
  );

  const invites = (groups ?? []).map((g: Record<string, unknown>) => {
    const row = memberRows.find((r: Record<string, unknown>) => r.group_id === g.id);
    return {
      groupId: g.id as string,
      groupName: g.name as string,
      ownerName: ownerMap[g.owner_id as string] ?? "",
      invitedAt: (row as Record<string, unknown>)?.invited_at as string,
    };
  });

  return NextResponse.json({ invites });
}
