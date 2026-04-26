import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { getListById, addSharedResult } from "../../../../../lib/lists-supabase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

// POST /api/lists/[listId]/result  { answered, correct }
export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const list = await getListById(listId);
    if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // only record for sharedWith users, not the owner
    if (list.ownerId === user.id) return NextResponse.json({ ok: true });
    if (!(list.sharedWith ?? []).includes(user.name)) {
      return NextResponse.json({ error: "Not shared with you" }, { status: 403 });
    }

    const { answered, correct } = await req.json();
    if (typeof answered !== "number" || typeof correct !== "number") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    await addSharedResult(listId, user.name, {
      answered,
      correct,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/lists/[listId]/result error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
