import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { isFolderPublicVisible, publicFolderDisplayParentId, type Folder } from "../../../../lib/folders-supabase";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") ?? "zh-TW";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "6", 10), 20);

  try {
    const db = getSupabaseAdmin();

    const { data: collections, error } = await db
      .from("qsets")
      .select("owner_id")
      .eq("language", language)
      .eq("is_public", true)
      .not("owner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: publicLists, error: publicListsError } = await db
      .from("lists")
      .select("owner_id")
      .eq("is_public", true)
      .not("owner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data: publicFolderOwners, error: publicFolderOwnerError } = await db
      .from("folders")
      .select("owner_id")
      .eq("is_public", true)
      .not("owner_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Fetch collections error:", error);
      return NextResponse.json({ users: [] });
    }

    if (publicListsError) {
      console.error("Fetch public lists error:", publicListsError);
      return NextResponse.json({ users: [] });
    }

    if (publicFolderOwnerError) {
      console.error("Fetch public folder owners error:", publicFolderOwnerError);
    }

    const userMap = new Map<string, number>();
    for (const row of collections ?? []) {
      if (row.owner_id) {
        userMap.set(row.owner_id, (userMap.get(row.owner_id) ?? 0) + 1);
      }
    }
    for (const row of publicLists ?? []) {
      if (row.owner_id) {
        userMap.set(row.owner_id, (userMap.get(row.owner_id) ?? 0) + 1);
      }
    }
    for (const row of publicFolderOwners ?? []) {
      if (row.owner_id) {
        userMap.set(row.owner_id, (userMap.get(row.owner_id) ?? 0) + 1);
      }
    }

    if (userMap.size === 0) {
      return NextResponse.json({ users: [] });
    }

    const topUserIds = Array.from(userMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map((e) => e[0]);

    type UserRow = { id: string; name: string; avatar_url: string | null };
    const { data: users, error: userError } = await db
      .from("users")
      .select("id,name,avatar_url")
      .in("id", topUserIds);

    if (userError || !users) {
      console.error("Fetch users error:", userError);
      return NextResponse.json({ users: [] });
    }

    const { data: userCategories, error: catError } = await db
      .from("qsets")
      .select("id,name,owner_id,is_public,problems_per_test,shuffle_problems,folder_id")
      .in("owner_id", topUserIds)
      .eq("language", language)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (catError) {
      console.error("Fetch categories error:", catError);
    }

    const qsetsByOwner = new Map<string, NonNullable<typeof userCategories>>();
    if (userCategories) {
      for (const cat of userCategories) {
        if (!qsetsByOwner.has(cat.owner_id)) {
          qsetsByOwner.set(cat.owner_id, []);
        }
        qsetsByOwner.get(cat.owner_id)!.push(cat);
      }
    }

    const { data: userLists, error: listError } = await db
      .from("lists")
      .select("id,title,owner_id,is_public,folder_id")
      .in("owner_id", topUserIds)
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (listError) {
      console.error("Fetch lists error:", listError);
    }

    const { data: userFolders, error: folderError } = await db
      .from("folders")
      .select("id,name,owner_id,parent_id,position,is_public")
      .in("owner_id", topUserIds)
      .order("created_at", { ascending: false });

    if (folderError) {
      console.error("Fetch folders error:", folderError);
    }

    const listsByOwner = new Map<string, NonNullable<typeof userLists>>();
    if (userLists) {
      for (const list of userLists) {
        if (!listsByOwner.has(list.owner_id)) {
          listsByOwner.set(list.owner_id, []);
        }
        listsByOwner.get(list.owner_id)!.push(list);
      }
    }

    const foldersByOwner = new Map<string, Folder[]>();
    if (userFolders) {
      const normalizedFolders: Folder[] = (userFolders as Array<{
        id: string;
        name: string;
        owner_id: string;
        parent_id: string | null;
        position: number;
        is_public: boolean;
      }>).map((folder) => ({
        id: folder.id,
        ownerId: folder.owner_id,
        parentId: folder.parent_id,
        name: folder.name,
        position: folder.position,
        isPublic: folder.is_public,
      }));
      for (const folder of normalizedFolders) {
        if (!foldersByOwner.has(folder.ownerId)) {
          foldersByOwner.set(folder.ownerId, []);
        }
        foldersByOwner.get(folder.ownerId)!.push(folder);
      }
    }

    const result = topUserIds
      .map((uid) => (users as UserRow[]).find((u) => u.id === uid))
      .filter(Boolean)
      .map((u) => {
        const ownerFolders = foldersByOwner.get(u!.id) ?? [];
        return {
          id: u!.id,
          name: u!.name,
          avatarUrl: u!.avatar_url,
          categories: (qsetsByOwner.get(u!.id) ?? []).map((cat) => ({
            id: cat.id,
            name: cat.name,
            parentId: publicFolderDisplayParentId(ownerFolders, cat.folder_id ?? null),
            problemsPerTest: cat.problems_per_test ?? null,
            shuffleProblems: cat.shuffle_problems ?? null,
          })),
          folders: ownerFolders
            .filter((folder) => isFolderPublicVisible(ownerFolders, folder.id))
            .map((folder) => ({
              id: folder.id,
              name: folder.name,
              parentId: publicFolderDisplayParentId(ownerFolders, folder.parentId),
            })),
          lists: (listsByOwner.get(u!.id) || []).map((list) => ({
            id: list.id,
            title: list.title,
            parentId: publicFolderDisplayParentId(ownerFolders, list.folder_id ?? null),
          })),
        };
      })
      .filter((u) => u.categories.length > 0 || u.folders.length > 0 || u.lists.length > 0);

    return NextResponse.json({ users: result });
  } catch (err) {
    console.error("Recommended users error:", err);
    return NextResponse.json({ users: [] });
  }
}
