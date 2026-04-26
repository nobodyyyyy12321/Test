import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { findUserByEmail, findUserByName, findUserById } from "../../../lib/users";
import { getListsByOwner, getListsSharedWithUser, createList } from "../../../lib/lists-supabase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [ownLists, sharedLists] = await Promise.all([
      getListsByOwner(user.id),
      getListsSharedWithUser(user.name),
    ]);

    // resolve ownerName for shared lists
    const ownerCache = new Map<string, string>();
    const sharedWithOwner = await Promise.all(
      sharedLists.map(async list => {
        if (!ownerCache.has(list.ownerId)) {
          const owner = await findUserById(list.ownerId);
          ownerCache.set(list.ownerId, owner?.name ?? list.ownerId);
        }
        return { ...list, ownerName: ownerCache.get(list.ownerId) };
      })
    );

    return NextResponse.json({ lists: ownLists, sharedLists: sharedWithOwner });
  } catch (e) {
    console.error("GET /api/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { title } = await req.json();
    if (!title || typeof title !== "string") return NextResponse.json({ error: "Title required" }, { status: 400 });
    const list = await createList(user.id, title.trim());
    return NextResponse.json({ list });
  } catch (e) {
    console.error("POST /api/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
