import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getUserCollections, deleteUserCollection, upsertUserCollection, updateUserCollection, userOwnsCollection, countCollectionRefs } from "@/lib/user-collections-supabase";
import { deletePersonalQuizSet } from "@/lib/questions-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as any)?.email as string | undefined;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const allLanguages = ["1", "true", "yes"].includes((searchParams.get("allLanguages") ?? "").toLowerCase());
  const language = allLanguages ? undefined : (searchParams.get("language") ?? "zh-TW");
  const collections = await getUserCollections(user.id, language);
  return NextResponse.json({ collections });
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { collectionId?: unknown; displayName?: unknown; isPublic?: unknown; language?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const collectionId = typeof body.collectionId === "string" ? body.collectionId.trim() : "";
  const language = typeof body.language === "string" ? body.language.trim() : "zh-TW";
  if (!collectionId) {
    return NextResponse.json({ error: "collectionId required" }, { status: 400 });
  }
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : undefined;
  const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : undefined;
  if (displayName === undefined && isPublic === undefined) {
    return NextResponse.json({ error: "no updates" }, { status: 400 });
  }

  // PATCH is only valid for collections the user already owns. For first-time create, use POST.
  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) {
    if (displayName) {
      // back-compat: callers used to PATCH for upsert-style display name updates
      await upsertUserCollection(user.id, collectionId, displayName, false, language);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  await updateUserCollection(user.id, collectionId, { displayName, isPublic }, language);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const collectionId = searchParams.get("collectionId");
  const language = searchParams.get("language") ?? "zh-TW";
  if (!collectionId) return NextResponse.json({ error: "collectionId required" }, { status: 400 });

  const deletedOwn = await deleteUserCollection(user.id, collectionId, language);

  // Only cascade-drop the underlying questions table if THIS user actually
  // owned a row (so we never drop built-in collections the user merely had a
  // category-ref to) AND no other user still references this collection.
  const remaining = await countCollectionRefs(collectionId, language);
  let tableDeleteError: string | null = null;
  if (deletedOwn && remaining === 0) {
    try {
      await deletePersonalQuizSet(user.id, collectionId);
    } catch (err) {
      tableDeleteError = err instanceof Error ? err.message : String(err);
      console.error("deletePersonalQuizSet failed:", err);
    }
  }

  return NextResponse.json({ ok: true, deletedOwn, tableDeleteError });
}
