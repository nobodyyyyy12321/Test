"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { QuestionList } from "../../lib/lists-firebase";

type Props = {
  questionId: string;
  collectionId: string;
  title: string;
  number: number;
  level?: number | null;
};

type BulkQuestion = {
  questionId: string;
  collectionId: string;
  title: string;
  number: number;
  level?: number | null;
};

type BulkProps = { questions: BulkQuestion[] };

export function BulkAddToListButton({ questions }: BulkProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/lists")
      .then(r => r.json())
      .then(d => setLists(d.lists ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!session) return null;

  const toggleAll = async (list: QuestionList) => {
    const allIn = questions.length > 0 && questions.every(
      q => list.questions.some(lq => lq.questionId === q.questionId && lq.collectionId === q.collectionId)
    );
    setAdding(list.id);
    if (allIn) {
      // 逐一移除
      await Promise.all(
        questions.map(q =>
          fetch(`/api/lists/${list.id}/questions`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: q.questionId, collectionId: q.collectionId }),
          })
        )
      );
      setLists(prev => prev.map(l =>
        l.id === list.id
          ? { ...l, questions: l.questions.filter(lq => !questions.some(q => q.questionId === lq.questionId && q.collectionId === lq.collectionId)) }
          : l
      ));
    } else {
      // 批次加入
      await fetch(`/api/lists/${list.id}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      });
      setLists(prev => prev.map(l => {
        if (l.id !== list.id) return l;
        const toAdd = questions.filter(q => !l.questions.some(lq => lq.questionId === q.questionId && lq.collectionId === q.collectionId));
        return { ...l, questions: [...l.questions, ...toAdd] };
      }));
    }
    setAdding(null);
  };

  const createList = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newName.trim() }),
    });
    const data = await res.json();
    if (data.list) setLists(prev => [data.list, ...prev]);
    setNewName("");
    setCreating(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={questions.length === 0}
        className="flex h-8 w-8 aspect-square shrink-0 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-lg leading-none hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors disabled:opacity-30"
        title={questions.length === 0 ? "請先勾選題目" : `加入 ${questions.length} 題至清單`}
        aria-label="加入清單"
      >
        +
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            加入 {questions.length} 題至清單
          </div>

          {loading ? (
            <div className="px-3 py-3 text-xs text-zinc-400">載入中...</div>
          ) : lists.length === 0 ? (
            <div className="px-3 py-3 text-xs text-zinc-400">尚無清單</div>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {lists.map(list => {
                const allIn = questions.length > 0 && questions.every(
                  q => list.questions.some(lq => lq.questionId === q.questionId && lq.collectionId === q.collectionId)
                );
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      onClick={() => toggleAll(list)}
                      disabled={adding === list.id}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${allIn ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black" : "border-zinc-300 dark:border-zinc-600"}`}>
                        {allIn && "✓"}
                      </span>
                      <span className="flex-1 truncate" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
                      <span className="text-xs text-zinc-400">{adding === list.id ? "加入中…" : list.isPublic ? "公開" : "私人"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800 p-2 flex gap-1">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createList()}
              placeholder="新增清單..."
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            />
            <button
              type="button"
              onClick={createList}
              disabled={creating || !newName.trim()}
              className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              style={{ color: "var(--zen-ink)" }}
            >
              建立
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AddToListButton({ questionId, collectionId, title, number, level }: Props) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/lists")
      .then(r => r.json())
      .then(d => setLists(d.lists ?? []))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (!session) return null;

  const isInList = (list: QuestionList) =>
    list.questions.some(q => q.questionId === questionId && q.collectionId === collectionId);

  const toggle = async (list: QuestionList) => {
    const inList = isInList(list);
    const method = inList ? "DELETE" : "POST";
    const body = inList
      ? JSON.stringify({ questionId, collectionId })
      : JSON.stringify({ questionId, collectionId, title, number, level });

    setLists(prev =>
      prev.map(l => {
        if (l.id !== list.id) return l;
        if (inList) return { ...l, questions: l.questions.filter(q => !(q.questionId === questionId && q.collectionId === collectionId)) };
        return { ...l, questions: [...l.questions, { questionId, collectionId, title, number, level }] };
      })
    );

    await fetch(`/api/lists/${list.id}/questions`, {
      method,
      headers: { "Content-Type": "application/json" },
      body,
    });
  };

  const createList = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newName.trim() }),
    });
    const data = await res.json();
    if (data.list) setLists(prev => [data.list, ...prev]);
    setNewName("");
    setCreating(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex h-9 w-9 aspect-square shrink-0 items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 text-xl leading-none hover:border-zinc-500 dark:hover:border-zinc-400 transition-colors"
        title="加入清單"
        aria-label="加入清單"
      >
        +
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 z-50 w-56 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          <div className="px-3 py-2 text-xs text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
            加入清單
          </div>

          {loading ? (
            <div className="px-3 py-3 text-xs text-zinc-400">載入中...</div>
          ) : lists.length === 0 ? (
            <div className="px-3 py-3 text-xs text-zinc-400">尚無清單</div>
          ) : (
            <ul className="max-h-48 overflow-y-auto">
              {lists.map(list => {
                const checked = isInList(list);
                return (
                  <li key={list.id}>
                    <button
                      type="button"
                      onClick={() => toggle(list)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs ${checked ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black" : "border-zinc-300 dark:border-zinc-600"}`}>
                        {checked && "✓"}
                      </span>
                      <span className="flex-1 truncate" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
                      <span className="text-xs text-zinc-400">{list.isPublic ? "公開" : "私人"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-zinc-100 dark:border-zinc-800 p-2 flex gap-1">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createList()}
              placeholder="新增清單..."
              className="flex-1 min-w-0 px-2 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
              style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            />
            <button
              type="button"
              onClick={createList}
              disabled={creating || !newName.trim()}
              className="px-2 py-1 text-xs rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
              style={{ color: "var(--zen-ink)" }}
            >
              建立
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
