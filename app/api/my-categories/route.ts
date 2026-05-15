import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import {
  addFolder,
  deleteFolder,
  foldersForClient,
  getPersonalTree,
  moveFolder,
  renameFolder,
  savePersonalTree,
  setListParent,
  setQsetParent,
  updateFolderPublic,
} from "@/lib/personal-tree";
import { userOwnsCollection } from "@/lib/user-collections-supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string })?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tree = await getPersonalTree(user.id);
    return NextResponse.json({ folders: foldersForClient(tree) });
  } catch (err) {
    console.error("GET /api/my-categories error:", err);
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
    let tree = await getPersonalTree(user.id);

    switch (op) {
      case "addFolder": {
        const name = typeof body.name === "string" ? body.name : "";
        const parentId =
          body.parentId === null || body.parentId === undefined
            ? null
            : typeof body.parentId === "string"
              ? body.parentId
              : null;
        tree = addFolder(tree, name, parentId);
        break;
      }
      case "deleteFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        tree = deleteFolder(tree, folderId);
        break;
      }
      case "renameFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        const name = typeof body.name === "string" ? body.name : "";
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        tree = renameFolder(tree, folderId, name);
        break;
      }
      case "updateFolderPublic": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        if (!folderId || typeof body.isPublic !== "boolean") {
          return NextResponse.json({ error: "folderId and isPublic required" }, { status: 400 });
        }
        tree = updateFolderPublic(tree, folderId, body.isPublic);
        break;
      }
      case "moveFolder": {
        const folderId = typeof body.folderId === "string" ? body.folderId : "";
        const parentId =
          body.parentId === null || body.parentId === undefined
            ? null
            : typeof body.parentId === "string"
              ? body.parentId
              : null;
        if (!folderId) return NextResponse.json({ error: "folderId required" }, { status: 400 });
        tree = moveFolder(tree, folderId, parentId);
        break;
      }
      case "moveCollection": {
        const categoryId = typeof body.categoryId === "string" ? body.categoryId : "";
        const folderId =
          body.folderId === null || body.folderId === undefined
            ? null
            : typeof body.folderId === "string"
              ? body.folderId
              : null;
        if (!categoryId) return NextResponse.json({ error: "categoryId required" }, { status: 400 });
        const language = typeof body.language === "string" ? body.language.trim() : undefined;
        const owns = await userOwnsCollection(user.id, categoryId, language);
        if (!owns) return NextResponse.json({ error: "not found" }, { status: 404 });
        tree = setQsetParent(tree, categoryId, folderId);
        break;
      }
      case "moveList": {
        const listId = typeof body.listId === "string" ? body.listId : "";
        const folderId =
          body.folderId === null || body.folderId === undefined
            ? null
            : typeof body.folderId === "string"
              ? body.folderId
              : null;
        if (!listId) return NextResponse.json({ error: "listId required" }, { status: 400 });
        const db = getSupabaseAdmin();
        const { data: listRow } = await db.from("lists").select("owner_id").eq("id", listId).maybeSingle();
        if (!listRow || listRow.owner_id !== user.id) {
          return NextResponse.json({ error: "not found" }, { status: 404 });
        }
        tree = setListParent(tree, listId, folderId);
        break;
      }
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 400 });
    }

    await savePersonalTree(user.id, tree);
    return NextResponse.json({ ok: true, folders: foldersForClient(tree) });
  } catch (err) {
    console.error("PATCH /api/my-categories error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
