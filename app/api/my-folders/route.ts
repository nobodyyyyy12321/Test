import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users-supabase";
import {
  listFolders,
  createFolder,
  renameFolder,
  updateFolderPublic,
  moveFolder,
  deleteFolder,
  setQsetFolder,
  setListFolder,
} from "@/lib/folders-supabase";
import { userOwnsCollection } from "@/lib/user-collections-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string })?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

function clientShape(folders: Awaited<ReturnType<typeof listFolders>>) {
  return folders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId, isPublic: f.isPublic }));
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const folders = await listFolders(user.id);
    return NextResponse.json({ folders: clientShape(folders) });
  } catch (err) {
    console.error("GET /api/my-folders error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, folders: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const op = typeof body.op === "string" ? body.op : "";
    const optionalString = (v: unknown): string | null =>
      v === null || v === undefined ? null : typeof v === "string" ? v : null;

    switch (op) {
      case "addFolder": {
        const name = typeof body.name === "string" ? body.name : "";
        const parentId = optionalString(body.parentId);
        await createFolder(user.id, name, parentId);
        break;
      }
      case "renameFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        const name = typeof body.name === "string" ? body.name : "";
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        await renameFolder(user.id, folderId, name);
        break;
      }
      case "updateFolderPublic": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        if (!folderId || typeof body.isPublic !== "boolean") {
          return NextResponse.json({ error: "folderId and isPublic required" }, { status: 400 });
        }
        await updateFolderPublic(user.id, folderId, body.isPublic);
        break;
      }
      case "moveFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        const parentId = optionalString(body.parentId);
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        await moveFolder(user.id, folderId, parentId);
        break;
      }
      case "deleteFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        await deleteFolder(user.id, folderId);
        break;
      }
      case "moveCollection": {
        const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
        const folderId = optionalString(body.folderId);
        if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 });
        const language = typeof body.language === "string" ? body.language.trim() : undefined;
        const owns = await userOwnsCollection(user.id, categoryId, language);
        if (!owns) return NextResponse.json({ error: "not found" }, { status: 404 });
        await setQsetFolder(user.id, categoryId, folderId);
        break;
      }
      case "moveList": {
        const listId = typeof body.listId === "string" ? body.listId : "";
        const folderId = optionalString(body.folderId);
        if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });
        await setListFolder(user.id, listId, folderId);
        break;
      }
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 400 });
    }

    const folders = await listFolders(user.id);
    return NextResponse.json({ ok: true, folders: clientShape(folders) });
  } catch (err) {
    console.error("PATCH /api/my-folders error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
