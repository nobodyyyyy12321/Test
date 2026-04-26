import { cache } from "react";
import type { Metadata } from "next";
import { getListById } from "../../../lib/lists-firebase";
import { getCategoriesCached, type CategoryNode } from "../../../lib/categories";
import TestClient from "./TestClient";

// deduplicate within same request (generateMetadata + TestPage both call this)
const getListByIdCached = cache(getListById);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levels?: string; ordered?: string; listId?: string; replay?: string; autostart?: string }>;
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

async function resolveTitle(id: string, levels?: string | null): Promise<string> {
  const categories = await getCategoriesCached("zh-TW");
  return findNameInTree(categories, id, levels) ?? id;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { levels, listId } = await searchParams;
  const decodedId = decodeURIComponent(id);

  let title = await resolveTitle(decodedId, levels);
  if (listId) {
    const list = await getListByIdCached(listId).catch(() => null);
    if (list?.title) title = list.title;
  }

  return {
    title: `${title} — Test`,
    description: `${title} 練習題`,
  };
}

export default async function TestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { levels, ordered, listId, replay, autostart } = await searchParams;
  const decodedId = decodeURIComponent(id);

  const [list, pageTitle] = await Promise.all([
    listId ? getListByIdCached(listId).catch(() => null) : Promise.resolve(null),
    resolveTitle(decodedId, levels),
  ]);

  const title = list?.title ?? pageTitle;

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
    />
  );
}
