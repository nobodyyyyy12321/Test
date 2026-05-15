import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getFoldersPayload, patchFolderOp } from "@/lib/my-folders-api";
import { getUserCollections, deleteUserCollection, upsertUserCollection, updateUserCollection, userOwnsCollection, countCollectionRefs } from "@/lib/user-collections-supabase";
import { deletePersonalQuizSet } from "@/lib/questions-supabase";
import { getPersonalTree, qsetParentId } from "@/lib/personal-tree";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string })?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const foldersOnly = ["1", "true", "yes"].includes((searchParams.get("foldersOnly") ?? "").toLowerCase());

  try {
    if (foldersOnly) {
      return NextResponse.json(await getFoldersPayload(user.id));
    }

    const allLanguages = ["1", "true", "yes"].includes((searchParams.get("allLanguages") ?? "").toLowerCase());
    const language = allLanguages ? undefined : (searchParams.get("language") ?? "zh-TW");
    const [collections, tree, foldersPayload] = await Promise.all([
      getUserCollections(user.id, language),
      getPersonalTree(user.id).catch(() => null),
      getFoldersPayload(user.id).catch(() => ({ folders: [], storageReady: false, warning: undefined as string | undefined })),
    ]);
    const withParents = tree
      ? collections.map((c) => ({
          ...c,
          parentId: qsetParentId(tree, c.collectionId),
        }))
      : collections;
    const warning = "warning" in foldersPayload ? foldersPayload.warning : undefined;
    return NextResponse.json({
      collections: withParents,
      folders: foldersPayload.folders,
      storageReady: foldersPayload.storageReady,
      ...(warning ? { warning } : {}),
    });
  } catch (err) {
    console.error("GET /api/my-collections error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.op === "string" && body.op.length > 0) {
    try {
      const result = await patchFolderOp(user.id, body);
      if (result.status !== 200) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true, folders: result.folders });
    } catch (err) {
      console.error("PATCH /api/my-collections (folder op) error:", err);
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message }, { status: 500 });
    }
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

  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) {
    if (displayName) {
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
