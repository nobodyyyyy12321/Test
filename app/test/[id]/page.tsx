import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getListById } from "../../../lib/lists-supabase";
import { getCategoriesCached, type CategoryNode } from "../../../lib/categories";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";
import { getTestMetadataDescription } from "../../lib/i18n/test";
import TestClient from "./TestClient";

// deduplicate within same request (generateMetadata + TestPage both call this)
const getListByIdCached = cache(getListById);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levels?: string; ordered?: string; listId?: string; replay?: string; autostart?: string; count?: string; lang?: string; language?: string; name?: string }>;
};

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
      for (const d of node.dropdown) {
        const url = new URL(d.href, "http://x");
        if (url.pathname === `/test/${id}`) return d.name;
      }
    }
  }
  return null;
}

async function resolveTitle(id: string, levels?: string | null, language?: string | null): Promise<string> {
  const lang = language && language.trim() ? language : "zh-TW";
  const categories = await getCategoriesCached(lang);
  const categoryName = findNameInTree(categories, id, levels);
  if (categoryName) return categoryName;

  const supabase = getSupabaseAdmin();
  const { data: languageRows } = await supabase
    .from("pcategories")
    .select("name")
    .eq("collection_id", id)
    .eq("language", lang)
    .limit(1);
  const languageTitle = languageRows?.[0]?.name as string | undefined;
  if (languageTitle) return languageTitle;

  const { data: anyRows } = await supabase
    .from("pcategories")
    .select("name")
    .eq("collection_id", id)
    .limit(1);
  const fallbackTitle = anyRows?.[0]?.name as string | undefined;
  return fallbackTitle ?? id;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { levels, listId, lang, language, name } = await searchParams;
  const decodedId = decodeURIComponent(id);
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("siteLanguage")?.value;
  const activeLang = lang ?? language ?? cookieLang ?? "zh-TW";

  let title = await resolveTitle(decodedId, levels, activeLang);
  if (name) title = decodeURIComponent(name);
  if (listId) {
    const list = await getListByIdCached(listId).catch(() => null);
    if (list?.title) title = list.title;
  }

  return {
    title: `${title} — Test`,
    description: getTestMetadataDescription(title, activeLang),
  };
}

export default async function TestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { levels, ordered, listId, replay, autostart, count, lang, language, name } = await searchParams;
  const decodedId = decodeURIComponent(id);
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("siteLanguage")?.value;
  const activeLang = lang ?? language ?? cookieLang ?? "zh-TW";

  const [list, pageTitle] = await Promise.all([
    listId ? getListByIdCached(listId).catch(() => null) : Promise.resolve(null),
    resolveTitle(decodedId, levels, activeLang),
  ]);

  const title = list?.title ?? (name ? decodeURIComponent(name) : pageTitle);
  const parsedCount = count ? parseInt(count, 10) : NaN;
  const limit = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;

  return (
    <TestClient
      id={decodedId}
      ordered={ordered === "true"}
      listId={listId ?? null}
      listTitle={list?.title ?? null}
      levels={levels ?? null}
      pageTitle={title}
      replayKey={replay ?? null}
      autostart={autostart === "1"}
      limit={limit}
      language={activeLang}
    />
  );
}
