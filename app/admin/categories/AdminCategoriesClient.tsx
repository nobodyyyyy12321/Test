"use client";

import { useState } from "react";
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

const STARTER_COMMENT = `// Flat list — each item declares its parent.
// parentId: null = top-level under this language.
// Sibling order is the array order. Omit \`id\` for new items (server generates one).
//
// return [
//   { id: "abc", parentId: null, name: "學測", },
//   { id: "def", parentId: "abc", name: "國文", href: "/test/gsat-chinese" },
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

  const currentJson = jsonTexts[activeLang] ?? "[]";

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
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "儲存失敗"); return; }
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
