import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { findUserByEmail, findUserByName } from "../../../lib/users-supabase";
import { getListsByOwner, createList } from "../../../lib/lists-supabase";
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

    const lists = await getListsByOwner(user.id);
    return NextResponse.json({ lists });
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
