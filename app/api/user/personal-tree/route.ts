import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import {
  getPersonalTree,
  setPersonalTree,
  upsertCategoryRef,
  removeCategoryRef,
  addFolder,
  renameFolder,
  deleteFolder,
  setItemFolder,
  type ItemKind,
} from "@/lib/personal-tree";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tree = await getPersonalTree(user.id);
  return NextResponse.json({ tree });
}

type Op =
  | { op: "addCategoryRef"; key: string; name: string; folderId?: string | null }
  | { op: "removeCategoryRef"; id: string }
  | { op: "addFolder"; name: string; parentId?: string | null }
  | { op: "renameFolder"; id: string; name: string }
  | { op: "deleteFolder"; id: string }
  | { op: "setItemFolder"; kind: ItemKind; id: string; folderId: string | null };

export async function PATCH(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Op;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    let tree = await getPersonalTree(user.id);

    switch (body.op) {
      case "addCategoryRef": {
        const key = typeof body.key === "string" ? body.key.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!key || !name) {
          return NextResponse.json({ error: "key and name required" }, { status: 400 });
        }
        const result = upsertCategoryRef(tree, { key, name, folderId: body.folderId ?? null });
        tree = result.tree;
        if (result.created) await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree, ref: result.ref, created: result.created });
      }
      case "removeCategoryRef": {
        const id = typeof body.id === "string" ? body.id.trim() : "";
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        tree = removeCategoryRef(tree, id);
        await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree });
      }
      case "addFolder": {
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
        const result = addFolder(tree, { name, parentId: body.parentId ?? null });
        tree = result.tree;
        await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree, folder: result.folder });
      }
      case "renameFolder": {
        const id = typeof body.id === "string" ? body.id.trim() : "";
        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!id || !name) return NextResponse.json({ error: "id and name required" }, { status: 400 });
        tree = renameFolder(tree, id, name);
        await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree });
      }
      case "deleteFolder": {
        const id = typeof body.id === "string" ? body.id.trim() : "";
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        tree = deleteFolder(tree, id);
        await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree });
      }
      case "setItemFolder": {
        const id = typeof body.id === "string" ? body.id.trim() : "";
        if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
        const folderId = body.folderId ?? null;
        const validKinds = ["list", "collection", "ref", "folder"] as const;
        if (!validKinds.includes(body.kind as typeof validKinds[number])) {
          return NextResponse.json({ error: "invalid kind" }, { status: 400 });
        }
        tree = setItemFolder(tree, body.kind, id, folderId);
        await setPersonalTree(user.id, tree);
        return NextResponse.json({ tree });
      }
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("PATCH /api/user/personal-tree error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
