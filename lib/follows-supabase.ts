import { getSupabaseAdmin } from "./supabase-admin";
import { v4 as uuidv4 } from "uuid";

export type Follow = {
  id: string;
  followerId: string;
  followerName: string;
  followerAvatarUrl?: string;
  followingId: string;
  followingName: string;
  followingAvatarUrl?: string;
  createdAt: string;
};

function rowToFollow(row: Record<string, unknown>): Follow {
  return {
    id: row.id as string,
    followerId: row.follower_id as string,
    followerName: row.follower_name as string,
    followerAvatarUrl: (row.follower_avatar_url as string | null) ?? undefined,
    followingId: row.following_id as string,
    followingName: row.following_name as string,
    followingAvatarUrl: (row.following_avatar_url as string | null) ?? undefined,
    createdAt: row.created_at as string,
  };
}

export async function getFollowers(userId: string): Promise<Follow[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("follows").select("*").eq("following_id", userId);
  return (data ?? []).map(rowToFollow);
}

export async function getFollowing(userId: string): Promise<Follow[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("follows").select("*").eq("follower_id", userId);
  return (data ?? []).map(rowToFollow);
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .maybeSingle();
  return !!data;
}

export async function followUser(follow: Omit<Follow, "id">): Promise<string> {
  const db = getSupabaseAdmin();
  const id = uuidv4();
  const { error } = await db.from("follows").insert({
    id,
    follower_id: follow.followerId,
    follower_name: follow.followerName,
    follower_avatar_url: follow.followerAvatarUrl ?? null,
    following_id: follow.followingId,
    following_name: follow.followingName,
    following_avatar_url: follow.followingAvatarUrl ?? null,
    created_at: follow.createdAt,
  });
  if (error) throw error;
  return id;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);
  if (error) throw error;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { count } = await db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("following_id", userId);
  return count ?? 0;
}

export async function getFollowingCount(userId: string): Promise<number> {
  const db = getSupabaseAdmin();
  const { count } = await db
    .from("follows")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", userId);
  return count ?? 0;
}
