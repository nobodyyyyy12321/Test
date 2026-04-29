import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getUserCollections, deleteUserCollection, upsertUserCollection, countCollectionRefs } from "@/lib/user-collections-supabase";
import { deleteAllQuizQuestions } from "@/lib/questions-supabase";

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

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { collectionId?: unknown; displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const collectionId = typeof body.collectionId === "string" ? body.collectionId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!collectionId || !displayName) {
    return NextResponse.json({ error: "collectionId and displayName required" }, { status: 400 });
  }

  await upsertUserCollection(user.id, collectionId, displayName, true);
  const collections = await getUserCollections(user.id);
  return NextResponse.json({ ok: true, collections });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { collectionId?: unknown; displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const collectionId = typeof body.collectionId === "string" ? body.collectionId.trim() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  if (!collectionId || !displayName) {
    return NextResponse.json({ error: "collectionId and displayName required" }, { status: 400 });
  }

  await upsertUserCollection(user.id, collectionId, displayName);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const collectionId = searchParams.get("collectionId");
  if (!collectionId) return NextResponse.json({ error: "collectionId required" }, { status: 400 });

  await deleteUserCollection(user.id, collectionId);

  // If no other user still references this collection, also wipe the questions
  // so the collection effectively disappears from the database.
  const remaining = await countCollectionRefs(collectionId);
  if (remaining === 0) {
    await deleteAllQuizQuestions(collectionId).catch(err => {
      console.error("deleteAllQuizQuestions failed:", err);
    });
  }

  return NextResponse.json({ ok: true });
}
