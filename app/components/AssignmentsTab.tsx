"use client";

import React, { useEffect, useState } from "react";
import NextImage from "next/image";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";

type Assignment = {
  id: string;
  assignerId: string;
  assigneeId: string;
  title: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  answers: Record<string, unknown> | null;
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
  const [inboxSubTab, setInboxSubTab] = useState<"pending" | "submitted">("pending");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [users, setUsers] = useState<Record<string, { name: string; avatarUrl?: string }>>({});

  useEffect(() => {
    if (!isOwner || loaded) return;
    setLoading(true);
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
  }, [isOwner, loaded, variant]);

  const filtered = variant === "outbox"
    ? assignments
    : inboxSubTab === "pending"
      ? assignments.filter(a => !a.submittedAt && new Date(a.endAt).getTime() >= Date.now())
      : assignments.filter(a => a.submittedAt);

  const now = Date.now();

  const renderStatus = (a: Assignment) => {
    const start = new Date(a.startAt).getTime();
    const end = new Date(a.endAt).getTime();

    if (now < start) return <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>尚未開始</span>;
    if (now > end) {
      if (!a.submittedAt) return <span className="text-xs" style={{ color: "#ef4444" }}>已逾期</span>;
      if (a.gradedAt) return <span className="text-xs" style={{ color: "#5fa870" }}>{a.score}/{a.total}</span>;
      return <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>等待批改</span>;
    }
    if (a.submittedAt) return <span className="text-xs" style={{ color: "#5fa870" }}>已提交</span>;
    return <span className="text-xs" style={{ color: "#b19739" }}>作答中</span>;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      {/* inbox sub-tabs */}
      {variant === "inbox" && (
        <div className="flex gap-3 mb-1">
          <button
            onClick={() => setInboxSubTab("pending")}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              inboxSubTab === "pending" ? "border-current" : "border-transparent hover:opacity-70"
            }`}
            style={{ color: "#D1D5DB", opacity: inboxSubTab === "pending" ? 1 : 0.45 }}
          >
            {t("assignInboxPending")}
          </button>
          <button
            onClick={() => setInboxSubTab("submitted")}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              inboxSubTab === "submitted" ? "border-current" : "border-transparent hover:opacity-70"
            }`}
            style={{ color: "#D1D5DB", opacity: inboxSubTab === "submitted" ? 1 : 0.45 }}
          >
            {t("assignInboxSubmitted")}
          </button>
        </div>
      )}

      {/* list */}
      {loading && <p className="text-sm zen-subtle">載入中...</p>}
      {!loading && loaded && filtered.length === 0 && (
        <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>
          {variant === "outbox" ? "尚無指派記錄" : inboxSubTab === "pending" ? "尚無待繳交的指派" : "尚無已繳交的指派"}
        </p>
      )}
      {filtered.map(a => (
        <div
          key={a.id}
          className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
          style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <NextImage
              src={(users[variant === "outbox" ? a.assigneeId : a.assignerId]?.avatarUrl) || AVATAR_PLACEHOLDER}
              alt={users[variant === "outbox" ? a.assigneeId : a.assignerId]?.name ?? ""}
              width={32} height={32} unoptimized
              className="w-8 h-8 rounded-full object-cover shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate" style={{ color: "var(--zen-ink)" }}>
                {users[variant === "outbox" ? a.assigneeId : a.assignerId]?.name ?? (variant === "outbox" ? "對象" : "指派者")}
              </span>
              <span className="text-xs opacity-50 truncate" style={{ color: "var(--zen-ink)" }}>
                {a.title}
              </span>
              <span className="text-xs opacity-30" style={{ color: "var(--zen-ink)" }}>
                {formatDate(a.startAt)} ~ {formatDate(a.endAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderStatus(a)}
            {variant === "inbox" && a.submittedAt === null && now >= new Date(a.startAt).getTime() && now <= new Date(a.endAt).getTime() && (
              <a
                href={`/test/assignment/${encodeURIComponent(a.id)}`}
                className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80"
                style={{ borderColor: "#b19739", color: "#b19739" }}
              >
                作答
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
