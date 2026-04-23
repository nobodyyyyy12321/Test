"use client";

import { useState } from "react";
import type { PendingUpload } from "../../../lib/pending-uploads";

const STATUS_LABEL: Record<string, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已拒絕",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-600 dark:text-yellow-400",
  approved: "text-green-600 dark:text-green-400",
  rejected: "text-red-500",
};

function PayloadSummary({ payload }: { payload: any }) {
  const lines: string[] = [];
  if (payload?.language) lines.push(`語言：${payload.language}`);
  if (Array.isArray(payload?.categories)) lines.push(`分類：${payload.categories.length} 項`);
  if (payload?.collections && typeof payload.collections === "object") {
    for (const [id, qs] of Object.entries(payload.collections)) {
      lines.push(`題庫 ${id}：${Array.isArray(qs) ? qs.length : "?"} 題`);
    }
  }
  return <>{lines.map((l, i) => <p key={i} className="text-xs text-zinc-500">{l}</p>)}</>;
}

export default function ReviewClient({ initialUploads }: { initialUploads: PendingUpload[] }) {
  const [uploads, setUploads] = useState(initialUploads);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const act = async (id: string, action: "approve" | "reject") => {
    setLoadingId(id);
    const res = await fetch(`/api/admin/review/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note: noteMap[id] || undefined }),
    });
    const j = await res.json();
    if (res.ok) {
      setUploads(prev => prev.map(u => u.id === id ? { ...u, status: j.status, review_note: noteMap[id] || null } : u));
    } else {
      alert(j.error ?? "操作失敗");
    }
    setLoadingId(null);
  };

  const visible = uploads.filter(u => filter === "all" || u.status === filter);

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto" style={{ color: "var(--zen-ink)" }}>
      <h1 className="text-2xl font-bold mb-6">上傳審核</h1>

      {/* filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-200 dark:border-zinc-700">
        {(["pending", "approved", "rejected", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              filter === f ? "border-current" : "border-transparent text-zinc-400 hover:text-zinc-600"
            }`}
            style={filter === f ? { color: "var(--zen-ink)" } : {}}
          >
            {f === "all" ? "全部" : STATUS_LABEL[f]}
            <span className="ml-1.5 text-xs text-zinc-400">
              {uploads.filter(u => f === "all" || u.status === f).length}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-zinc-400 text-center py-16">沒有資料</p>
      )}

      <ul className="flex flex-col gap-4">
        {visible.map(u => {
          const isExpanded = expandedId === u.id;
          const isPending = u.status === "pending";
          return (
            <li key={u.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700">
              <div className="p-4">
                {/* header row */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.submitter_name ?? "（未知）"}</p>
                    <p className="text-xs text-zinc-400 truncate">{u.submitter_email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-medium ${STATUS_COLOR[u.status]}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {new Date(u.created_at).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>

                {/* payload summary */}
                <PayloadSummary payload={u.payload} />

                {u.review_note && (
                  <p className="mt-2 text-xs text-zinc-400">備註：{u.review_note}</p>
                )}

                {/* actions */}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : u.id)}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    {isExpanded ? "收起" : "查看 JSON"}
                  </button>
                  {isPending && (
                    <>
                      <button
                        onClick={() => act(u.id, "approve")}
                        disabled={loadingId === u.id}
                        className="text-xs px-3 py-1.5 rounded-full border border-green-400 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 transition-colors"
                      >
                        {loadingId === u.id ? "處理中..." : "核准"}
                      </button>
                      <button
                        onClick={() => act(u.id, "reject")}
                        disabled={loadingId === u.id}
                        className="text-xs px-3 py-1.5 rounded-full border border-red-400 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                      >
                        拒絕
                      </button>
                      <input
                        value={noteMap[u.id] ?? ""}
                        onChange={e => setNoteMap(prev => ({ ...prev, [u.id]: e.target.value }))}
                        placeholder="備註（選填）"
                        className="flex-1 min-w-32 px-3 py-1.5 text-xs rounded-full border border-zinc-300 dark:border-zinc-600 outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* expanded JSON */}
              {isExpanded && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 p-4">
                  <pre className="text-xs font-mono text-zinc-500 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(u.payload, null, 2)}
                  </pre>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
