import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { isFolderPublicVisible, publicFolderDisplayParentId, type Folder } from "../../../lib/folders-supabase";

type PopularQset = {
  kind: "qset";
  id: string;
  name: string;
  ownerId: string;
  problemsPerTest: number | null;
  shuffleProblems: boolean | null;
  visitCount: number;
};
type PopularList = {
  kind: "list";
  id: string;
  title: string;
  ownerId: string;
  visitCount: number;
};
type PopularFolder = {
  kind: "folder";
  id: string;
  name: string;
  ownerId: string;
  visitCount: number;
  children: PopularItem[];
};
type PopularItem = PopularQset | PopularList | PopularFolder;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get("language") ?? "zh-TW";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10), 1), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  try {
    const db = getSupabaseAdmin();
    const [qsetsRes, listsRes, foldersRes] = await Promise.all([
      db
        .from("qsets")
        .select("id,name,owner_id,folder_id,problems_per_test,shuffle_problems,visit_count")
        .eq("language", language)
        .eq("is_public", true),
      db
        .from("lists")
        .select("id,title,owner_id,folder_id,visit_count")
        .eq("is_public", true),
      db
        .from("folders")
        .select("id,name,owner_id,parent_id,position,is_public")
        .eq("is_public", true),
    ]);

    if (qsetsRes.error || listsRes.error || foldersRes.error) {
      console.error("popular: db error", { q: qsetsRes.error, l: listsRes.error, f: foldersRes.error });
      return NextResponse.json({ items: [], total: 0, hasMore: false });
    }

    const foldersByOwner = new Map<string, Folder[]>();
    for (const f of foldersRes.data ?? []) {
      const folder: Folder = {
        id: f.id,
        ownerId: f.owner_id,
        parentId: f.parent_id,
        name: f.name,
        position: f.position,
        isPublic: f.is_public,
      };
      if (!foldersByOwner.has(f.owner_id)) foldersByOwner.set(f.owner_id, []);
      foldersByOwner.get(f.owner_id)!.push(folder);
    }

    const qsetsByDisplayParent = new Map<string | null, PopularQset[]>();
    for (const q of qsetsRes.data ?? []) {
      const ownerFolders = foldersByOwner.get(q.owner_id) ?? [];
      const dp = publicFolderDisplayParentId(ownerFolders, q.folder_id ?? null);
      const arr = qsetsByDisplayParent.get(dp) ?? [];
      arr.push({
        kind: "qset",
        id: q.id,
        name: q.name,
        ownerId: q.owner_id,
        problemsPerTest: q.problems_per_test ?? null,
        shuffleProblems: q.shuffle_problems ?? null,
        visitCount: q.visit_count ?? 0,
      });
      qsetsByDisplayParent.set(dp, arr);
    }

    const listsByDisplayParent = new Map<string | null, PopularList[]>();
    for (const l of listsRes.data ?? []) {
      const ownerFolders = foldersByOwner.get(l.owner_id) ?? [];
      const dp = publicFolderDisplayParentId(ownerFolders, l.folder_id ?? null);
      const arr = listsByDisplayParent.get(dp) ?? [];
      arr.push({
        kind: "list",
        id: l.id,
        title: l.title,
        ownerId: l.owner_id,
        visitCount: l.visit_count ?? 0,
      });
      listsByDisplayParent.set(dp, arr);
    }

    type VisibleFolderNode = { folder: Folder; displayParentId: string | null };
    const foldersByDisplayParent = new Map<string | null, VisibleFolderNode[]>();
    for (const [ownerId, ownerFolders] of foldersByOwner) {
      for (const folder of ownerFolders) {
        if (!isFolderPublicVisible(ownerFolders, folder.id)) continue;
        const displayParentId = publicFolderDisplayParentId(ownerFolders, folder.parentId);
        const arr = foldersByDisplayParent.get(displayParentId) ?? [];
        arr.push({ folder, displayParentId });
        foldersByDisplayParent.set(displayParentId, arr);
      }
    }

    const buildFolder = (node: VisibleFolderNode): PopularFolder | null => {
      const children: PopularItem[] = [];
      for (const q of qsetsByDisplayParent.get(node.folder.id) ?? []) children.push(q);
      for (const l of listsByDisplayParent.get(node.folder.id) ?? []) children.push(l);
      for (const sf of foldersByDisplayParent.get(node.folder.id) ?? []) {
        const built = buildFolder(sf);
        if (built) children.push(built);
      }
      if (children.length === 0) return null;
      children.sort((a, b) => b.visitCount - a.visitCount);
      const visitCount = children.reduce((sum, c) => sum + c.visitCount, 0);
      return {
        kind: "folder",
        id: node.folder.id,
        name: node.folder.name,
        ownerId: node.folder.ownerId,
        visitCount,
        children,
      };
    };

    const rootItems: PopularItem[] = [];
    for (const q of qsetsByDisplayParent.get(null) ?? []) rootItems.push(q);
    for (const l of listsByDisplayParent.get(null) ?? []) rootItems.push(l);
    for (const f of foldersByDisplayParent.get(null) ?? []) {
      const built = buildFolder(f);
      if (built) rootItems.push(built);
    }

    rootItems.sort((a, b) => b.visitCount - a.visitCount);

    const total = rootItems.length;
    const paged = rootItems.slice(offset, offset + limit);

    return NextResponse.json({ items: paged, total, hasMore: offset + limit < total });
  } catch (err) {
    console.error("popular error:", err);
    return NextResponse.json({ items: [], total: 0, hasMore: false });
  }
}
