"use client";

import { useState } from "react";

const EXAMPLE = JSON.stringify(
  {
    language: "zh-TW",
    name: "測試",
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

type Result =
  | { kind: "ok"; categoryId: string; inserted: number }
  | { kind: "err"; message: string };

export default function Upload2Client() {
  const [text, setText] = useState(EXAMPLE);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    try {
      const parsed = JSON.parse(text);
      const res = await fetch("/api/upload2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ kind: "err", message: data?.error ?? `HTTP ${res.status}` });
      } else {
        setResult({ kind: "ok", categoryId: data.categoryId, inserted: data.inserted });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ kind: "err", message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>個人題庫上傳 (dev)</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>
        貼入 JSON 後點 Upload 建立一個 category 與其底下的題目。
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          minHeight: 360,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 13,
          padding: 12,
          border: "1px solid #ccc",
          borderRadius: 6,
        }}
      />
      <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #333",
            background: busy ? "#eee" : "#111",
            color: busy ? "#666" : "#fff",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
        {result?.kind === "ok" && (
          <span style={{ color: "#080", fontSize: 13 }}>
            ✓ Inserted {result.inserted} questions · category {result.categoryId}
          </span>
        )}
        {result?.kind === "err" && (
          <span style={{ color: "#c00", fontSize: 13 }}>✗ {result.message}</span>
        )}
      </div>
    </div>
  );
}
