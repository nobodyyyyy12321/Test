import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../lib/users";
import { getListById, updateList, deleteList } from "../../../../lib/lists-supabase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

export async function GET(_req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const list = await getListById(listId);
    if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const user = await getSessionUser();
    if (!list.isPublic && list.ownerId !== user?.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ list });
  } catch (e) {
    console.error("GET /api/lists/[listId] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await req.json();
    const updates: { title?: string; isPublic?: boolean } = {};
    if (typeof body.title === "string") updates.title = body.title.trim();
    if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;
    await updateList(listId, updates);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/lists/[listId] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteList(listId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/lists/[listId] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
