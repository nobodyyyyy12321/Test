import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { followUser, unfollowUser, isFollowing } from "../../../../../lib/follows-firebase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target) return NextResponse.json({ error: "Target not found" }, { status: 404 });
  if (me.id === target.id) return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });

  const already = await isFollowing(me.id, target.id);
  if (already) return NextResponse.json({ ok: true });

  await followUser({
    followerId: me.id,
    followerName: me.name,
    followerAvatarUrl: me.avatarUrl,
    followingId: target.id,
    followingName: target.name,
    followingAvatarUrl: target.avatarUrl,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await unfollowUser(me.id, target.id);
  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getSessionUser();
  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target) return NextResponse.json({ following: false });
  if (!me) return NextResponse.json({ following: false });

  const following = await isFollowing(me.id, target.id);
  return NextResponse.json({ following });
}
