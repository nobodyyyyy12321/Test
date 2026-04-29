"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { QuestionList, ListQuestion } from "../../../../lib/lists-supabase";
import { getCollectionLabel } from "../../../components/collectionLabels";

type Props = { list: QuestionList };

export default function ListEditClient({ list }: Props) {
  const [questions, setQuestions] = useState<ListQuestion[]>(list.questions);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistOrder = (next: ListQuestion[]) => {
    if (reorderDebounce.current) clearTimeout(reorderDebounce.current);
    setSavingOrder(true);
    reorderDebounce.current = setTimeout(async () => {
      try {
        await fetch(`/api/lists/${list.id}/questions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: next.map(q => ({ questionId: q.questionId, collectionId: q.collectionId })),
          }),
        });
      } finally {
        setSavingOrder(false);
      }
    }, 400);
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    setQuestions(prev => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persistOrder(next);
      return next;
    });
  };

  const move = (index: number, direction: -1 | 1) => {
    reorder(index, index + direction);
  };

  const removeQuestion = async (q: ListQuestion) => {
    const key = `${q.questionId}|${q.collectionId}`;
    setRemovingKey(key);
    setQuestions(prev => prev.filter(x => !(x.questionId === q.questionId && x.collectionId === q.collectionId)));
    try {
      await fetch(`/api/lists/${list.id}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: q.questionId, collectionId: q.collectionId }),
      });
    } finally {
      setRemovingKey(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="text-sm opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: "var(--zen-ink)" }}
          >
            ← 返回
          </Link>
          <h1 className="text-xl font-medium truncate" style={{ color: "var(--zen-ink)" }}>
            編輯「{list.title}」
          </h1>
        </div>
        <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>
          {savingOrder ? "儲存中..." : `${questions.length} 題`}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm opacity-50 py-8 text-center" style={{ color: "var(--zen-ink)" }}>
          清單是空的
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {questions.map((q, i) => {
            const key = `${q.questionId}|${q.collectionId}`;
            const removing = removingKey === key;
            const isDragOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i;
            return (
              <li
                key={key}
                draggable
                onDragStart={e => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverIndex !== i) setDragOverIndex(i);
                }}
                onDragLeave={() => {
                  if (dragOverIndex === i) setDragOverIndex(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                className={`flex items-center gap-3 px-4 py-3 cursor-move transition-colors ${
                  dragIndex === i ? "opacity-40" : ""
                } ${isDragOver ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${removing ? "opacity-30 pointer-events-none" : ""}`}
                style={{ backgroundColor: isDragOver ? undefined : "var(--zen-bg)" }}
              >
                <span className="opacity-30 select-none" aria-hidden style={{ color: "var(--zen-ink)" }}>⋮⋮</span>
                <span className="text-xs opacity-50 w-8 shrink-0 text-right" style={{ color: "var(--zen-ink)" }}>
                  {i + 1}
                </span>
                <span className="flex-1 text-sm truncate" style={{ color: "var(--zen-ink)" }}>
                  {q.title || `第 ${q.number} 題`}
                </span>
                <span className="text-xs opacity-40 shrink-0" style={{ color: "var(--zen-ink)" }}>
                  {getCollectionLabel(q.collectionId, q.level)}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                    style={{ color: "var(--zen-ink)" }}
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === questions.length - 1}
                    className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                    style={{ color: "var(--zen-ink)" }}
                    aria-label="下移"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => removeQuestion(q)}
                    className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    aria-label="移除"
                  >
                    移除
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
