import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { getListById, shareListWithUser, unshareListWithUser } from "../../../../../lib/lists-firebase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

// POST /api/lists/[listId]/share  { targetName: string }
export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { targetName } = await req.json();
    if (!targetName || typeof targetName !== "string") return NextResponse.json({ error: "targetName required" }, { status: 400 });
    if (targetName === user.name) return NextResponse.json({ error: "不能分享給自己" }, { status: 400 });

    const target = await findUserByName(targetName.trim());
    if (!target) return NextResponse.json({ error: "找不到該帳號" }, { status: 404 });

    await shareListWithUser(listId, target.name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/lists/[listId]/share error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// DELETE /api/lists/[listId]/share  { targetName: string }
export async function DELETE(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { targetName } = await req.json();
    if (!targetName || typeof targetName !== "string") return NextResponse.json({ error: "targetName required" }, { status: 400 });

    await unshareListWithUser(listId, targetName.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/lists/[listId]/share error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
