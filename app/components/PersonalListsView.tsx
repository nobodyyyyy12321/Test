"use client";

import React, { useEffect, useRef, useState } from "react";
import type { QuestionList, ListQuestion } from "../../lib/lists-supabase";
import { getCollectionLabel } from "./collectionLabels";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";

export type MyCollection = { id: string; collectionId: string; displayName: string; createdAt: string };

type Group = { id: string; name: string; memberCount?: number };
type ShareResult = { type: "user" | "group"; id: string; name: string; avatarUrl?: string; memberCount?: number };

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
  setLists,
  myCollections,
  pinnedListIds,
  setPinnedListIds,
  pinnedCollectionIds,
  setPinnedCollectionIds,
}: Props) {
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSearchResults, setShareSearchResults] = useState<ShareResult[]>([]);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const [shareSharedGroupIds, setShareSharedGroupIds] = useState<Set<string>>(new Set());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const shareSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!shareOpenId || !isOwner || groupsLoaded) return;
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => { setOwnedGroups(d.owned ?? []); setJoinedGroups(d.joined ?? []); setGroupsLoaded(true); })
      .catch(() => {});
  }, [shareOpenId, isOwner, groupsLoaded]);

  useEffect(() => {
    if (!contextMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contextMenuId]);

  useEffect(() => {
    if (!colCtxMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setColCtxMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [colCtxMenuId]);

  const togglePublic = async (list: QuestionList) => {
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, isPublic: !l.isPublic } : l));
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !list.isPublic }),
    });
  };

  const saveListEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setLists(prev => prev.map(l => l.id === id ? { ...l, title: editTitle.trim() } : l));
    setEditingListId(null);
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
  };

  const deleteList = async (id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (expandedId === id) setExpandedId(null);
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
  };

  const removeQuestion = async (listId: string, questionId: string, collectionId: string) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? { ...l, questions: l.questions.filter((q: ListQuestion) => !(q.questionId === questionId && q.collectionId === collectionId)) }
        : l
    ));
    await fetch(`/api/lists/${listId}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, collectionId }),
    });
  };

  const handleShareSearch = (q: string) => {
    setShareInput(q);
    setShareError(null);
    if (shareSearchTimer.current) clearTimeout(shareSearchTimer.current);
    if (!q.trim()) { setShareSearchResults([]); return; }
    shareSearchTimer.current = setTimeout(async () => {
      setShareSearchLoading(true);
      const allGroups = [...ownedGroups, ...joinedGroups];
      const lq = q.toLowerCase();
      const matchGroups: ShareResult[] = allGroups
        .filter(g => g.name.toLowerCase().includes(lq))
        .map(g => ({ type: "group", id: g.id, name: g.name, memberCount: g.memberCount }));
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        const users: ShareResult[] = (d.users ?? []).map((u: { id: string; name: string; avatarUrl?: string }) => ({ type: "user", id: u.id, name: u.name, avatarUrl: u.avatarUrl }));
        setShareSearchResults([...matchGroups, ...users]);
      } finally {
        setShareSearchLoading(false);
      }
    }, 300);
  };

  const removeShare = async (listId: string, targetName: string) => {
    await fetch(`/api/lists/${listId}/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName }),
    });
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, sharedWith: (l.sharedWith ?? []).filter(n => n !== targetName) } : l
    ));
  };

  const toggleListPin = (id: string) => {
    setPinnedListIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      fetch("/api/user/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedListIds: next }),
      }).catch(() => {});
      return next;
    });
  };

  const toggleCollectionPin = (id: string) => {
    setPinnedCollectionIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      fetch("/api/user/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedCollectionIds: next }),
      }).catch(() => {});
      return next;
    });
  };

  if (loading) {
    return <p className="text-sm zen-subtle">載入中...</p>;
  }

  if (lists.length === 0 && myCollections.length === 0) {
    return (
      <p className="text-sm zen-subtle opacity-50">
        {isOwner ? "尚無試卷，在題目頁按 + 新增" : "尚無公開試卷"}
      </p>
    );
  }

  return (
    <>
      <div className="bookshelf-grid">
        {lists.map((list, li) => (
          <div key={list.id} className="relative"
            onContextMenu={isOwner && editingListId !== list.id ? e => {
              e.preventDefault();
              setContextMenuId(list.id);
              setContextMenuPos({ x: e.clientX, y: e.clientY });
            } : undefined}
          >
            {isOwner && editingListId === list.id ? (
              <div
                className="book-link bookshelf-btn"
                style={{ color: li % 2 === 0 ? "#6ea8d8" : "#d87fa0" }}
              >
                <input autoFocus value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  onBlur={() => saveListEdit(list.id)}
                  onKeyDown={e => { if (e.key === "Enter") saveListEdit(list.id); if (e.key === "Escape") setEditingListId(null); }}
                  onClick={e => e.stopPropagation()}
                  className="w-full px-2 py-0.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 outline-none"
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }} />
              </div>
            ) : (
              <a
                href={`/test/list?listId=${list.id}&autostart=1`}
                className="book-link bookshelf-btn"
                style={{ color: li % 2 === 0 ? "#6ea8d8" : "#d87fa0" }}
              >
                <span>{list.title}</span>
              </a>
            )}
            {isOwner && contextMenuId === list.id && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setContextMenuId(null)} />
                <div className="fixed z-50 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                  style={{ left: contextMenuPos.x, top: contextMenuPos.y }}>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { togglePublic(list); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}>
                    設為{list.isPublic ? "私人" : "公開"}
                  </button>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { setEditingListId(list.id); setEditTitle(list.title); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}>
                    改名
                  </button>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { setShareOpenId(shareOpenId === list.id ? null : list.id); setShareInput(""); setShareError(null); setShareSearchResults([]); setShareSharedGroupIds(new Set()); setExpandedId(null); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}>
                    分享
                  </button>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { toggleListPin(list.id); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}>
                    {pinnedListIds.includes(list.id) ? "取消釘選" : "釘選"}
                  </button>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { deleteList(list.id); setContextMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    刪除
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
        {myCollections.map((col, ci) => (
          <div key={`my-${col.id}`} className="relative"
            onContextMenu={isOwner ? e => {
              e.preventDefault();
              setColCtxMenuId(col.id);
              setColCtxMenuPos({ x: e.clientX, y: e.clientY });
            } : undefined}
          >
            <a
              href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
              className="book-link bookshelf-btn"
              style={{ color: ci % 2 === 0 ? "#9b7dd4" : "#d87fa0" }}
            >
              {col.displayName}
            </a>
            {isOwner && colCtxMenuId === col.id && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setColCtxMenuId(null)} />
                <div className="fixed z-50 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                  style={{ left: colCtxMenuPos.x, top: colCtxMenuPos.y }}>
                  <button type="button"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={() => { toggleCollectionPin(col.id); setColCtxMenuId(null); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}>
                    {pinnedCollectionIds.includes(col.id) ? "取消釘選" : "釘選"}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* questions panel */}
      {expandedId && (() => {
        const list = lists.find(l => l.id === expandedId);
        if (!list) return null;
        return (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-sm" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
              {list.questions.length > 0 && (
                <a href={`/test/list?listId=${list.id}&autostart=1`}
                  className="text-xs px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>
                  作答
                </a>
              )}
            </div>
            {list.questions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-zinc-400">清單是空的</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {list.questions.map((q: ListQuestion, i: number) => (
                  <li key={`${q.questionId}-${i}`} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs text-zinc-400 w-6 shrink-0 text-right">{q.number}</span>
                    <span className="flex-1 text-sm" style={{ color: "var(--zen-ink)" }}>{q.title}</span>
                    <span className="text-xs text-zinc-400">{getCollectionLabel(q.collectionId, q.level)}</span>
                    {isOwner && (
                      <button type="button"
                        onClick={() => removeQuestion(list.id, q.questionId, q.collectionId)}
                        className="text-xs text-red-400 hover:text-red-500 transition-colors">
                        移除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* share panel */}
      {shareOpenId && (() => {
        const list = lists.find(l => l.id === shareOpenId);
        if (!list) return null;
        return (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-sm" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
              <button type="button"
                onClick={() => { setShareOpenId(null); setShareInput(""); setShareError(null); setShareSearchResults([]); setShareSharedGroupIds(new Set()); }}
                className="text-xs opacity-40 hover:opacity-70" style={{ color: "var(--zen-ink)" }}>✕</button>
            </div>
            <div className="px-4 py-3">
              <input
                value={shareInput}
                onChange={e => handleShareSearch(e.target.value)}
                placeholder="搜尋帳號或群組名稱"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 outline-none mb-2"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              />
              {shareSearchLoading && <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>}
              {!shareSearchLoading && shareInput.trim() && shareSearchResults.length === 0 && (
                <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>找不到帳號或群組</p>
              )}
              {shareSearchResults.length > 0 && (
                <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-2">
                  {shareSearchResults.map(r => {
                    const alreadyShared = r.type === "user" && (list.sharedWith ?? []).includes(r.name);
                    const groupShared = r.type === "group" && shareSharedGroupIds.has(r.id);
                    return (
                      <div key={`${r.type}-${r.id}`} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                        <div className="flex items-center gap-2">
                          {r.type === "user" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatarUrl || AVATAR_PLACEHOLDER} className="w-6 h-6 rounded-full object-cover shrink-0" alt={r.name} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                          )}
                          <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{r.name}</span>
                          {r.type === "group" && r.memberCount != null && (
                            <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{r.memberCount} 人</span>
                          )}
                        </div>
                        {alreadyShared || groupShared ? (
                          <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                        ) : r.type === "user" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setShareLoading(true); setShareError(null);
                              const res = await fetch(`/api/lists/${list.id}/share`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ targetName: r.name }),
                              });
                              const j = await res.json();
                              if (res.ok) setLists(prev => prev.map(l => l.id === list.id ? { ...l, sharedWith: [...(l.sharedWith ?? []), r.name] } : l));
                              else setShareError(j.error ?? "失敗");
                              setShareLoading(false);
                            }}
                            disabled={shareLoading}
                            className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: "#5fa870", color: "#5fa870" }}
                          >分享</button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/groups/${r.id}/share-list`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ listId: list.id }),
                              });
                              const d = await res.json();
                              if (d.ok) setShareSharedGroupIds(prev => new Set(prev).add(r.id));
                              else setShareError(d.error ?? "分享失敗");
                            }}
                            className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80"
                            style={{ borderColor: "#b19739", color: "#b19739" }}
                          >分享</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 我的群組 — 直接列出，不需搜尋 */}
              {(() => {
                const allGroups = [...ownedGroups, ...joinedGroups];
                if (allGroups.length === 0) return null;
                return (
                  <div className="mb-2">
                    <p className="text-xs opacity-50 mb-1.5" style={{ color: "var(--zen-ink)" }}>我的群組</p>
                    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      {allGroups.map(g => (
                        <div key={g.id} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                            <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{g.name}</span>
                            {g.memberCount != null && (
                              <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{g.memberCount} 人</span>
                            )}
                          </div>
                          {shareSharedGroupIds.has(g.id) ? (
                            <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/groups/${g.id}/share-list`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ listId: list.id }),
                                });
                                const d = await res.json();
                                if (d.ok) setShareSharedGroupIds(prev => new Set(prev).add(g.id));
                                else setShareError(d.error ?? "分享失敗");
                              }}
                              className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80"
                              style={{ borderColor: "#b19739", color: "#b19739" }}
                            >分享</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {shareError && <p className="text-xs text-red-500 mb-2">{shareError}</p>}
              {(list.sharedWith ?? []).length > 0 && (
                <ul className="flex flex-col gap-2 mt-1">
                  {(list.sharedWith ?? []).map(n => {
                    const results = (list.sharedResults ?? {})[n] ?? [];
                    return (
                      <li key={n} className="text-xs" style={{ color: "var(--zen-ink)" }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{n}</span>
                          <button type="button" onClick={() => removeShare(list.id, n)}
                            className="text-red-400 hover:text-red-500 transition-colors">移除</button>
                        </div>
                        {results.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-0.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                            {results.map((r: { correct: number; answered: number; timestamp: string }, i: number) => (
                              <li key={i} className="flex items-center gap-2 text-zinc-400">
                                <span>{r.correct}/{r.answered}</span>
                                <span>{new Date(r.timestamp).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 pl-2 text-zinc-400">尚未作答</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
