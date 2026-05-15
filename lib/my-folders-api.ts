import {
  addFolder,
  deleteFolder,
  foldersForClient,
  getPersonalTree,
  hasPersonalTreeColumn,
  moveFolder,
  renameFolder,
  savePersonalTree,
  setListParent,
  setQsetParent,
  updateFolderPublic,
} from "./personal-tree";
import { userOwnsCollection } from "./user-collections-supabase";
import { getSupabaseAdmin } from "./supabase-admin";

export async function getFoldersPayload(userId: string) {
  const [tree, storageReady] = await Promise.all([
    getPersonalTree(userId),
    hasPersonalTreeColumn(),
  ]);
  return {
    folders: foldersForClient(tree),
    storageReady,
    ...(storageReady
      ? {}
      : {
          warning:
            "請在 Supabase 執行 scripts/add-personal-tree-to-users.sql 以儲存資料夾",
        }),
  };
}

export async function patchFolderOp(userId: string, body: Record<string, unknown>) {
  const op = typeof body.op === "string" ? body.op : "";
  let tree = await getPersonalTree(userId);

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
      if (!folderId) return { status: 400 as const, error: "folderId required" };
      tree = deleteFolder(tree, folderId);
      break;
    }
    case "renameFolder": {
      const folderId = typeof body.folderId === "string" ? body.folderId : "";
      const name = typeof body.name === "string" ? body.name : "";
      if (!folderId) return { status: 400 as const, error: "folderId required" };
      tree = renameFolder(tree, folderId, name);
      break;
    }
    case "updateFolderPublic": {
      const folderId = typeof body.folderId === "string" ? body.folderId : "";
      if (!folderId || typeof body.isPublic !== "boolean") {
        return { status: 400 as const, error: "folderId and isPublic required" };
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
      if (!folderId) return { status: 400 as const, error: "folderId required" };
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
      if (!categoryId) return { status: 400 as const, error: "categoryId required" };
      const language = typeof body.language === "string" ? body.language.trim() : undefined;
      const owns = await userOwnsCollection(userId, categoryId, language);
      if (!owns) return { status: 404 as const, error: "not found" };
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
      if (!listId) return { status: 400 as const, error: "listId required" };
      const db = getSupabaseAdmin();
      const { data: listRow } = await db.from("lists").select("owner_id").eq("id", listId).maybeSingle();
      if (!listRow || listRow.owner_id !== userId) {
        return { status: 404 as const, error: "not found" };
      }
      tree = setListParent(tree, listId, folderId);
      break;
    }
    default:
      return { status: 400 as const, error: "unknown op" };
  }

  await savePersonalTree(userId, tree);
  return { status: 200 as const, ok: true, folders: foldersForClient(tree) };
}
