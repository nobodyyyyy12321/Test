import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { getListById, copyList } from "../../../../../lib/lists-supabase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

export async function POST(_req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const source = await getListById(listId);
    if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // must be owner or in sharedWith
    const allowed = source.ownerId === user.id || (source.sharedWith ?? []).includes(user.name);
    if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newList = await copyList(listId, user.id);
    return NextResponse.json({ list: newList });
  } catch (e) {
    console.error("POST /api/lists/[listId]/copy error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
