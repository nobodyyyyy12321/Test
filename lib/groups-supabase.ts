import { getSupabaseAdmin } from "./supabase-admin";

export type Group = {
  id: string;
  name: string;
  ownerId: string;
  ownerName?: string;
  ownerAvatarUrl?: string;
  createdAt: string;
  memberCount?: number;
  members?: GroupMember[];
};

export type GroupMember = {
  userId: string;
  userName: string;
  avatarUrl?: string;
  status: "pending" | "accepted";
  invitedAt: string;
};

function mapGroup(row: Record<string, unknown>): Group {
  return {
    id: row.id as string,
    name: row.name as string,
    ownerId: row.owner_id as string,
    createdAt: row.created_at as string,
  };
}

export async function getGroupsByUser(userId: string): Promise<{ owned: Group[]; joined: Group[] }> {
  const sb = getSupabaseAdmin();

  const { data: owned } = await sb
    .from("groups")
    .select("*")
    .eq("owner_id", userId)
    .order("created_at", { ascending: false });

  const { data: memberRows } = await sb
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId)
    .eq("status", "accepted");

  const joinedIds = memberRows?.map((r: Record<string, unknown>) => r.group_id as string) ?? [];
  let joined: Group[] = [];
  if (joinedIds.length > 0) {
    const { data: joinedGroups } = await sb
      .from("groups")
      .select("*")
      .in("id", joinedIds)
      .order("created_at", { ascending: false });

    // Resolve ownerName for joined groups
    const ownerIds = [...new Set((joinedGroups ?? []).map((g: Record<string, unknown>) => g.owner_id as string))];
    const ownerMap: Record<string, { name: string; avatarUrl?: string }> = {};
    if (ownerIds.length > 0) {
      const { data: owners } = await sb.from("users").select("id,name,avatar_url").in("id", ownerIds);
      for (const o of owners ?? []) {
        const row = o as Record<string, unknown>;
        ownerMap[row.id as string] = { name: row.name as string, avatarUrl: row.avatar_url as string | undefined };
      }
    }

    joined = (joinedGroups ?? []).map((g: Record<string, unknown>) => ({
      ...mapGroup(g),
      ownerName: ownerMap[g.owner_id as string]?.name,
      ownerAvatarUrl: ownerMap[g.owner_id as string]?.avatarUrl,
    }));
  }

  // Attach member counts
  const allIds = [...(owned ?? []).map((g: Record<string, unknown>) => g.id as string), ...joinedIds];
  const countMap: Record<string, number> = {};
  if (allIds.length > 0) {
    const { data: counts } = await sb
      .from("group_members")
      .select("group_id")
      .in("group_id", allIds)
      .eq("status", "accepted");
    for (const row of counts ?? []) {
      const gid = (row as Record<string, unknown>).group_id as string;
      countMap[gid] = (countMap[gid] ?? 0) + 1;
    }
  }

  const withCount = (g: Group) => ({ ...g, memberCount: countMap[g.id] ?? 0 });

  return {
    owned: (owned ?? []).map(mapGroup).map(withCount),
    joined: joined.map(withCount),
  };
}

export async function getGroupWithMembers(groupId: string): Promise<Group | null> {
  const sb = getSupabaseAdmin();

  const { data: group } = await sb.from("groups").select("*").eq("id", groupId).single();
  if (!group) return null;

  const { data: memberRows } = await sb
    .from("group_members")
    .select("user_id, status, invited_at")
    .eq("group_id", groupId)
    .order("invited_at", { ascending: true });

  const members: GroupMember[] = [];
  for (const m of memberRows ?? []) {
    const row = m as Record<string, unknown>;
    const { data: u } = await sb
      .from("users")
      .select("name, avatar_url")
      .eq("id", row.user_id as string)
      .single();
    members.push({
      userId: row.user_id as string,
      userName: (u as Record<string, unknown>)?.name as string ?? "",
      avatarUrl: (u as Record<string, unknown>)?.avatar_url as string | undefined,
      status: row.status as "pending" | "accepted",
      invitedAt: row.invited_at as string,
    });
  }

  const { data: owner } = await sb.from("users").select("name,avatar_url").eq("id", (group as Record<string, unknown>).owner_id as string).single();

  return {
    ...mapGroup(group as Record<string, unknown>),
    ownerName: (owner as Record<string, unknown>)?.name as string | undefined,
    ownerAvatarUrl: (owner as Record<string, unknown>)?.avatar_url as string | undefined,
    memberCount: members.filter(m => m.status === "accepted").length,
    members,
  };
}

export async function createGroup(ownerId: string, name: string): Promise<Group | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("groups")
    .insert({ name, owner_id: ownerId })
    .select()
    .single();
  if (error || !data) return null;
  return mapGroup(data as Record<string, unknown>);
}

export async function deleteGroup(groupId: string, ownerId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("groups").delete().eq("id", groupId).eq("owner_id", ownerId);
  return !error;
}

export async function inviteToGroup(groupId: string, userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("group_members")
    .upsert({ group_id: groupId, user_id: userId, status: "pending" }, { onConflict: "group_id,user_id" });
  return !error;
}

export async function acceptGroupInvite(groupId: string, userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("group_members")
    .update({ status: "accepted" })
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .eq("status", "pending");
  return !error;
}

export async function removeGroupMember(groupId: string, userId: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", userId);
  return !error;
}

