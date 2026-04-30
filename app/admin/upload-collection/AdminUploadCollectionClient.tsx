"use client";

import { useRef, useState } from "react";

const EXAMPLE = JSON.stringify(
  {
    examName: "國文學測115",
    items: [
      {
        id: "1-3",
        type: "group",
        content: "閱讀以下文章…（共用題組說明）",
      },
      {
        id: 1,
        type: "single_choice",
        title: "下列文意何者正確？",
        options: { A: "選項A", B: "選項B", C: "選項C", D: "選項D" },
        answer: "A",
      },
      {
        id: 2,
        type: "multiple_choice",
        title: "下列何者為複選題（多選）？",
        options: { A: "甲", B: "乙", C: "丙", D: "丁" },
        answer: "AC",
      },
    ],
  },
  null,
  2
);

type UploadResult = {
  ok: boolean;
  examName?: string;
  insertedQuestions?: number;
  insertedGroups?: number;
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
      if (p.examName) lines.push(`題庫名稱（exam_name）：${p.examName}`);
      if (Array.isArray(p.items)) {
        const groups = p.items.filter((i: any) => i?.type === "group").length;
        const single = p.items.filter((i: any) => i?.type === "single_choice").length;
        const multi  = p.items.filter((i: any) => i?.type === "multiple_choice").length;
        lines.push(`單選：${single} 題　多選：${multi} 題　題組說明：${groups} 段`);
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

  const examNamePeek = (() => {
    try { return (JSON.parse(jsonText) as any)?.examName as string | undefined; }
    catch { return undefined; }
  })();

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-xl font-bold mb-1">上傳全站題庫（admin）</h1>
      <p className="text-sm text-zinc-400 mb-6">
        寫入 <code>questions</code> / <code>question_groups</code>，題庫網址為 <code>/test/&lt;examName&gt;</code>。
        重新上傳同樣的 examName 會覆蓋既有題目。<br/>
        儲存後仍需到 <a className="underline" href="/admin/categories">/admin/categories</a> 加上導覽項目（href 指向 <code>/test/&lt;examName&gt;</code>）。
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
              <p className="text-xs text-zinc-500">
                題庫「{result.examName}」：選擇題 {result.insertedQuestions} 題、題組 {result.insertedGroups} 段。
              </p>
              <p className="text-xs">
                <a className="underline text-green-700 dark:text-green-400" href={`/test/${encodeURIComponent(result.examName ?? examNamePeek ?? "")}?autostart=1`}>立即作答</a>
                {"　"}
                <a className="underline" href="/admin/categories">前往 /admin/categories 加導覽項目</a>
              </p>
            </div>
          ) : (
            <p className="text-red-600 dark:text-red-400 whitespace-pre-wrap">錯誤：{result.error}</p>
          )}
        </div>
      )}

      <details className="mt-10">
        <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">JSON 格式說明</summary>
        <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "examName": "國文學測115",         // 必填，題庫 ID（即 /test/<examName> 的網址）
  "items": [
    // 題組說明（選填，可有多筆）
    { "id": "1-3", "type": "group", "content": "..." },

    // 選擇題（單選 / 多選）
    {
      "id": 1,                       // 題號（同 examName 內唯一）
      "type": "single_choice",       // 或 "multiple_choice"
      "title": "題目文字",
      "options": { "A": "...", "B": "..." },
      "answer": "A"                  // multiple_choice 用串接字串如 "AC"
    }
  ]
}`}</pre>
      </details>
    </div>
  );
}
