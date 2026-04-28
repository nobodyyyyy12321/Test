import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getUserCollections, deleteUserCollection } from "@/lib/user-collections-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as any)?.email as string | undefined;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const collections = await getUserCollections(user.id);
  return NextResponse.json({ collections });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const collectionId = searchParams.get("collectionId");
  if (!collectionId) return NextResponse.json({ error: "collectionId required" }, { status: 400 });

  await deleteUserCollection(user.id, collectionId);
  return NextResponse.json({ ok: true });
}
