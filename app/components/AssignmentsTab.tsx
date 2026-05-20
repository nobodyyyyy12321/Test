"use client";

import React, { useEffect, useState } from "react";
import { useExcelSelection } from "../lib/useExcelSelection";

type Assignment = {
  id: string;
  assignerId: string;
  assigneeId: string;
  title: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  answers: Array<{ n: number; u: string | string[] | null }> | null;
  submittedAt: string | null;
  score: number | null;
  total: number | null;
  gradedAt: string | null;
};

type Props = {
  variant: "outbox" | "inbox";
  isOwner: boolean;
  t: (key: string) => string;
  dateLocale: string;
};

export default function AssignmentsTab({ variant, isOwner, t, dateLocale }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<Record<string, { name: string; avatarUrl?: string }>>({});

  useEffect(() => {
    if (!isOwner) return;
    setLoading(true);
    setAssignments([]);
    setUsers({});
    fetch(`/api/assignments?scope=${variant}`)
      .then(r => r.json())
      .then(data => {
        const list = (data.assignments ?? []) as Assignment[];
        setAssignments(list);

        const userIds = new Set<string>();
        for (const a of list) {
          userIds.add(variant === "outbox" ? a.assigneeId : a.assignerId);
        }
        if (userIds.size > 0) {
          Promise.all(
            [...userIds].map(async uid => {
              const r = await fetch(`/api/user/profile?id=${encodeURIComponent(uid)}`);
              const d = await r.json();
              return { uid, name: d.user?.name ?? uid, avatarUrl: d.user?.avatarUrl };
            })
          ).then(results => {
            const map: Record<string, { name: string; avatarUrl?: string }> = {};
            for (const r of results) map[r.uid] = { name: r.name, avatarUrl: r.avatarUrl };
            setUsers(map);
          });
        }

        setLoaded(true);
      }).finally(() => setLoading(false));
  }, [isOwner, variant]);

  const sel = useExcelSelection({ resetKey: `${variant}|${assignments.length}` });

  const now = Date.now();

  const renderStatus = (a: Assignment): { text: string; color?: string } => {
    const start = new Date(a.startAt).getTime();
    const end = new Date(a.endAt).getTime();

    if (now < start) return { text: "尚未開始" };
    if (now > end) {
      if (!a.submittedAt) return { text: "已逾期", color: "#ef4444" };
      if (a.gradedAt) return { text: `${a.score}/${a.total}`, color: "#5fa870" };
      return { text: "等待批改" };
    }
    if (a.submittedAt) return { text: "已提交", color: "#5fa870" };
    return { text: "作答中", color: "#b19739" };
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  const exportCsv = () => {
    const rows = sel.getSelectionAsTable();
    if (!rows || rows.length === 0) return;
    const escape = (s: string) => /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    const csv = rows.map(r => r.map(escape).join(",")).join("\r\n");
    // UTF-8 BOM so Excel renders Chinese correctly
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    a.download = `assignments-${variant}-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {loading && <p className="text-sm zen-subtle">載入中...</p>}
      {!loading && loaded && assignments.length === 0 && (
        <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>
          {variant === "outbox" ? "尚無指派記錄" : "尚無指派"}
        </p>
      )}
      {!loading && loaded && assignments.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            data-keep-selection="true"
            onMouseDown={e => e.stopPropagation()}
            onClick={exportCsv}
            disabled={!sel.hasSelection}
            className="text-xs px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 25%, transparent)", color: "var(--zen-ink)" }}
            title={sel.hasSelection ? "輸出選取範圍" : "請先框選表格範圍"}
          >
            輸出成CSV
          </button>
        </div>
      )}
      {!loading && loaded && assignments.length > 0 && (
        <div className="overflow-x-auto">
          <table
            ref={sel.tableRef}
            onMouseDown={sel.onMouseDown}
            onMouseOver={sel.onMouseOver}
            className="w-full text-sm border-collapse border border-zinc-200 dark:border-zinc-700 select-none"
            style={{ color: "var(--zen-ink)" }}
          >
            <thead>
              <tr className="text-left text-xs opacity-50 divide-x divide-zinc-200 dark:divide-zinc-700">
                <th data-row={0} data-col={0} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,0)}`}>標題</th>
                <th data-row={0} data-col={1} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,1)}`}>
                  {variant === "outbox" ? "對象" : "指派者"}
                </th>
                <th data-row={0} data-col={2} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,2)}`}>開始</th>
                <th data-row={0} data-col={3} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,3)}`}>結束</th>
                <th data-row={0} data-col={4} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,4)}`}>狀態</th>
                {variant === "inbox" && (
                  <th data-row={0} data-col={5} className={`px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 font-normal whitespace-nowrap ${sel.cellBg(0,5)}`}>操作</th>
                )}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a, index) => {
                const isReviewable = a.gradedAt !== null;
                const reviewUrl = `/test/assignment/${encodeURIComponent(a.id)}?review=1`;
                const peerName = users[variant === "outbox" ? a.assigneeId : a.assignerId]?.name
                  ?? (variant === "outbox" ? "對象" : "指派者");
                const status = renderStatus(a);
                const canAnswer = variant === "inbox"
                  && a.submittedAt === null
                  && now >= new Date(a.startAt).getTime()
                  && now <= new Date(a.endAt).getTime();
                const rowClass = "border-b border-zinc-100 dark:border-zinc-800 divide-x divide-zinc-200 dark:divide-zinc-700";
                const r = index + 1;
                return (
                  <tr key={a.id} className={rowClass}>
                    <td data-row={r} data-col={0} className={`px-3 py-2 whitespace-nowrap ${sel.cellBg(r,0)}`}>
                      {isReviewable ? (
                        <a href={reviewUrl} className="hover:underline">{a.title}</a>
                      ) : a.title}
                    </td>
                    <td data-row={r} data-col={1} className={`px-3 py-2 whitespace-nowrap ${sel.cellBg(r,1)}`}>{peerName}</td>
                    <td data-row={r} data-col={2} className={`px-3 py-2 text-xs opacity-60 whitespace-nowrap ${sel.cellBg(r,2)}`}>{formatDate(a.startAt)}</td>
                    <td data-row={r} data-col={3} className={`px-3 py-2 text-xs opacity-60 whitespace-nowrap ${sel.cellBg(r,3)}`}>{formatDate(a.endAt)}</td>
                    <td data-row={r} data-col={4} className={`px-3 py-2 text-xs whitespace-nowrap ${sel.cellBg(r,4)}`}>
                      <span style={status.color ? { color: status.color } : { opacity: 0.5, color: "var(--zen-ink)" }}>
                        {status.text}
                      </span>
                    </td>
                    {variant === "inbox" && (
                      <td data-row={r} data-col={5} data-copy-text="" className={`px-3 py-2 whitespace-nowrap ${sel.cellBg(r,5)}`}>
                        {canAnswer && (
                          <a
                            href={`/test/assignment/${encodeURIComponent(a.id)}`}
                            className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80"
                            style={{ borderColor: "#b19739", color: "#b19739" }}
                          >
                            作答
                          </a>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
