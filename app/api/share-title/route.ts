import { getCategoriesCached, type CategoryNode } from "@/lib/categories";
import { getAnyCollectionDisplayName } from "@/lib/user-collections-supabase";

function findNameInTree(nodes: CategoryNode[], id: string, levels?: string | null): string | null {
  for (const node of nodes) {
    if (node.href) {
      const url = new URL(node.href, "http://x");
      if (url.pathname === `/test/${id}`) {
        if (!levels || !url.searchParams.get("levels") || url.searchParams.get("levels") === levels) {
          return node.name;
        }
      }
    }
    const fromChildren = node.children ? findNameInTree(node.children, id, levels) : null;
    if (fromChildren) return fromChildren;
    if (node.dropdown) {
      for (const item of node.dropdown) {
        const url = new URL(item.href, "http://x");
        if (url.pathname === `/test/${id}`) return item.name;
      }
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  const levels = searchParams.get("levels");
  const language = searchParams.get("lang") ?? searchParams.get("language") ?? "zh-TW";

  if (!id) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }

  const decodedId = decodeURIComponent(id);
  const categories = await getCategoriesCached(language);
  const categoryName = findNameInTree(categories, decodedId, levels);
  if (categoryName) {
    return Response.json({ title: categoryName });
  }

  const fallbackTitle = await getAnyCollectionDisplayName(decodedId, language);

  return Response.json({ title: fallbackTitle ?? decodedId });
}