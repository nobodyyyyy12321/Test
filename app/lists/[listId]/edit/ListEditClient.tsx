"use client";

import { useRef, useState } from "react";
import type { QuestionList, ListQuestion } from "../../../../lib/lists-supabase";
import { getCollectionLabel } from "../../../components/collectionLabels";

type Props = { list: QuestionList };

export default function ListEditClient({ list }: Props) {
  const [questions, setQuestions] = useState<ListQuestion[]>(list.questions);
  const [title, setTitle] = useState<string>(list.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState<string>(list.title);
  const [savingTitle, setSavingTitle] = useState(false);
  const [isPublic, setIsPublic] = useState<boolean>(list.isPublic);
  const [savingPublic, setSavingPublic] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startEditTitle = () => {
    setDraftTitle(title);
    setEditingTitle(true);
  };

  const commitTitle = async () => {
    const trimmed = draftTitle.trim();
    setEditingTitle(false);
    if (!trimmed || trimmed === title) {
      setDraftTitle(title);
      return;
    }
    setTitle(trimmed);
    setSavingTitle(true);
    try {
      await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
    } finally {
      setSavingTitle(false);
    }
  };

  const togglePublic = async () => {
    if (savingPublic) return;
    const next = !isPublic;
    setIsPublic(next);
    setSavingPublic(true);
    try {
      await fetch(`/api/lists/${list.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
    } finally {
      setSavingPublic(false);
    }
  };

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

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/lists/${list.id}`, { method: "DELETE" });
      window.location.href = "/";
    } catch {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-8 py-10">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        {editingTitle ? (
          <input
            autoFocus
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); commitTitle(); }
              if (e.key === "Escape") { setEditingTitle(false); setDraftTitle(title); }
            }}
            className="text-xl font-medium min-w-0 flex-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 outline-none"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
          />
        ) : (
          <h1
            onClick={startEditTitle}
            title="點擊改名"
            className="text-xl font-medium truncate min-w-0 cursor-text rounded px-1 -mx-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            style={{ color: "var(--zen-ink)" }}
          >
            {title}
          </h1>
        )}
        <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>
          {savingTitle ? "儲存中..." : savingOrder ? "儲存中..." : `${questions.length} 題`}
        </span>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="flex flex-col">
          <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>權限</span>
          <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>
            {isPublic ? "公開：其他人可看到此清單" : "私人：僅自己可見"}
          </span>
        </div>
        <button
          type="button"
          onClick={togglePublic}
          disabled={savingPublic}
          className="text-xs px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-40"
          style={{ borderColor: isPublic ? "#5fa870" : "#b19739", color: isPublic ? "#5fa870" : "#b19739" }}
        >
          {savingPublic ? "..." : isPublic ? "設為私人" : "設為公開"}
        </button>
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
                <button
                  type="button"
                  onClick={() => removeQuestion(q)}
                  className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                  aria-label="移除"
                >
                  移除
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-300 dark:border-red-800/60">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-red-500">刪除清單</span>
          <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>此操作無法復原</span>
        </div>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-full border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
            >
              {deleting ? "刪除中..." : "確認刪除"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{ color: "var(--zen-ink)" }}
            >
              取消
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs px-3 py-1.5 rounded-full border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            刪除
          </button>
        )}
      </div>
    </main>
  );
}
