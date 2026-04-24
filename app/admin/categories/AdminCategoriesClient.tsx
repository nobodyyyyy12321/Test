"use client";

import { useState } from "react";
import type { CategoryNode } from "../../../lib/categories";

const LANGS = [
  { code: "zh-TW", label: "繁中" },
  { code: "zh-CN", label: "簡中" },
  { code: "en",    label: "EN" },
  { code: "ko",    label: "KO" },
  { code: "es",    label: "ES" },
  { code: "th",    label: "TH" },
  { code: "id",    label: "ID" },
];

type Entry = { language: string; data: CategoryNode[] };

export default function AdminCategoriesClient({ initialEntries }: { initialEntries: Entry[] }) {
  const [activeLang, setActiveLang] = useState("zh-TW");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [jsonTexts, setJsonTexts] = useState<Record<string, string>>(
    Object.fromEntries(initialEntries.map(e => [
      e.language,
      `// 可使用 JavaScript 語法（迴圈、變數等），最後 return 分類陣列\n\nreturn ${JSON.stringify(e.data, null, 2)};`
    ]))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentJson = jsonTexts[activeLang] ?? "[]";

  const handleSave = async () => {
    setError(null);
    let parsed: CategoryNode[];
    try {
      // eslint-disable-next-line no-new-func
      parsed = new Function(currentJson)() as CategoryNode[];
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
        body: JSON.stringify({ language: activeLang, data: parsed }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "儲存失敗"); return; }
      setEntries(prev => prev.map(e => e.language === activeLang ? { ...e, data: parsed } : e));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("網路錯誤");
    } finally {
      setSaving(false);
    }
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
            <span className="text-xs text-zinc-400">JS 編輯（return CategoryNode[]）</span>
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
    </div>
  );
}

function Preview({ json }: { json: string }) {
  let nodes: CategoryNode[] = [];
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(json)();
    if (Array.isArray(result)) nodes = result;
  } catch { /* invalid */ }
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return <p className="text-xs text-zinc-400">（無內容或格式錯誤）</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {nodes.map((node, i) => (
        <li key={i} className="text-sm">
          <span className="font-medium" style={{ color: "var(--zen-ink)" }}>{node.name}</span>
          {node.href && <span className="ml-2 text-xs text-zinc-400">{node.href}</span>}
          {(node.children ?? []).length > 0 && (
            <ul className="ml-4 mt-0.5 flex flex-col gap-0.5">
              {node.children!.map((c, j) => (
                <li key={j} className="text-xs text-zinc-500">
                  {c.name}{c.href ? ` → ${c.href}` : ""}
                  {(c.dropdown ?? []).length > 0 && <span className="ml-1 text-zinc-400">▾{c.dropdown!.length}</span>}
                </li>
              ))}
            </ul>
          )}
          {(node.dropdown ?? []).length > 0 && (
            <span className="ml-2 text-xs text-zinc-400">▾{node.dropdown!.length} 項</span>
          )}
        </li>
      ))}
    </ul>
  );
}
