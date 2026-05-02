import { getCategoriesCached, type CategoryNode } from "@/lib/categories";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

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

  const supabase = getSupabaseAdmin();
  const { data: languageRows } = await supabase
    .from("pcategories")
    .select("name")
    .eq("collection_id", decodedId)
    .eq("language", language)
    .limit(1);
  const languageTitle = languageRows?.[0]?.name as string | undefined;
  if (languageTitle) {
    return Response.json({ title: languageTitle });
  }

  const { data: anyRows } = await supabase
    .from("pcategories")
    .select("name")
    .eq("collection_id", decodedId)
    .limit(1);
  const fallbackTitle = anyRows?.[0]?.name as string | undefined;

  return Response.json({ title: fallbackTitle ?? decodedId });
}