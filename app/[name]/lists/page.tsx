"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { QuestionList } from "../../../../lib/lists-firebase";
import zhTW from "../../../public/locale/zh-TW.js";
import type { CategoryNode } from "../../../components/CategoryNode";

type LevelEntry = { name: string; levels: number[] };
const SIMPLE_LABELS: Record<string, string> = {};
const LEVEL_LABELS: Record<string, LevelEntry[]> = {};

(function buildLabels() {
  const nodes = zhTW as CategoryNode[];

  function parseHref(href: string): { id: string; levels: number[] } | null {
    const m = href.match(/^\/test\/([^?]+)(?:\?levels=(.+))?/);
    if (!m) return null;
    return {
      id: m[1],
      levels: m[2] ? m[2].split(",").map(Number) : [],
    };
  }

  for (const node of nodes) {
    if (node.href) {
      const p = parseHref(node.href);
      if (p && !SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
    }
    if (node.children) {
      for (const child of node.children) {
        if (!child.href) continue;
        const p = parseHref(child.href);
        if (!p) continue;
        if (p.levels.length > 0) {
          (LEVEL_LABELS[p.id] = LEVEL_LABELS[p.id] ?? []).push({ name: child.name, levels: p.levels });
          if (!SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name; // parent name as fallback
        } else if (!SIMPLE_LABELS[p.id]) {
          SIMPLE_LABELS[p.id] = child.name;
        }
      }
    }
  }
})();

function getCollectionLabel(collectionId: string, level?: number | null): string {
  if (level != null && LEVEL_LABELS[collectionId]) {
    const match = LEVEL_LABELS[collectionId].find(e => e.levels.includes(level));
    if (match) return match.name;
  }
  return SIMPLE_LABELS[collectionId] ?? collectionId;
}

export default function ListsPage() {
  const { data: session } = useSession();
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    if (menuOpenId) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpenId]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/lists")
      .then(r => r.json())
      .then(d => setLists(d.lists ?? []))
      .finally(() => setLoading(false));
  }, [session]);

  const togglePublic = async (list: QuestionList) => {
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, isPublic: !l.isPublic } : l));
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !list.isPublic }),
    });
  };

  const startEdit = (list: QuestionList) => {
    setEditingId(list.id);
    setEditTitle(list.title);
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setLists(prev => prev.map(l => l.id === id ? { ...l, title: editTitle.trim() } : l));
    setEditingId(null);
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
        ? { ...l, questions: l.questions.filter(q => !(q.questionId === questionId && q.collectionId === collectionId)) }
        : l
    ));
    await fetch(`/api/lists/${listId}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, collectionId }),
    });
  };

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm zen-subtle">請先登入</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
      <main className="w-full max-w-2xl py-12 px-8">
        <h1 className="text-2xl font-bold zen-title mb-8">個人試卷</h1>

        {loading ? (
          <p className="text-sm zen-subtle">載入中...</p>
        ) : lists.length === 0 ? (
          <p className="text-sm zen-subtle opacity-50">尚無試卷，在題目頁按 + 新增</p>
        ) : (
          <ul className="space-y-3">
            {lists.map(list => (
              <li key={list.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center gap-3 p-4">
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setExpandedId(expandedId === list.id ? null : list.id)}
                  >
                    {editingId === list.id ? (
                      <input
                        autoFocus
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        onBlur={() => saveEdit(list.id)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(list.id); if (e.key === "Escape") setEditingId(null); }}
                        onClick={e => e.stopPropagation()}
                        className="w-full px-2 py-0.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      />
                    ) : (
                      <span className="font-medium" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
                    )}
                    <p className="text-xs text-zinc-400 mt-0.5">{list.questions.length} 題</p>
                  </button>

                  {list.questions.length > 0 && (
                    <Link
                      href={`/test/list?listId=${list.id}`}
                      className="text-xs px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      作答
                    </Link>
                  )}

                  <div className="relative" ref={menuOpenId === list.id ? menuRef : null}>
                    <button
                      type="button"
                      onClick={() => setMenuOpenId(menuOpenId === list.id ? null : list.id)}
                      className="flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-400" style={{ width: "1.75rem", height: "1.75rem", minWidth: "1.75rem" }}
                      title="編輯"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                    </button>

                    {menuOpenId === list.id && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { togglePublic(list); setMenuOpenId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}
                        >
                          設為{list.isPublic ? "私人" : "公開"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { startEdit(list); setMenuOpenId(null); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}
                        >
                          改名
                        </button>
                        <button
                          type="button"
                          onClick={() => { deleteList(list.id); setMenuOpenId(null); }}
                          className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          刪除
                        </button>
                      </div>
                    )}
                  </div>

                  <svg
                    xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 text-zinc-400 transition-transform ${expandedId === list.id ? "rotate-180" : ""}`}
                  >
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>

                {expandedId === list.id && (
                  <div className="border-t border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-b-xl">
                    {list.questions.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-zinc-400">清單是空的</p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {list.questions.map((q, i) => (
                          <li key={`${q.questionId}-${i}`} className="flex items-center gap-3 px-4 py-2">
                            <span className="text-xs text-zinc-400 w-6 shrink-0 text-right">{q.number}</span>
                            <span className="flex-1 text-sm" style={{ color: "var(--zen-ink)" }}>{q.title}</span>
                            <span className="text-xs text-zinc-400">{getCollectionLabel(q.collectionId, q.level)}</span>
                            <button
                              type="button"
                              onClick={() => removeQuestion(list.id, q.questionId, q.collectionId)}
                              className="text-xs text-red-400 hover:text-red-500 transition-colors"
                            >
                              移除
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
