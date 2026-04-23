"use client";

import { useState, useRef } from "react";

type UploadResult = {
  ok: boolean;
  pendingId?: string;
  status?: string;
  error?: string;
};

const EXAMPLE_COLLECTIONS = JSON.stringify(
  {
    language: "zh-TW",
    collections: {
      englishWords: [
        { number: 1, title: "apple", type: "single", options: { A: "蘋果", B: "香蕉", C: "橘子", D: "葡萄" }, answer: "A", level: 1, category: "基礎" },
      ],
      quoteChinese: [
        { number: 1, title: "學而時習之，不亦__乎。—論語", type: "single", options: { A: "樂", B: "喜", C: "悅", D: "好" }, answer: "A", category: "金句" },
      ],
    },
  },
  null, 2
);

const EXAMPLE_CATEGORIES = JSON.stringify(
  [
    { name: "金句", href: "/test/quoteChinese" },
    { name: "英文", children: [{ name: "教育部2000單", href: "/test/englishWords?levels=1,2" }] },
  ],
  null, 2
);

const LANGS = ["zh-TW", "zh-CN", "en", "ko", "es", "th", "id"];

function SubmitResult({ result }: { result: UploadResult }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-green-400 bg-green-50 dark:bg-green-900/10" : "border-red-400 bg-red-50 dark:bg-red-900/10"}`}>
      {result.ok ? (
        <div className="space-y-1">
          <p className="font-medium text-green-600 dark:text-green-400">已送出，等待管理員審核 ✓</p>
          <p className="text-xs text-zinc-500">審核通過後內容才會正式上線</p>
        </div>
      ) : (
        <p className="text-red-600 dark:text-red-400">錯誤：{result.error}</p>
      )}
    </div>
  );
}

function CollectionsTab() {
  const [jsonText, setJsonText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) { setParseError("只接受 .json 檔案"); return; }
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      setJsonText(text);
      setParseError(null);
      setResult(null);
      try { JSON.parse(text); } catch (err: any) { setParseError("JSON 格式錯誤：" + err.message); }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    setParseError(null);
    let parsed: unknown;
    try { parsed = JSON.parse(jsonText); } catch (err: any) { setParseError("JSON 格式錯誤：" + err.message); return; }
    setUploading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "網路錯誤" });
    } finally {
      setUploading(false);
    }
  };

  const preview = (() => {
    if (!jsonText) return null;
    try {
      const p = JSON.parse(jsonText) as any;
      const lines: string[] = [];
      if (p.language) lines.push(`語言：${p.language}`);
      if (p.collections && typeof p.collections === "object") {
        for (const [id, qs] of Object.entries(p.collections)) {
          lines.push(`題庫 ${id}：${Array.isArray(qs) ? qs.length : "?"} 題`);
        }
      }
      return lines;
    } catch { return null; }
  })();

  return (
    <div>
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-400"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <p className="text-sm text-zinc-400">拖曳或點擊選取 .json 檔案</p>
        <input ref={fileRef} type="file" accept=".json" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      </div>

      <textarea
        value={jsonText}
        onChange={e => { setJsonText(e.target.value); setParseError(null); setResult(null); }}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 p-4 text-xs font-mono outline-none resize-y mb-1"
        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "240px" }}
        placeholder="或直接貼上 JSON..."
        spellCheck={false}
      />
      {parseError && <p className="text-xs text-red-500 mb-3">{parseError}</p>}
      {preview && !parseError && (
        <div className="mb-4 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 space-y-0.5">
          {preview.map((line, i) => <p key={i}>{line}</p>)}
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleUpload} disabled={uploading || !jsonText || !!parseError}
          className="px-5 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          style={{ color: "var(--zen-ink)" }}>
          {uploading ? "上傳中..." : "上傳"}
        </button>
        <button onClick={() => { setJsonText(EXAMPLE_COLLECTIONS); setParseError(null); setResult(null); }}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
          載入範例
        </button>
      </div>
      {result && <SubmitResult result={result} />}

      <details className="mt-8">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">JSON 格式說明</summary>
        <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "language": "zh-TW",
  "collections": {
    "<collectionId>": [       // 題庫名稱，自動建立同名 Supabase 表
      {
        "number": 1,          // 必填，題目編號（同 collectionId 下唯一）
        "title": "題目",
        "type": "single",     // single | multiple | fill，預設 single
        "options": { "A": "選項A", "B": "選項B" },
        "answer": "A",        // fill 填字串，multiple 填陣列 ["A","B"]
        "level": 1,           // 選填，用於篩選
        "category": "...",    // 選填，題目分類標籤
        "groupContent": "..." // 選填，共用題組說明
      }
    ]
  }
}`}</pre>
      </details>
    </div>
  );
}

function CategoriesTab() {
  const [lang, setLang] = useState("zh-TW");
  const [jsonText, setJsonText] = useState(EXAMPLE_CATEGORIES);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) throw new Error("必須是陣列 [...]");
    } catch (err: any) { setParseError("JSON 格式錯誤：" + err.message); return; }

    setUploading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang, categories: parsed }),
      });
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "網路錯誤" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm text-zinc-500">語言</span>
        <select
          value={lang}
          onChange={e => setLang(e.target.value)}
          className="text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 outline-none"
          style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
        >
          {LANGS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <textarea
        value={jsonText}
        onChange={e => { setJsonText(e.target.value); setParseError(null); setResult(null); }}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 p-4 text-xs font-mono outline-none resize-y mb-1"
        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "300px" }}
        spellCheck={false}
      />
      {parseError && <p className="text-xs text-red-500 mb-3">{parseError}</p>}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleSubmit} disabled={uploading || !jsonText || !!parseError}
          className="px-5 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          style={{ color: "var(--zen-ink)" }}>
          {uploading ? "送出中..." : "送出審核"}
        </button>
        <button onClick={() => { setJsonText(EXAMPLE_CATEGORIES); setParseError(null); setResult(null); }}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
          載入範例
        </button>
      </div>
      {result && <SubmitResult result={result} />}

      <details className="mt-8">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">CategoryNode 格式說明</summary>
        <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`[
  {
    "name": "金句",              // 顯示名稱
    "href": "/test/quoteChinese" // 直接連結（選填）
  },
  {
    "name": "英文",              // 有子項目時不需 href
    "children": [
      { "name": "教育部2000單", "href": "/test/englishWords?levels=1,2" }
    ]
  }
]`}</pre>
      </details>
    </div>
  );
}

export default function UploadClient() {
  const [tab, setTab] = useState<"collections" | "categories">("categories");

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-2xl font-bold mb-6">上傳</h1>

      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
        {([["categories", "分類"], ["collections", "題目"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? "border-current" : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
            style={tab === key ? { color: "var(--zen-ink)" } : {}}>
            {label}
          </button>
        ))}
      </div>

      {tab === "collections" ? <CollectionsTab /> : <CategoriesTab />}
    </div>
  );
}
