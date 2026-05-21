import { cache } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getListById } from "../../../lib/lists-supabase";
import { getCategoriesCached, type CategoryNode } from "../../../lib/categories";
import { getAnyCollectionDisplayName } from "../../../lib/user-collections-supabase";
import { getTestMetadataDescription } from "../../lib/i18n/test";
import TestClient from "./TestClient";

export const revalidate = 3600;

// deduplicate within same request (generateMetadata + TestPage both call this)
const getListByIdCached = cache(getListById);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levels?: string; ordered?: string; listId?: string; replay?: string; autostart?: string; count?: string; lang?: string; language?: string; name?: string }>;
};

function inferLanguageFromCollectionId(collectionId: string): string | null {
  if (/_en$/i.test(collectionId)) return "en";
  if (/_zhcn$/i.test(collectionId) || /_(zh-cn|zh_cn)$/i.test(collectionId)) return "zh-CN";
  if (/_ja$/i.test(collectionId)) return "ja";
  if (/_ko$/i.test(collectionId)) return "ko";
  return null;
}

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchCategoryNameById(id: string): Promise<{ name: string; ownerId: string | null } | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
  const url = `${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(id)}&select=name,owner_id&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const rows: Array<{ name: string; owner_id: string | null }> = await res.json();
  const row = rows[0];
  if (!row) return null;
  return { name: row.name, ownerId: row.owner_id ?? null };
}

async function fetchUserNameById(id: string): Promise<string | null> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
  const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
  const url = `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(id)}&select=name&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return null;
  const rows: Array<{ name: string }> = await res.json();
  return rows[0]?.name ?? null;
}

async function resolveTitleAndOwner(id: string, levels?: string | null, language?: string | null): Promise<{ title: string; ownerId: string | null }> {
  if (UUID_RE.test(id)) {
    const row = await fetchCategoryNameById(id);
    if (row) return { title: row.name, ownerId: row.ownerId };
  }

  const lang = language && language.trim() ? language : "zh-TW";
  const categories = await getCategoriesCached(lang);
  const categoryName = findNameInTree(categories, id, levels);
  if (categoryName) return { title: categoryName, ownerId: null };

  const fallbackTitle = await getAnyCollectionDisplayName(id, lang);
  return { title: fallbackTitle ?? id, ownerId: null };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { levels, listId, lang, language, name } = await searchParams;
  const decodedId = decodeURIComponent(id);
  const cookieStore = await cookies();
  const cookieLang = cookieStore.get("siteLanguage")?.value;
  const inferredLang = inferLanguageFromCollectionId(decodedId);
  const activeLang = lang ?? language ?? inferredLang ?? cookieLang ?? "zh-TW";

  let title = (await resolveTitleAndOwner(decodedId, levels, activeLang)).title;
  if (name) title = decodeURIComponent(name);
  if (listId) {
    const list = await getListByIdCached(listId).catch(() => null);
    if (list?.title) title = list.title;
  }

  return {
    title: `${title}`,
    description: getTestMetadataDescription(title, activeLang),
    openGraph: {
      siteName: "Exam",
      title: `${title}`,
      description: getTestMetadataDescription(title, activeLang),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title}`,
      description: getTestMetadataDescription(title, activeLang),
    },
  };
}

export default async function TestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { levels, ordered, listId, replay, autostart, count, lang, language, name } = await searchParams;
  const decodedId = decodeURIComponent(id);
  const inferredLang = inferLanguageFromCollectionId(decodedId);
  const serverLang = lang ?? language ?? inferredLang ?? "zh-TW";

  const [list, resolved] = await Promise.all([
    listId ? getListByIdCached(listId).catch(() => null) : Promise.resolve(null),
    resolveTitleAndOwner(decodedId, levels, serverLang),
  ]);

  const title = list?.title ?? (name ? decodeURIComponent(name) : resolved.title);
  const parsedCount = count ? parseInt(count, 10) : NaN;
  const limit = Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : null;

  const ownerId = list?.ownerId ?? resolved.ownerId;
  const ownerName = ownerId ? await fetchUserNameById(ownerId) : null;

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
      language={serverLang}
      ownerName={ownerName}
    />
  );
}
