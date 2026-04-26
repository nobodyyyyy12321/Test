import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { getListById, unshareListWithUser } from "../../../../../lib/lists-supabase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

// DELETE — current user removes themselves from sharedWith
export async function DELETE(_req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await getListById(listId);
    if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!(list.sharedWith ?? []).includes(user.name)) {
      return NextResponse.json({ error: "Not shared with you" }, { status: 403 });
    }

    await unshareListWithUser(listId, user.name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/lists/[listId]/unsubscribe error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
