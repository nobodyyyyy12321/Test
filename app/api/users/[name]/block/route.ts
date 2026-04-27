import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName, blockUser, unblockUser, isBlocking } from "../../../../../lib/users-supabase";
import { unfollowUser } from "../../../../../lib/follows-supabase";

async function getMe() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;
  return findUserByEmail(email);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getMe();
  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target || !me) return NextResponse.json({ blocking: false });
  const blocking = await isBlocking(me.id, target.id);
  return NextResponse.json({ blocking });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (me.id === target.id) return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  await blockUser(me.id, target.id);
  await Promise.all([
    unfollowUser(me.id, target.id),
    unfollowUser(target.id, me.id),
  ]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const me = await getMe();
  if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name } = await params;
  const target = await findUserByName(decodeURIComponent(name));
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await unblockUser(me.id, target.id);
  return NextResponse.json({ ok: true });
}
