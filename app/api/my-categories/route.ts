import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import {
  createUserFolder,
  deleteUserFolder,
  getUserFolders,
  moveUserCollectionToFolder,
  moveUserFolder,
  renameUserFolder,
  updateFolderPublicStatus,
} from "@/lib/user-collections-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as any)?.email as string | undefined;
  const name = (session?.user as any)?.name as string | undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const language = searchParams.get("language") ?? "zh-TW";
  const folders = await getUserFolders(user.id, language);
  return NextResponse.json({ folders });
}

type PatchBody =
  | { op: "addFolder"; name: string; parentId?: string | null; language?: string }
  | { op: "renameFolder"; folderId: string; name: string }
  | { op: "moveFolder"; folderId: string; parentId: string | null }
  | { op: "deleteFolder"; folderId: string }
  | { op: "moveCollection"; categoryId: string; folderId: string | null }
  | { op: "updateFolderPublic"; folderId: string; isPublic: boolean };

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    switch (body.op) {
      case "addFolder": {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
        const language = body.language ?? "zh-TW";
        const folder = await createUserFolder(user.id, language, name, body.parentId ?? null);
        return NextResponse.json({ ok: true, folder });
      }
      case "renameFolder": {
        await renameUserFolder(user.id, body.folderId, body.name.trim());
        return NextResponse.json({ ok: true });
      }
      case "moveFolder": {
        await moveUserFolder(user.id, body.folderId, body.parentId ?? null);
        return NextResponse.json({ ok: true });
      }
      case "deleteFolder": {
        await deleteUserFolder(user.id, body.folderId);
        return NextResponse.json({ ok: true });
      }
      case "moveCollection": {
        await moveUserCollectionToFolder(user.id, body.categoryId, body.folderId ?? null);
        return NextResponse.json({ ok: true });
      }
      case "updateFolderPublic": {
        await updateFolderPublicStatus(user.id, body.folderId, body.isPublic);
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: "Unknown op" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
