"use client";

import { useState, useRef, useCallback } from "react";

type QuestionType = "single" | "multiple" | "fill";

type SingleMeta = {
  collectionId: string;
  name: string;
  language: string;
};

type SingleQuestionForm = {
  number: string;
  title: string;
  type: QuestionType;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** For single -> one letter; for multiple -> comma-separated; for fill -> free text */
  answer: string;
  level: string;
};

const BLANK_META: SingleMeta = {
  collectionId: "",
  name: "",
  language: "zh-TW",
};

const BLANK_QUESTION_FORM: SingleQuestionForm = {
  number: "1",
  title: "",
  type: "single",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  answer: "",
  level: "",
};

const LANGUAGE_OPTIONS = [
  { value: "zh-TW", label: "zh-TW（繁中）" },
  { value: "en", label: "en（英文）" },
];

const EXAMPLE = JSON.stringify(
  {
    language: "zh-TW",
    categories: [{ name: "金句", href: "/test/quoteChinese" }],
    collections: {
      myQuiz: [
        {
          number: 1,
          title: "學而時習之，不亦__乎。—論語",
          type: "single",
          options: { A: "樂", B: "喜", C: "悅", D: "好" },
          answer: "A",
        },
      ],
    },
  },
  null,
  2
);

type UploadResult = {
  ok: boolean;
  language?: string;
  results?: Record<string, { upserted: number; gridName: string }>;
  errors?: Record<string, string>;
  conflicts?: Record<string, string>;
  error?: string;
};

function formatUploadError(result: UploadResult): string {
  if (result.error) return result.error;
  const firstError = result.errors ? Object.values(result.errors)[0] : null;
  if (firstError) return firstError;
  const firstConflict = result.conflicts ? Object.values(result.conflicts)[0] : null;
  if (firstConflict) return firstConflict;
  return "上傳失敗";
}

export default function MyUploadClient() {
  const [tab, setTab] = useState<"json" | "single">("json");

  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [pendingOverwrite, setPendingOverwrite] = useState<{ parsed: unknown; ids: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [singleStep, setSingleStep] = useState<"meta" | "question">("meta");
  const [meta, setMeta] = useState<SingleMeta>(BLANK_META);
  const [form, setForm] = useState<SingleQuestionForm>(BLANK_QUESTION_FORM);
  const [singleUploading, setSingleUploading] = useState(false);
  const [singleResult, setSingleResult] = useState<UploadResult | null>(null);
  const [singleError, setSingleError] = useState<string | null>(null);

  const setMetaField = useCallback(<K extends keyof SingleMeta>(key: K, value: SingleMeta[K]) => {
    setMeta((m) => ({ ...m, [key]: value }));
    setSingleError(null);
    setSingleResult(null);
  }, []);

  const setField = useCallback(<K extends keyof SingleQuestionForm>(key: K, value: SingleQuestionForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSingleError(null);
    setSingleResult(null);
  }, []);

  const handleSingleMetaNext = () => {
    setSingleError(null);
    setSingleResult(null);

    const collectionId = meta.collectionId.trim();
    if (!collectionId) {
      setSingleError("請填寫題庫 ID");
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(collectionId)) {
      setSingleError("題庫 ID 只能包含英數、底線、連字號");
      return;
    }
    if (!meta.name.trim()) {
      setSingleError("請填寫題庫名稱");
      return;
    }

    setMeta((m) => ({
      collectionId,
      name: m.name.trim(),
      language: m.language,
    }));
    setSingleStep("question");
  };

  const resetSingleQuestionForm = (nextNumber = "1") => {
    setForm({ ...BLANK_QUESTION_FORM, number: nextNumber });
    setSingleError(null);
    setSingleResult(null);
  };

  const resetSingleFlow = () => {
    setMeta(BLANK_META);
    setSingleStep("meta");
    resetSingleQuestionForm();
  };

  const handleSingleUpload = async () => {
    setSingleError(null);
    setSingleResult(null);

    const collectionId = meta.collectionId.trim();
    const displayName = meta.name.trim();
    if (!collectionId || !displayName) {
      setSingleStep("meta");
      setSingleError("請先填好題庫 ID、題庫名稱與語言");
      return;
    }

    const num = Number(form.number);
    if (!form.number || !Number.isFinite(num) || num <= 0) {
      setSingleError("題號必須是正整數");
      return;
    }
    if (!Number.isInteger(num)) {
      setSingleError("題號必須是整數");
      return;
    }
    if (!form.title.trim()) {
      setSingleError("請填寫題目");
      return;
    }

    let answer: string | string[] = form.answer.trim();
    if (form.type === "multiple") {
      answer = form.answer.split(/[,，\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (answer.length === 0) {
        setSingleError("多選題請填寫答案");
        return;
      }
    } else if (form.type === "single") {
      answer = form.answer.trim().toUpperCase();
      if (!answer) {
        setSingleError("請填寫答案選項（A/B/C/D）");
        return;
      }
    } else if (!answer) {
      setSingleError("填空題請填寫答案");
      return;
    }

    let options: Record<string, string> | null = null;
    if (form.type !== "fill") {
      options = {};
      if (form.optionA.trim()) options.A = form.optionA.trim();
      if (form.optionB.trim()) options.B = form.optionB.trim();
      if (form.optionC.trim()) options.C = form.optionC.trim();
      if (form.optionD.trim()) options.D = form.optionD.trim();
      if (Object.keys(options).length === 0) options = null;
    }

    const payload = {
      language: meta.language,
      force: [collectionId],
      categories: [{ name: displayName, href: `/test/${collectionId}` }],
      collections: {
        [collectionId]: [
          {
            number: num,
            title: form.title.trim(),
            type: form.type,
            ...(options ? { options } : {}),
            answer,
            ...(form.level && Number.isFinite(Number(form.level)) ? { level: Number(form.level) } : {}),
          },
        ],
      },
    };

    setSingleUploading(true);
    try {
      const res = await fetch("/api/my-collections/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: UploadResult = await res.json();
      setSingleResult(data);
      if (data.ok) {
        resetSingleQuestionForm(String(num + 1));
      }
    } catch {
      setSingleResult({ ok: false, error: "網路錯誤" });
    } finally {
      setSingleUploading(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      setParseError("只接受 .json 檔案");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setJsonText(text);
      setParseError(null);
      setResult(null);
      try {
        JSON.parse(text);
      } catch (err: any) {
        setParseError("JSON 格式錯誤：" + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async (force?: string[]) => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err: any) {
      setParseError("JSON 格式錯誤：" + err.message);
      return;
    }
    setUploading(true);
    setResult(null);
    try {
      const body = force?.length ? { ...(parsed as object), force } : parsed;
      const res = await fetch("/api/my-collections/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: UploadResult = await res.json();
      if (!data.ok && data.conflicts && Object.keys(data.conflicts).length > 0 && !data.error) {
        setPendingOverwrite({ parsed, ids: Object.keys(data.conflicts) });
        return;
      }
      setResult(data);
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
          lines.push(`題庫 "${id}"：${Array.isArray(qs) ? qs.length : "?"} 題`);
        }
      }
      return lines.length ? lines : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-xl font-bold mb-1">上傳個人題庫</h1>
      <p className="text-sm text-zinc-400 mb-5">
        上傳後會先進入審核流程；審核通過後才會出現在首頁「個人分類」。
      </p>

      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 w-fit">
        {(["json", "single"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-1.5 text-sm rounded-lg transition-colors"
            style={
              tab === t
                ? { background: "#5fa870", color: "#fff", fontWeight: 600 }
                : { background: "transparent", color: "var(--zen-ink)" }
            }
          >
            {t === "json" ? "JSON 批次上傳" : "逐題填寫"}
          </button>
        ))}
      </div>

      {tab === "single" && (
        <div className="space-y-5">
          {singleStep === "meta" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">題庫 ID（英數底線）<span className="text-red-400">*</span></span>
                  <input
                    value={meta.collectionId}
                    onChange={(e) => setMetaField("collectionId", e.target.value)}
                    placeholder="myQuiz"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">語言</span>
                  <select
                    value={meta.language}
                    onChange={(e) => setMetaField("language", e.target.value)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">題庫名稱<span className="text-red-400">*</span></span>
                <input
                  value={meta.name}
                  onChange={(e) => setMetaField("name", e.target.value)}
                  placeholder="我的英文題目"
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                />
              </label>

              {singleError && <p className="text-xs text-red-500">{singleError}</p>}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleSingleMetaNext}
                  className="px-5 py-2 text-sm rounded-full transition-colors"
                  style={{ background: "#5fa870", color: "#fff" }}
                >
                  下一步：填寫題目
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium">{meta.name}</p>
                    <p className="text-xs text-zinc-400">
                      ID：{meta.collectionId}　語言：{meta.language}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSingleStep("meta");
                      setSingleError(null);
                      setSingleResult(null);
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors self-start sm:self-auto"
                  >
                    修改題庫資訊
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">題號<span className="text-red-400">*</span></span>
                  <input
                    type="number"
                    min={1}
                    value={form.number}
                    onChange={(e) => setField("number", e.target.value)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">題型<span className="text-red-400">*</span></span>
                  <select
                    value={form.type}
                    onChange={(e) => setField("type", e.target.value as QuestionType)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  >
                    <option value="single">單選 single</option>
                    <option value="multiple">多選 multiple</option>
                    <option value="fill">填空 fill</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">難度（選填）</span>
                  <input
                    type="number"
                    min={1}
                    value={form.level}
                    onChange={(e) => setField("level", e.target.value)}
                    placeholder="1"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">題目<span className="text-red-400">*</span></span>
                <textarea
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="請輸入題目文字..."
                  rows={3}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none resize-y"
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                />
              </label>

              {form.type !== "fill" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(["A", "B", "C", "D"] as const).map((letter) => {
                    const key = `option${letter}` as keyof SingleQuestionForm;
                    return (
                      <label key={letter} className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500">選項 {letter}</span>
                        <input
                          value={form[key] as string}
                          onChange={(e) => setField(key, e.target.value)}
                          placeholder={`選項 ${letter}`}
                          className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <label className="flex flex-col gap-1">
                <span className="text-xs text-zinc-500">
                  答案<span className="text-red-400">*</span>
                  {form.type === "single" && <span className="ml-1 text-zinc-400">（填 A / B / C / D）</span>}
                  {form.type === "multiple" && <span className="ml-1 text-zinc-400">（多個答案以逗號分隔，例：A,C）</span>}
                  {form.type === "fill" && <span className="ml-1 text-zinc-400">（填字串）</span>}
                </span>
                <input
                  value={form.answer}
                  onChange={(e) => setField("answer", e.target.value)}
                  placeholder={form.type === "fill" ? "答案文字" : form.type === "multiple" ? "A,C" : "A"}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                />
              </label>

              {singleError && <p className="text-xs text-red-500">{singleError}</p>}

              {singleResult && (
                <div
                  className={`rounded-xl border p-3 text-sm ${
                    singleResult.ok
                      ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                      : "border-red-400 bg-red-50 dark:bg-red-900/10"
                  }`}
                >
                  {singleResult.ok ? (
                    <p className="text-green-600 dark:text-green-400 text-xs">
                      ✓ 上傳成功，審核中。題號已自動加 1，可繼續填寫下一題。
                    </p>
                  ) : (
                    <p className="text-red-600 dark:text-red-400 text-xs">錯誤：{formatUploadError(singleResult)}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleSingleUpload}
                  disabled={singleUploading}
                  className="px-5 py-2 text-sm rounded-full disabled:opacity-40 transition-colors"
                  style={{ background: "#5fa870", color: "#fff" }}
                >
                  {singleUploading ? "上傳中..." : "上傳這一題"}
                </button>
                <button
                  onClick={() => resetSingleQuestionForm(form.number)}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  清空這一題
                </button>
                <button
                  onClick={resetSingleFlow}
                  className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  重新設定題庫
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "json" && (
        <>
          <div
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-zinc-300 dark:border-zinc-600 rounded-xl p-8 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a1a1aa"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          <textarea
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              setParseError(null);
              setResult(null);
            }}
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 p-4 text-xs font-mono outline-none resize-y mb-1"
            style={{
              backgroundColor: "var(--zen-bg)",
              color: "var(--zen-ink)",
              minHeight: "220px",
            }}
            placeholder="或直接貼上 JSON..."
            spellCheck={false}
          />

          {parseError && <p className="text-xs text-red-500 mb-3">{parseError}</p>}

          {preview && !parseError && (
            <div className="mb-4 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 space-y-0.5">
              {preview.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => handleUpload()}
              disabled={uploading || !jsonText || !!parseError}
              className="px-5 py-2 text-sm rounded-full disabled:opacity-40 transition-colors"
              style={{ background: "#5fa870", color: "#fff" }}
            >
              {uploading ? "上傳中..." : "上傳"}
            </button>
            <button
              onClick={() => {
                setJsonText(EXAMPLE);
                setParseError(null);
                setResult(null);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              載入範例
            </button>
          </div>

          {pendingOverwrite && (
            <div className="mb-4 rounded-xl border border-amber-400 bg-amber-50 dark:bg-amber-900/10 p-4 text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400 mb-2">以下題庫已存在，確定要覆蓋嗎？</p>
              <ul className="text-xs text-zinc-600 dark:text-zinc-300 mb-3 space-y-0.5 list-disc list-inside">
                {pendingOverwrite.ids.map((id) => <li key={id}>{id}</li>)}
              </ul>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const ids = pendingOverwrite.ids;
                    setPendingOverwrite(null);
                    await handleUpload(ids);
                  }}
                  disabled={uploading}
                  className="px-4 py-1.5 text-xs rounded-full disabled:opacity-40"
                  style={{ background: "#ef4444", color: "#fff" }}
                >
                  確定覆蓋
                </button>
                <button
                  onClick={() => setPendingOverwrite(null)}
                  className="px-4 py-1.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-600"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {result && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                result.ok
                  ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                  : "border-red-400 bg-red-50 dark:bg-red-900/10"
              }`}
            >
              {result.ok ? (
                <div className="space-y-2">
                  <p className="font-medium text-green-600 dark:text-green-400">上傳成功，審核中 ✓</p>
                  <ul className="text-xs text-zinc-500 space-y-0.5">
                    {Object.entries(result.results ?? {}).map(([id, r]) => (
                      <li key={id}>
                        題庫「{id}」已寫入 {r.upserted} 題，狀態：審核中。
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
                  <p className="text-xs text-zinc-400 mt-1">
                    返回{" "}
                    <a href="/" className="underline">
                      首頁
                    </a>{" "}
                    待審核通過後可在「個人分類」看到新題庫。
                  </p>
                </div>
              ) : (
                <p className="text-red-600 dark:text-red-400">錯誤：{formatUploadError(result)}</p>
              )}
            </div>
          )}

          <details className="mt-10">
            <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">
              JSON 格式說明
            </summary>
            <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "language": "zh-TW",
  "categories": [                       // 選填，僅供標記用途
    { "name": "金句", "href": "/test/quoteChinese" }
  ],
  "collections": {                      // 必填，key = collectionId（英數底線）
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
        </>
      )}
    </div>
  );
}
