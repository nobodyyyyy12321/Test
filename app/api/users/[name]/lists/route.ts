import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users";
import { getPublicListsByOwner } from "../../../../../lib/lists-supabase";
import { getUserCollections } from "../../../../../lib/user-collections-supabase";
import { listFolders, isFolderPublicVisible, publicFolderDisplayParentId } from "../../../../../lib/folders-supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const user = await findUserByName(decodeURIComponent(name));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [lists, collections, allFolders] = await Promise.all([
      getPublicListsByOwner(user.id),
      getUserCollections(user.id),
      listFolders(user.id).catch(() => []),
    ]);

    const folders = allFolders
      .filter((f) => isFolderPublicVisible(allFolders, f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        parentId: publicFolderDisplayParentId(allFolders, f.parentId),
        isPublic: true,
      }));

    const publicCollections = collections
      .filter(
        (collection) =>
          collection.isPublic &&
          collection.approvalStatus !== "pending" &&
          collection.approvalStatus !== "rejected"
      )
      .map((collection) => ({
        ...collection,
        parentId: publicFolderDisplayParentId(allFolders, collection.parentId),
      }));

    const publicLists = lists.map((list) => ({
      ...list,
      parentId: publicFolderDisplayParentId(allFolders, list.parentId),
    }));

    return NextResponse.json({ lists: publicLists, collections: publicCollections, folders });
  } catch (e) {
    console.error("GET /api/users/[name]/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
