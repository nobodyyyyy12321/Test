import { cache } from "react";
import type { Metadata } from "next";
import { fetchQuestions } from "../../../lib/questions-firebase";
import { getListById } from "../../../lib/lists-firebase";
import TestClient from "./TestClient";

// deduplicate within same request (generateMetadata + TestPage both call this)
const getListByIdCached = cache(getListById);

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ levels?: string; ordered?: string; listId?: string }>;
};

const ENGLISH_LEVEL_MAP: Record<string, string> = {
  "1,2": "教育部2000單",
  "3,4": "教育部4000單",
  "5,6": "教育部6000單",
};
const ID_NAME_MAP: Record<string, string> = { quoteChinese: "名言佳句" };

function resolveTitle(id: string, levels?: string | null): string {
  if (id === "englishWords") {
    return levels ? (ENGLISH_LEVEL_MAP[levels] ?? "英文單字") : "英文單字";
  }
  return ID_NAME_MAP[id] ?? id;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { id } = await params;
  const { levels, listId } = await searchParams;
  const decodedId = decodeURIComponent(id);

  let title = resolveTitle(decodedId, levels);
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
  const { levels, ordered, listId } = await searchParams;
  const decodedId = decodeURIComponent(id);

  const [questions, list] = await Promise.all([
    fetchQuestions({ id: decodedId, levels, listId }).catch(() => [] as Awaited<ReturnType<typeof fetchQuestions>>),
    listId ? getListByIdCached(listId).catch(() => null) : Promise.resolve(null),
  ]);

  const pageTitle = list?.title ?? resolveTitle(decodedId, levels);

  return (
    <TestClient
      id={decodedId}
      initialQuestions={questions}
      ordered={ordered === "true"}
      listId={listId ?? null}
      listTitle={list?.title ?? null}
      levels={levels ?? null}
      pageTitle={pageTitle}
    />
  );
}
