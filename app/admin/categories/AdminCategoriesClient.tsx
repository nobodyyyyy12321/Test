"use client";

import { useEffect, useState } from "react";
import type { FlatCategory } from "../../../lib/categories";

const LANGS = [
  { code: "zh-TW", label: "繁中" },
  { code: "zh-CN", label: "簡中" },
  { code: "en",    label: "EN" },
  { code: "ko",    label: "KO" },
  { code: "es",    label: "ES" },
  { code: "th",    label: "TH" },
  { code: "id",    label: "ID" },
];

type Entry = { language: string; items: FlatCategory[] };
type ReviewItem = {
  id: string;
  owner_id: string;
  name: string;
  href: string | null;
  language: string;
  approval_status: string;
  created_at: string;
  updated_at: string;
};

type ViewedQuestion = {
  id: string;
  number: number;
  title: string;
  type?: string;
  options?: Array<{ label: string; text: string }>;
  answer?: string | string[];
  level?: number | null;
  groupContent?: string | null;
  groupRange?: string | null;
};

const STARTER_COMMENT = `// Flat list — each item declares its parent.
// parentId: null = top-level under this language.
// Sibling order is the array order. Omit \`id\` for new items (server generates one).
//
// Optional per-item test settings (apply when clicking the link from the homepage):
//   problemsPerTest: number   — limit how many problems per test (null = no limit)
//   shuffleProblems: boolean  — false = play in fixed order; true/null = shuffle (default)
//
// return [
//   { id: "abc", parentId: null, name: "學測" },
//   { id: "def", parentId: "abc", name: "國文", href: "/test/gsat-chinese",
//     problemsPerTest: 50, shuffleProblems: true },
// ];

`;

export default function AdminCategoriesClient({ initialEntries }: { initialEntries: Entry[] }) {
  const [activeLang, setActiveLang] = useState("zh-TW");
  const [jsonTexts, setJsonTexts] = useState<Record<string, string>>(
    Object.fromEntries(initialEntries.map(e => [
      e.language,
      `${STARTER_COMMENT}return ${JSON.stringify(e.items, null, 2)};`
    ]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pendingItems, setPendingItems] = useState<ReviewItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [viewingItem, setViewingItem] = useState<ReviewItem | null>(null);
  const [viewingQuestions, setViewingQuestions] = useState<ViewedQuestion[]>([]);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [viewingError, setViewingError] = useState<string | null>(null);

  const currentJson = jsonTexts[activeLang] ?? "[]";

  const readJsonSafe = async (res: Response): Promise<any> => {
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { error: text };
    }
  };

  const parseCollectionId = (href?: string | null): string | null => {
    if (!href) return null;
    try {
      const pathname = new URL(href, "http://x").pathname;
      const match = pathname.match(/^\/test\/([^/]+)\/?$/);
      return match ? decodeURIComponent(match[1]) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;

    const loadPending = async () => {
      setPendingLoading(true);
      setPendingError(null);
      try {
        const res = await fetch(`/api/admin/reviews/categories?status=pending&language=${encodeURIComponent(activeLang)}`, {
          cache: "no-store",
        });
        const data = await readJsonSafe(res);
        if (!res.ok) throw new Error(data?.error ?? "無法載入待審核項目");
        if (!cancelled) setPendingItems(Array.isArray(data.categories) ? data.categories : []);
      } catch (e: any) {
        if (!cancelled) setPendingError(e?.message ?? "無法載入待審核項目");
      } finally {
        if (!cancelled) setPendingLoading(false);
      }
    };

    void loadPending();

    return () => {
      cancelled = true;
    };
  }, [activeLang]);

  const handleSave = async () => {
    setError(null);
    let parsed: FlatCategory[];
    try {
      parsed = new Function(currentJson)() as FlatCategory[];
      if (!Array.isArray(parsed)) throw new Error("必須 return 陣列");
    } catch (e: any) {
      setError("JS 執行錯誤：" + e.message);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: activeLang, items: parsed }),
      });
      const j = await readJsonSafe(res);
      if (!res.ok) { setError(j?.error ?? "儲存失敗"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("網路錯誤");
    } finally {
      setSaving(false);
    }
  };

  const reviewItem = async (categoryId: string, action: "approve" | "reject") => {
    setPendingError(null);
    setReviewingId(categoryId);
    try {
      const res = await fetch("/api/admin/reviews/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, action }),
      });
      const data = await readJsonSafe(res);
      if (!res.ok) {
        const fallback = `審核失敗 (HTTP ${res.status})`;
        const detailText = typeof data?.details === "string" && data.details.trim().length > 0
          ? `\n${data.details}`
          : "";
        throw new Error(`${data?.error ?? fallback}${detailText}`);
      }
      setPendingItems(prev => prev.filter(item => item.id !== categoryId));
    } catch (e: any) {
      setPendingError(e?.message ?? "審核失敗");
    } finally {
      setReviewingId(null);
    }
  };

  const viewQuestions = async (item: ReviewItem) => {
    setViewingItem(item);
    setViewingLoading(true);
    setViewingError(null);
    setViewingQuestions([]);

    try {
      const res = await fetch(`/api/admin/reviews/categories/questions?categoryId=${encodeURIComponent(item.id)}`, {
        cache: "no-store",
      });
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.error ?? "無法載入題目");
      setViewingQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (e: any) {
      setViewingError(e?.message ?? "無法載入題目");
    } finally {
      setViewingLoading(false);
    }
  };

  const closeViewer = () => {
    setViewingItem(null);
    setViewingQuestions([]);
    setViewingError(null);
    setViewingLoading(false);
  };

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}>
      <h1 className="text-2xl font-bold mb-6">分類管理</h1>

      {/* language tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
        {LANGS.map(l => (
          <button
            key={l.code}
            onClick={() => { setActiveLang(l.code); setError(null); setSaved(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeLang === l.code ? "border-current" : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
            style={activeLang === l.code ? { color: "var(--zen-ink)" } : {}}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex gap-6 items-start">
        {/* editor */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">JS 編輯（return FlatCategory[] — parentId 指向父節點）</span>
            <div className="flex items-center gap-2">
              {saved && <span className="text-xs text-green-500">已儲存 ✓</span>}
              {error && <span className="text-xs text-red-500">{error}</span>}
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                {saving ? "儲存中..." : "儲存"}
              </button>
            </div>
          </div>
          <textarea
            value={currentJson}
            onChange={e => setJsonTexts(prev => ({ ...prev, [activeLang]: e.target.value }))}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 p-4 text-xs font-mono outline-none resize-y"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "60vh" }}
            spellCheck={false}
          />
        </div>

        {/* preview */}
        <div className="w-64 shrink-0">
          <p className="text-xs text-zinc-400 mb-3">預覽</p>
          <Preview json={currentJson} />
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold">待審核上傳</h2>
            <p className="text-xs text-zinc-400">目前語言：{activeLang}</p>
          </div>
          <div className="text-xs text-zinc-400">{pendingLoading ? "載入中..." : `${pendingItems.length} 筆待審核`}</div>
        </div>

        {pendingError && <p className="mb-3 text-sm text-red-500">{pendingError}</p>}

        {pendingLoading ? (
          <p className="text-sm text-zinc-500">正在讀取待審核項目...</p>
        ) : pendingItems.length === 0 ? (
          <p className="text-sm text-zinc-500">目前沒有待審核的分類。</p>
        ) : (
          <div className="grid gap-3">
            {pendingItems.map(item => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-zinc-400 break-all">
                    {item.href ? item.href : "(no href)"} · {item.owner_id}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => viewQuestions(item)}
                    className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm disabled:opacity-50"
                  >
                    View questions
                  </button>
                  <button
                    onClick={() => reviewItem(item.id, "approve")}
                    disabled={reviewingId === item.id}
                    className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {reviewingId === item.id ? "處理中..." : "Approve"}
                  </button>
                  <button
                    onClick={() => reviewItem(item.id, "reject")}
                    disabled={reviewingId === item.id}
                    className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {viewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeViewer}>
          <div
            className="w-full max-w-4xl rounded-2xl border border-zinc-200 bg-[var(--zen-bg)] p-5 shadow-2xl dark:border-zinc-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{viewingItem.name}</h3>
                <p className="text-xs text-zinc-400 break-all">{viewingItem.href ?? "(no href)"}</p>
              </div>
              <button onClick={closeViewer} className="rounded-full border border-zinc-300 px-3 py-1 text-sm">
                Close
              </button>
            </div>

            {viewingLoading ? (
              <p className="text-sm text-zinc-500">正在載入題目...</p>
            ) : viewingError ? (
              <p className="text-sm text-red-500">{viewingError}</p>
            ) : viewingQuestions.length === 0 ? (
              <p className="text-sm text-zinc-500">沒有找到題目。</p>
            ) : (
              <div className="max-h-[70vh] overflow-auto pr-1 space-y-3">
                {viewingQuestions.map((q) => (
                  <div key={q.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {q.number}. {q.title}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {q.type ?? "single"}
                          {typeof q.level === "number" ? ` · level ${q.level}` : ""}
                          {q.groupRange ? ` · ${q.groupRange}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400">#{q.id}</div>
                    </div>

                    {q.groupContent && q.type !== "group" && (
                      <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm dark:bg-zinc-800">{q.groupContent}</p>
                    )}

                    {Array.isArray(q.options) && q.options.length > 0 && (
                      <ul className="mt-3 grid gap-2 md:grid-cols-2">
                        {q.options.map((option) => (
                          <li key={option.label} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
                            <span className="font-medium">{option.label}.</span> {option.text}
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-3 text-xs text-zinc-500">
                      Answer: {Array.isArray(q.answer) ? q.answer.join(", ") : (q.answer ?? "")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Preview({ json }: { json: string }) {
  let items: FlatCategory[] = [];
  try {
    const result = new Function(json)();
    if (Array.isArray(result)) items = result;
  } catch { /* invalid */ }
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-xs text-zinc-400">（無內容或格式錯誤）</p>;
  }

  // Build a depth map by walking parent chain
  const byId = new Map<string, FlatCategory>();
  for (const i of items) if (i.id) byId.set(i.id, i);
  const depthOf = (item: FlatCategory): number => {
    let depth = 0;
    let cur = item;
    while (cur.parentId) {
      const parent = byId.get(cur.parentId);
      if (!parent) break;
      depth += 1;
      cur = parent;
    }
    return depth;
  };

  // Detect duplicate ids so the editor can warn instead of silently crashing on save
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const i of items) {
    if (!i.id) continue;
    if (seen.has(i.id)) duplicates.add(i.id);
    else seen.add(i.id);
  }

  return (
    <>
      {duplicates.size > 0 && (
        <p className="mb-3 text-xs" style={{ color: "#ef4444" }}>
          重複的 id：{[...duplicates].join(", ")}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {items.map((item, i) => {
          const d = depthOf(item);
          const isFolder = !item.href || items.some(x => x.parentId === item.id);
          const dup = item.id && duplicates.has(item.id);
          return (
            <li key={i} className="text-sm" style={{ paddingLeft: d * 12 }}>
              <span className="font-medium" style={{ color: dup ? "#ef4444" : "var(--zen-ink)" }}>
                {isFolder && "📁 "}{item.name}
              </span>
              {item.href && <span className="ml-2 text-xs text-zinc-400">{item.href}</span>}
              {(item.dropdown ?? []).length > 0 && (
                <span className="ml-2 text-xs text-zinc-400">▾{item.dropdown!.length}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
