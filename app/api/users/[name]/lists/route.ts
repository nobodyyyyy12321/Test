import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users";
import { getPublicListsByOwner } from "../../../../../lib/lists-supabase";
import { getPersonalTree, isPublicFolderVisible, listParentId, publicFolderDisplayParentId, qsetParentId } from "../../../../../lib/personal-tree";
import { getUserCollections } from "../../../../../lib/user-collections-supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const user = await findUserByName(decodeURIComponent(name));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [lists, collections, tree] = await Promise.all([
      getPublicListsByOwner(user.id),
      getUserCollections(user.id),
      getPersonalTree(user.id).catch(() => null),
    ]);

    const folders = tree
      ? tree.folders
          .filter((folder) => isPublicFolderVisible(tree, folder.id))
          .map((folder) => ({
            id: folder.id,
            name: folder.name,
            parentId: publicFolderDisplayParentId(tree, folder.parentId),
            isPublic: true,
          }))
      : [];

    const publicCollections = collections
      .filter((collection) => collection.isPublic && collection.approvalStatus !== "pending" && collection.approvalStatus !== "rejected")
      .map((collection) => ({
        ...collection,
        parentId: tree ? publicFolderDisplayParentId(tree, qsetParentId(tree, collection.collectionId)) : null,
      }));

    const publicLists = lists.map((list) => ({
      ...list,
      parentId: tree ? publicFolderDisplayParentId(tree, listParentId(tree, list.id)) : null,
    }));

    return NextResponse.json({ lists: publicLists, collections: publicCollections, folders });
  } catch (e) {
    console.error("GET /api/users/[name]/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
