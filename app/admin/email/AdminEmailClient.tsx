"use client";

import { useState } from "react";

const FROM_EMAIL = "support@testtttt.io";

export default function AdminEmailClient({ adminEmail }: { adminEmail: string }) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [replyTo, setReplyTo] = useState(adminEmail);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const send = async () => {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, cc, bcc, replyTo, subject, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ type: "error", text: data.error ?? "寄送失敗" });
        return;
      }
      setStatus({ type: "ok", text: `已從 ${data.from ?? FROM_EMAIL} 寄出` });
      setTo("");
      setCc("");
      setBcc("");
      setSubject("");
      setMessage("");
    } catch {
      setStatus({ type: "error", text: "網路錯誤" });
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen w-full px-6 py-10 sm:px-10" style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}>
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-300/60 pb-4 dark:border-zinc-700">
          <div>
            <h1 className="text-2xl font-semibold zen-title">Email 後台</h1>
            <p className="mt-1 text-sm opacity-70">From: {FROM_EMAIL}</p>
          </div>
          <a href="/admin/categories" className="rounded-full border px-4 py-2 text-sm transition-opacity hover:opacity-75">
            分類管理
          </a>
        </header>

        <section className="grid gap-4">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">To</span>
            <textarea
              value={to}
              onChange={e => setTo(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-[#b19739] dark:border-zinc-700"
              placeholder="name@example.com"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Cc</span>
              <input
                value={cc}
                onChange={e => setCc(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-[#b19739] dark:border-zinc-700"
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Bcc</span>
              <input
                value={bcc}
                onChange={e => setBcc(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-[#b19739] dark:border-zinc-700"
              />
            </label>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">Reply-To</span>
            <input
              value={replyTo}
              onChange={e => setReplyTo(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-[#b19739] dark:border-zinc-700"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">主旨</span>
            <input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-[#b19739] dark:border-zinc-700"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium">內容</span>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 leading-7 outline-none focus:border-[#b19739] dark:border-zinc-700"
            />
          </label>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-300/60 pt-4 dark:border-zinc-700">
          <div className="text-sm">
            {status && (
              <span style={{ color: status.type === "ok" ? "#16a34a" : "#ef4444" }}>
                {status.text}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={send}
            disabled={sending}
            className="rounded-full border px-6 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: "#b19739", color: "#b19739" }}
          >
            {sending ? "寄送中..." : "寄出"}
          </button>
        </footer>
      </div>
    </main>
  );
}
