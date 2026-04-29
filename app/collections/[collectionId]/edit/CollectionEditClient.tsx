"use client";

import { useRef, useState } from "react";
import type { QuizQuestionRow } from "../../../../lib/questions-supabase";

type Props = {
  collectionId: string;
  displayName: string;
  initialQuestions: QuizQuestionRow[];
};

type Draft = {
  number: number;
  title: string;
  type: string;
  optionsText: string;     // edited as JSON text
  answerText: string;      // edited as plain text or comma-separated
  level: string;           // empty string when null
  group_content: string;
  parseError: string | null;
};

function rowToDraft(row: QuizQuestionRow): Draft {
  return {
    number: row.number,
    title: row.title,
    type: row.type ?? "single",
    optionsText: row.options ? JSON.stringify(row.options, null, 2) : "",
    answerText: Array.isArray(row.answer) ? row.answer.join(",") : (row.answer ?? ""),
    level: row.level == null ? "" : String(row.level),
    group_content: row.group_content ?? "",
    parseError: null,
  };
}

export default function CollectionEditClient({ collectionId, displayName, initialQuestions }: Props) {
  const [questions, setQuestions] = useState<QuizQuestionRow[]>(initialQuestions);
  const [editingNum, setEditingNum] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [savingNum, setSavingNum] = useState<number | null>(null);
  const [removingNum, setRemovingNum] = useState<number | null>(null);

  const [title, setTitle] = useState<string>(displayName);
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState<string>(displayName);
  const [savingTitle, setSavingTitle] = useState(false);

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const reorderDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistOrder = (next: QuizQuestionRow[]) => {
    if (reorderDebounce.current) clearTimeout(reorderDebounce.current);
    setSavingOrder(true);
    reorderDebounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/my-collections/${encodeURIComponent(collectionId)}/questions`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedNumbers: next.map(q => q.number) }),
        });
        if (res.ok) {
          // server has renumbered to 1..N — sync local state
          setQuestions(prev => prev.map((q, i) => ({ ...q, number: i + 1 })));
        }
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
      await fetch("/api/my-collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, displayName: trimmed }),
      });
    } finally {
      setSavingTitle(false);
    }
  };

  const startEdit = (row: QuizQuestionRow) => {
    setDraft(rowToDraft(row));
    setEditingNum(row.number);
  };

  const cancelEdit = () => {
    setDraft(null);
    setEditingNum(null);
  };

  const saveDraft = async () => {
    if (!draft) return;
    let optionsParsed: Record<string, string> | null = null;
    if (draft.optionsText.trim()) {
      try {
        const v = JSON.parse(draft.optionsText);
        if (v && typeof v === "object" && !Array.isArray(v)) {
          optionsParsed = v as Record<string, string>;
        } else {
          setDraft({ ...draft, parseError: "options 必須為物件，例如 {\"A\":\"...\"}" });
          return;
        }
      } catch {
        setDraft({ ...draft, parseError: "options JSON 格式錯誤" });
        return;
      }
    }

    let answer: string | string[] | null;
    if (draft.type === "multiple") {
      answer = draft.answerText
        .split(",").map(s => s.trim()).filter(Boolean);
    } else {
      answer = draft.answerText.trim() || null;
    }

    const levelNum = draft.level.trim() === "" ? null : Number(draft.level);
    if (levelNum != null && !Number.isFinite(levelNum)) {
      setDraft({ ...draft, parseError: "level 需為數字" });
      return;
    }

    setSavingNum(draft.number);
    try {
      const res = await fetch(`/api/my-collections/${encodeURIComponent(collectionId)}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          number: draft.number,
          title: draft.title,
          type: draft.type,
          options: optionsParsed,
          answer,
          level: levelNum,
          group_content: draft.group_content.trim() ? draft.group_content : null,
        }),
      });
      if (!res.ok) {
        setDraft({ ...draft, parseError: "儲存失敗" });
        return;
      }
      setQuestions(prev => prev.map(q => q.number === draft.number ? {
        ...q,
        title: draft.title,
        type: draft.type,
        options: optionsParsed,
        answer: answer as string | string[],
        level: levelNum,
        group_content: draft.group_content.trim() ? draft.group_content : null,
      } : q));
      cancelEdit();
    } finally {
      setSavingNum(null);
    }
  };

  const removeQuestion = async (number: number) => {
    setRemovingNum(number);
    setQuestions(prev => prev.filter(q => q.number !== number));
    if (editingNum === number) cancelEdit();
    try {
      await fetch(`/api/my-collections/${encodeURIComponent(collectionId)}/questions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number }),
      });
    } finally {
      setRemovingNum(null);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/my-collections?collectionId=${encodeURIComponent(collectionId)}`, { method: "DELETE" });
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
          {savingTitle || savingOrder ? "儲存中..." : `${questions.length} 題`}
        </span>
      </div>

      {questions.length === 0 ? (
        <p className="text-sm opacity-50 py-8 text-center" style={{ color: "var(--zen-ink)" }}>
          題庫是空的
        </p>
      ) : (
        <ul className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
          {questions.map((q, i) => {
            const isEditing = editingNum === q.number;
            const isSaving = savingNum === q.number;
            const isRemoving = removingNum === q.number;
            const isDragOver = dragOverIndex === i && dragIndex !== null && dragIndex !== i;
            const draggable = !isEditing && !isRemoving;
            return (
              <li
                key={q.number}
                draggable={draggable}
                onDragStart={draggable ? e => {
                  setDragIndex(i);
                  e.dataTransfer.effectAllowed = "move";
                } : undefined}
                onDragOver={draggable ? e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverIndex !== i) setDragOverIndex(i);
                } : undefined}
                onDragLeave={draggable ? () => {
                  if (dragOverIndex === i) setDragOverIndex(null);
                } : undefined}
                onDrop={draggable ? e => {
                  e.preventDefault();
                  if (dragIndex !== null) reorder(dragIndex, i);
                  setDragIndex(null);
                  setDragOverIndex(null);
                } : undefined}
                onDragEnd={draggable ? () => {
                  setDragIndex(null);
                  setDragOverIndex(null);
                } : undefined}
                className={`px-4 py-3 transition-colors ${isRemoving ? "opacity-30 pointer-events-none" : ""} ${dragIndex === i ? "opacity-40" : ""} ${isDragOver ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${draggable && !isEditing ? "cursor-move" : ""}`}
                style={{ backgroundColor: isDragOver ? undefined : "var(--zen-bg)" }}
              >
                {isEditing && draft ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>
                      <span className="w-8 shrink-0 text-right">#{q.number}</span>
                      <span>編輯題目</span>
                    </div>
                    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                      <span className="opacity-60">題目</span>
                      <textarea
                        value={draft.title}
                        onChange={e => setDraft({ ...draft, title: e.target.value })}
                        className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none resize-y"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "3rem" }}
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                        <span className="opacity-60">類型</span>
                        <select
                          value={draft.type}
                          onChange={e => setDraft({ ...draft, type: e.target.value })}
                          className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none"
                          style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                        >
                          <option value="single">單選</option>
                          <option value="multiple">多選</option>
                          <option value="fill">填空</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                        <span className="opacity-60">難度 (level)</span>
                        <input
                          value={draft.level}
                          onChange={e => setDraft({ ...draft, level: e.target.value })}
                          className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none"
                          style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                          placeholder="(空白)"
                        />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                      <span className="opacity-60">選項 (JSON)</span>
                      <textarea
                        value={draft.optionsText}
                        onChange={e => setDraft({ ...draft, optionsText: e.target.value, parseError: null })}
                        className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none resize-y font-mono"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "4rem" }}
                        placeholder='{"A":"選項A","B":"選項B"}'
                        spellCheck={false}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                      <span className="opacity-60">
                        答案 {draft.type === "multiple" ? "(以逗號分隔)" : ""}
                      </span>
                      <input
                        value={draft.answerText}
                        onChange={e => setDraft({ ...draft, answerText: e.target.value })}
                        className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs" style={{ color: "var(--zen-ink)" }}>
                      <span className="opacity-60">題組共用內容</span>
                      <textarea
                        value={draft.group_content}
                        onChange={e => setDraft({ ...draft, group_content: e.target.value })}
                        className="w-full rounded border border-zinc-300 dark:border-zinc-600 px-2 py-1 outline-none resize-y"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "2.5rem" }}
                      />
                    </label>
                    {draft.parseError && (
                      <p className="text-xs text-red-500">{draft.parseError}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveDraft}
                        disabled={isSaving}
                        className="text-xs px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-40"
                        style={{ borderColor: "#5fa870", color: "#5fa870" }}
                      >
                        {isSaving ? "儲存中..." : "儲存"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 transition-opacity hover:opacity-80"
                        style={{ color: "var(--zen-ink)" }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="opacity-30 select-none shrink-0" aria-hidden style={{ color: "var(--zen-ink)" }}>⋮⋮</span>
                    <span className="text-xs opacity-50 w-8 shrink-0 text-right" style={{ color: "var(--zen-ink)" }}>
                      {q.number}
                    </span>
                    <span className="flex-1 text-sm truncate" style={{ color: "var(--zen-ink)" }}>
                      {q.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => startEdit(q)}
                      className="text-xs px-2 py-1 rounded opacity-60 hover:opacity-100 transition-opacity shrink-0"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      編輯
                    </button>
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.number)}
                      className="text-xs px-2 py-1 rounded text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
                    >
                      移除
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-red-300 dark:border-red-800/60">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-red-500">刪除題庫</span>
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
