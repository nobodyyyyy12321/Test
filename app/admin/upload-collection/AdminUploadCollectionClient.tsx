"use client";

import { useRef, useState } from "react";

const EXAMPLE = JSON.stringify(
  {
    language: "zh-TW",
    categories: [{ name: "金句", href: "/test/quoteChinese" }],
    collections: {
      quoteChinese: [
        {
          number: 1,
          title: "學而時習之，不亦__乎。—論語",
          type: "single",
          options: { A: "樂", B: "喜", C: "悅", D: "好" },
          answer: "C",
        },
      ],
    },
  },
  null,
  2
);

type CollectionResult = {
  upserted: number;
  gridName: string;
  navCreated: boolean;
  navWarning?: string;
};

type UploadResult = {
  ok: boolean;
  language?: string;
  results?: Record<string, CollectionResult>;
  errors?: Record<string, string>;
  error?: string;
};

export default function AdminUploadCollectionClient() {
  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = (() => {
    if (!jsonText.trim()) return null;
    try {
      const p = JSON.parse(jsonText) as any;
      const lines: string[] = [];
      if (p.language) lines.push(`語言：${p.language}`);
      if (p.collections && typeof p.collections === "object") {
        for (const [id, qs] of Object.entries(p.collections)) {
          lines.push(`題庫「${id}」：${Array.isArray(qs) ? qs.length : "?"} 題`);
        }
      }
      if (Array.isArray(p.categories) && p.categories.length > 0) {
        lines.push(`首頁顯示名稱（categories[].name）：${p.categories.map((c: any) => c?.name).filter(Boolean).join("、")}`);
      }
      return lines.length ? lines : null;
    } catch {
      return null;
    }
  })();

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setParseError("只接受 .json 檔案");
      return;
    }
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
    try { parsed = JSON.parse(jsonText); }
    catch (err: any) { setParseError("JSON 格式錯誤：" + err.message); return; }

    setUploading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/upload-collection", {
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

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-xl font-bold mb-1">上傳全站題庫（admin）</h1>
      <p className="text-sm text-zinc-400 mb-6">
        上傳格式與「個人題庫上傳」相同：用 <code>collections</code> 的 key 作為題庫網址（即 <code>/test/&lt;collectionId&gt;</code>），
        而首頁顯示名稱來自 <code>categories</code> 陣列中對應 href 的 <code>name</code>。<br/>
        上傳完成後會自動把該題庫加到首頁分類最上層；可再到{" "}
        <a className="underline" href="/admin/categories">/admin/categories</a> 調整位置或父資料夾。
      </p>

      {/* drop zone */}
      <div
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors mb-4"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="text-sm text-zinc-400">拖曳或點擊選取 .json 檔案</p>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      <textarea
        value={jsonText}
        onChange={e => { setJsonText(e.target.value); setParseError(null); setResult(null); }}
        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 p-4 text-xs font-mono outline-none resize-y mb-1"
        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "260px" }}
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
        <button
          onClick={handleUpload}
          disabled={uploading || !jsonText || !!parseError}
          className="px-5 py-2 text-sm rounded-full disabled:opacity-40 transition-colors"
          style={{ background: "#5fa870", color: "#fff" }}
        >
          {uploading ? "上傳中..." : "上傳"}
        </button>
        <button
          onClick={() => { setJsonText(EXAMPLE); setParseError(null); setResult(null); }}
          className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          載入範例
        </button>
      </div>

      {result && (
        <div className={`rounded-xl border p-4 text-sm ${result.ok ? "border-green-400 bg-green-50 dark:bg-green-900/10" : "border-red-400 bg-red-50 dark:bg-red-900/10"}`}>
          {result.ok ? (
            <div className="space-y-2">
              <p className="font-medium text-green-600 dark:text-green-400">上傳成功 ✓</p>
              <ul className="text-xs text-zinc-500 space-y-0.5">
                {Object.entries(result.results ?? {}).map(([id, r]) => (
                  <li key={id}>
                    題庫「{id}」（顯示名稱：{r.gridName}）已寫入 {r.upserted} 題
                    {r.navCreated ? "，並加到首頁分類" : "，首頁分類已更新名稱"}
                    {" — "}
                    <a className="underline text-green-700 dark:text-green-400" href={`/test/${encodeURIComponent(id)}?autostart=1`}>立即作答</a>
                    {r.navWarning && <span className="text-amber-600 dark:text-amber-400 ml-2">⚠ {r.navWarning}</span>}
                  </li>
                ))}
              </ul>
              {result.errors && Object.keys(result.errors).length > 0 && (
                <div className="mt-2 text-xs text-red-500">
                  {Object.entries(result.errors).map(([id, msg]) => (
                    <p key={id}>題庫「{id}」失敗：{msg}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-red-600 dark:text-red-400 whitespace-pre-wrap">錯誤：{result.error}</p>
          )}
        </div>
      )}

      <details className="mt-10">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">JSON 格式說明</summary>
        <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "language": "zh-TW",                  // 選填，首頁分類所在語言（預設 zh-TW）
  "categories": [                       // 選填，但建議：用來決定首頁顯示名稱
    { "name": "金句", "href": "/test/quoteChinese" }
  ],
  "collections": {                      // 必填，key = collectionId（即 /test/<collectionId>）
    "<collectionId>": [
      {
        "number": 1,                    // 必填，題號（同 collection 內唯一）
        "title": "題目文字",
        "type": "single",               // single | multiple | fill，預設 single
        "options": { "A": "選項A", "B": "選項B" },
        "answer": "A",                  // fill 填字串，multiple 填陣列 ["A","B"]
        "level": 1,                     // 選填，難度篩選
        "groupContent": "..."           // 選填，題組共用說明
      }
    ]
  }
}`}</pre>
      </details>
    </div>
  );
}
