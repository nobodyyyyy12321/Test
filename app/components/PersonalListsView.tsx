"use client";

import React, { useState } from "react";
import type { QuestionList } from "../../lib/lists-supabase";

export type MyCollection = {
  id: string;
  collectionId: string;
  href?: string | null;
  displayName: string;
  createdAt: string;
  fromGrid?: boolean;
  problemsPerTest?: number | null;
  shuffleProblems?: boolean | null;
  approvalStatus?: string;
};

type Props = {
  isOwner: boolean;
  loading: boolean;
  lists: QuestionList[];
  setLists: React.Dispatch<React.SetStateAction<QuestionList[]>>;
  myCollections: MyCollection[];
  pinnedListIds: string[];
  setPinnedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  pinnedCollectionIds: string[];
  setPinnedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function PersonalListsView({
  isOwner,
  loading,
  lists,
  myCollections,
}: Props) {
  const [listCtxMenuId, setListCtxMenuId] = useState<string | null>(null);
  const [listCtxMenuPos, setListCtxMenuPos] = useState({ x: 0, y: 0 });
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });

  const visibleCollections = myCollections.filter((c) => c.approvalStatus !== "pending");

  const appendHrefOptions = (href?: string | null, problemsPerTest?: number | null, shuffleProblems?: boolean | null): string => {
    const base = href || "#";
    if (base === "#") return base;
    const extra: string[] = [];
    if (problemsPerTest != null) extra.push(`count=${encodeURIComponent(problemsPerTest)}`);
    if (shuffleProblems === false) extra.push("ordered=true");
    if (extra.length === 0) return base;
    return base + (base.includes("?") ? "&" : "?") + extra.join("&");
  };

  if (loading) return <p className="text-sm zen-subtle">載入中...</p>;

  const isEmpty = lists.length === 0 && visibleCollections.length === 0;

  if (!isOwner && isEmpty) {
    return <p className="text-sm zen-subtle opacity-50">尚無公開試卷</p>;
  }

  return (
    <div className="bookshelf-grid">
      {isEmpty && isOwner && (
        <p className="text-sm zen-subtle opacity-50 col-span-full">
          尚無試卷，在題目頁按 + 新增
        </p>
      )}

      {lists.map((list) => (
        <div key={list.id} className="relative">
          <a
            href={`/test/list?listId=${list.id}&autostart=1`}
            className="book-link bookshelf-btn"
            style={{ color: "#6ea8d8" }}
            onContextMenu={(e) => {
              if (!isOwner) return;
              e.preventDefault();
              setListCtxMenuId(list.id);
              setListCtxMenuPos({ x: e.clientX, y: e.clientY });
              setColCtxMenuId(null);
            }}
          >
            {list.title}
          </a>
          {isOwner && listCtxMenuId === list.id && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setListCtxMenuId(null)} />
              <div
                className="fixed z-50 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{ left: listCtxMenuPos.x, top: listCtxMenuPos.y }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setListCtxMenuId(null);
                    window.location.href = `/lists/${list.id}/edit`;
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}
                >
                  編輯
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {visibleCollections.map((col) => (
        <div key={`my-${col.id}`} className="relative">
          <a
            href={appendHrefOptions(`/test/${encodeURIComponent(col.collectionId)}?autostart=1`, col.problemsPerTest, col.shuffleProblems)}
            className="book-link bookshelf-btn"
            style={{ color: "#5fa870" }}
            onContextMenu={(e) => {
              if (!isOwner) return;
              e.preventDefault();
              setColCtxMenuId(col.id);
              setColCtxMenuPos({ x: e.clientX, y: e.clientY });
              setListCtxMenuId(null);
            }}
          >
            {col.displayName}
          </a>
          {isOwner && colCtxMenuId === col.id && !col.fromGrid && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setColCtxMenuId(null)} />
              <div
                className="fixed z-50 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{ left: colCtxMenuPos.x, top: colCtxMenuPos.y }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setColCtxMenuId(null);
                    window.location.href = `/collections/${encodeURIComponent(col.collectionId)}/edit`;
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}
                >
                  編輯
                </button>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
