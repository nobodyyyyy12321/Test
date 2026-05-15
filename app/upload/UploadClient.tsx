"use client";

import { useState, useRef, useCallback } from "react";

type QuestionType = "single" | "multiple" | "true_false" | "fill";

type SingleMeta = {
  name: string;
  language: string;
  problemsPerTest: string;   // empty string when blank
  shuffleProblems: boolean;
  isPublic: boolean;
};

type SingleQuestionForm = {
  number: string;
  content: string;
  q_type: QuestionType;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** For single -> one letter; for multiple -> comma-separated; for fill -> free text */
  answer: string;
  level: string;
};

const BLANK_META: SingleMeta = {
  name: "",
  language: "zh-TW",
  problemsPerTest: "",
  shuffleProblems: true,
  isPublic: false,
};

const BLANK_QUESTION_FORM: SingleQuestionForm = {
  number: "1",
  content: "",
  q_type: "single",
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
    name: "測試",
    problems_per_test: 1,
    shuffle_problems: false,
    is_public: false,
    questions: [
      {
        number: 1,
        content: "題目文字1",
        q_type: "single",
        options: { A: "上", B: "下", C: "左", D: "右" },
        answer: "A",
      },
    ],
  },
  null,
  2
);

type UploadResult =
  | { ok: true; categoryId: string; inserted: number; approvalStatus: string }
  | { ok: false; error: string };

function UploadSuccessMessage({ categoryId, inserted }: { categoryId: string; inserted: number }) {
  return (
    <div className="space-y-2">
      <p className="font-medium text-green-600 dark:text-green-400">上傳成功</p>
      <p className="inline-flex items-center rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        待審核
      </p>
      <p className="text-xs text-zinc-500">
        已送出 {inserted} 題（ID：{categoryId}）。管理員核准後才會出現在首頁與個人題庫。
      </p>
    </div>
  );
}

export default function UploadClient() {
  const [tab, setTab] = useState<"json" | "single">("json");

  const [jsonText, setJsonText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [singleStep, setSingleStep] = useState<"meta" | "question">("meta");
  const [meta, setMeta] = useState<SingleMeta>(BLANK_META);
  const [form, setForm] = useState<SingleQuestionForm>(BLANK_QUESTION_FORM);
  const [queued, setQueued] = useState<Array<Record<string, unknown>>>([]);
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
    if (!meta.name.trim()) {
      setSingleError("請填寫題庫名稱");
      return;
    }
    setMeta((m) => ({ ...m, name: m.name.trim() }));
    setSingleStep("question");
  };

  const resetSingleQuestionForm = (nextNumber = "1") => {
    setForm({ ...BLANK_QUESTION_FORM, number: nextNumber });
    setSingleError(null);
    setSingleResult(null);
  };

  const resetSingleFlow = () => {
    setMeta(BLANK_META);
    setQueued([]);
    setSingleStep("meta");
    resetSingleQuestionForm();
  };

  const buildQuestionFromForm = (): Record<string, unknown> | null => {
    const num = Number(form.number);
    if (!form.number || !Number.isFinite(num) || num <= 0 || !Number.isInteger(num)) {
      setSingleError("題號必須是正整數");
      return null;
    }
    if (!form.content.trim()) {
      setSingleError("請填寫題目");
      return null;
    }

    let answer: string | string[] = form.answer.trim();
    if (form.q_type === "multiple") {
      answer = form.answer.split(/[,，\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (answer.length === 0) {
        setSingleError("多選題請填寫答案");
        return null;
      }
    } else if (form.q_type === "single") {
      answer = form.answer.trim().toUpperCase();
      if (!answer) {
        setSingleError("請填寫答案選項（A/B/C/D）");
        return null;
      }
    } else if (form.q_type === "fill" && !answer) {
      setSingleError("填空題請填寫答案");
      return null;
    }

    const options: Record<string, string> = {};
    if (form.q_type !== "fill") {
      if (form.optionA.trim()) options.A = form.optionA.trim();
      if (form.optionB.trim()) options.B = form.optionB.trim();
      if (form.optionC.trim()) options.C = form.optionC.trim();
      if (form.optionD.trim()) options.D = form.optionD.trim();
    }

    return {
      number: num,
      content: form.content.trim(),
      q_type: form.q_type,
      options,
      answer,
      ...(form.level && Number.isFinite(Number(form.level)) ? { level: Number(form.level) } : {}),
    };
  };

  const handleQueueQuestion = () => {
    setSingleError(null);
    setSingleResult(null);
    const q = buildQuestionFromForm();
    if (!q) return;
    setQueued((qs) => [...qs, q]);
    const nextNum = (Number(form.number) || 0) + 1;
    resetSingleQuestionForm(String(nextNum));
  };

  const buildPayload = (questions: Array<Record<string, unknown>>) => {
    const payload: Record<string, unknown> = {
      language: meta.language,
      name: meta.name.trim(),
      shuffle_problems: meta.shuffleProblems,
      is_public: meta.isPublic,
      questions,
    };
    const ppt = Number(meta.problemsPerTest);
    if (meta.problemsPerTest && Number.isFinite(ppt) && ppt > 0) {
      payload.problems_per_test = Math.floor(ppt);
    }
    return payload;
  };

  const submitToApi = async (payload: Record<string, unknown>): Promise<UploadResult> => {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
      return {
        ok: true,
        categoryId: data.categoryId,
        inserted: data.inserted,
        approvalStatus: data.approvalStatus ?? "pending",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };

  const handleSingleUpload = async () => {
    setSingleError(null);
    setSingleResult(null);

    if (!meta.name.trim()) {
      setSingleStep("meta");
      setSingleError("請先填好題庫名稱");
      return;
    }

    // If the current form has content, queue it too.
    let questions = queued;
    if (form.content.trim() || form.optionA.trim() || form.optionB.trim()) {
      const q = buildQuestionFromForm();
      if (!q) return;
      questions = [...queued, q];
    }

    if (questions.length === 0) {
      setSingleError("至少要有一題");
      return;
    }

    setSingleUploading(true);
    const data = await submitToApi(buildPayload(questions));
    setSingleResult(data);
    if (data.ok) {
      setQueued([]);
      resetSingleQuestionForm("1");
    }
    setSingleUploading(false);
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
      } catch (err) {
        setParseError("JSON 格式錯誤：" + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
  };

  const handleUpload = async () => {
    setParseError(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (err) {
      setParseError("JSON 格式錯誤：" + (err instanceof Error ? err.message : String(err)));
      return;
    }
    setUploading(true);
    setResult(null);
    const data = await submitToApi(parsed as Record<string, unknown>);
    setResult(data);
    setUploading(false);
  };

  const preview = (() => {
    if (!jsonText) return null;
    try {
      const p = JSON.parse(jsonText) as { language?: string; name?: string; questions?: unknown[] };
      const lines: string[] = [];
      if (p.language) lines.push(`語言：${p.language}`);
      if (p.name) lines.push(`題庫：${p.name}`);
      if (Array.isArray(p.questions)) lines.push(`題目：${p.questions.length} 題`);
      return lines.length ? lines : null;
    } catch {
      return null;
    }
  })();

  return (
    <div className="min-h-screen p-6 max-w-2xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-xl font-bold mb-1">上傳題庫</h1>
      

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-zinc-500">每次抽題數（選填）</span>
                  <input
                    type="number"
                    min={1}
                    value={meta.problemsPerTest}
                    onChange={(e) => setMetaField("problemsPerTest", e.target.value)}
                    placeholder="留空 = 全部"
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={meta.shuffleProblems}
                    onChange={(e) => setMetaField("shuffleProblems", e.target.checked)}
                  />
                  隨機出題
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={meta.isPublic}
                    onChange={(e) => setMetaField("isPublic", e.target.checked)}
                  />
                  公開閱覽
                </label>
              </div>

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
                      語言：{meta.language}　每次：{meta.problemsPerTest || "全部"}　{meta.shuffleProblems ? "隨機" : "順序"}　{meta.isPublic ? "公開" : "私人"}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">已佇列 {queued.length} 題</p>
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
                    value={form.q_type}
                    onChange={(e) => setField("q_type", e.target.value as QuestionType)}
                    className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  >
                    <option value="single">單選 single</option>
                    <option value="multiple">多選 multiple</option>
                    <option value="true_false">是非 true_false</option>
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
                  value={form.content}
                  onChange={(e) => setField("content", e.target.value)}
                  placeholder="請輸入題目文字..."
                  rows={3}
                  className="rounded-lg border border-zinc-300 dark:border-zinc-600 px-3 py-2 text-sm outline-none resize-y"
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                />
              </label>

              {form.q_type !== "fill" && (
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
                  {form.q_type === "single" && <span className="ml-1 text-zinc-400">（填 A / B / C / D）</span>}
                  {form.q_type === "multiple" && <span className="ml-1 text-zinc-400">（多個答案以逗號分隔，例：A,C）</span>}
                  {form.q_type === "fill" && <span className="ml-1 text-zinc-400">（填字串）</span>}
                  {form.q_type === "true_false" && <span className="ml-1 text-zinc-400">（O / X）</span>}
                </span>
                <input
                  value={form.answer}
                  onChange={(e) => setField("answer", e.target.value)}
                  placeholder={form.q_type === "fill" ? "答案文字" : form.q_type === "multiple" ? "A,C" : "A"}
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
                    <UploadSuccessMessage
                      categoryId={singleResult.categoryId}
                      inserted={singleResult.inserted}
                    />
                  ) : (
                    <p className="text-red-600 dark:text-red-400 text-xs">錯誤：{singleResult.error}</p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleQueueQuestion}
                  className="px-4 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 transition-colors"
                >
                  加入下一題
                </button>
                <button
                  onClick={handleSingleUpload}
                  disabled={singleUploading}
                  className="px-5 py-2 text-sm rounded-full disabled:opacity-40 transition-colors"
                  style={{ background: "#5fa870", color: "#fff" }}
                >
                  {singleUploading ? "上傳中..." : `完成上傳（${queued.length + (form.content.trim() ? 1 : 0)} 題）`}
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
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", minHeight: "220px" }}
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
              onClick={handleUpload}
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

          {result && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                result.ok
                  ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                  : "border-red-400 bg-red-50 dark:bg-red-900/10"
              }`}
            >
              {result.ok ? (
                <UploadSuccessMessage
                  categoryId={result.categoryId}
                  inserted={result.inserted}
                />
              ) : (
                <p className="text-red-600 dark:text-red-400">錯誤：{result.error}</p>
              )}
            </div>
          )}

          <details className="mt-10">
            <summary className="text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 transition-colors">
              JSON 格式說明
            </summary>
            <pre className="mt-3 text-xs font-mono text-zinc-500 bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap">{`{
  "language": "zh-TW",
  "name": "題庫名稱",
  "problems_per_test": 1,         // 選填，每次抽題數
  "shuffle_problems": false,      // 選填，是否隨機出題
  "is_public": false,             // 選填，是否公開
  "questions": [
    {
      "number": 1,
      "content": "題目文字",
      "q_type": "single",         // single | multiple | true_false | fill
      "options": { "A": "選項A", "B": "選項B" },
      "answer": "A",              // multiple 可填 "AC" 或陣列 ["A","C"]
      "level": 1,                 // 選填
      "explanation": "..."        // 選填
    }
  ]
}`}</pre>
          </details>
        </>
      )}
    </div>
  );
}
