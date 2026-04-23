"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import type { QuestionList, ListQuestion } from "../../lib/lists-firebase";
import zhTW from "../../public/locale/zh-TW.js";
import type { CategoryNode } from "../components/CategoryNode";

// ── locale helpers ────────────────────────────────────────────────────────────

type LevelEntry = { name: string; levels: number[] };
const SIMPLE_LABELS: Record<string, string> = {};
const LEVEL_LABELS: Record<string, LevelEntry[]> = {};

(function buildLabels() {
  const nodes = zhTW as CategoryNode[];
  function parseHref(href: string) {
    const m = href.match(/^\/test\/([^?]+)(?:\?levels=(.+))?/);
    if (!m) return null;
    return { id: m[1], levels: m[2] ? m[2].split(",").map(Number) : [] };
  }
  for (const node of nodes) {
    if (node.href) {
      const p = parseHref(node.href);
      if (p && !SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
    }
    if (node.children) {
      for (const child of node.children) {
        if (!child.href) continue;
        const p = parseHref(child.href);
        if (!p) continue;
        if (p.levels.length > 0) {
          (LEVEL_LABELS[p.id] = LEVEL_LABELS[p.id] ?? []).push({ name: child.name, levels: p.levels });
          if (!SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
        } else if (!SIMPLE_LABELS[p.id]) {
          SIMPLE_LABELS[p.id] = child.name;
        }
      }
    }
  }
})();

function getCollectionLabel(collectionId: string, level?: number | null): string {
  if (level != null && LEVEL_LABELS[collectionId]) {
    const match = LEVEL_LABELS[collectionId].find(e => e.levels.includes(level));
    if (match) return match.name;
  }
  return SIMPLE_LABELS[collectionId] ?? collectionId;
}

// ── types ─────────────────────────────────────────────────────────────────────

type Tab = "profile" | "lists" | "record" | "followers" | "following";

type FollowUser = { id: string; name: string; avatarUrl?: string };

type SocialLinks = { x?: string; facebook?: string; instagram?: string; website?: string };

type QuizRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category?: string;
  success?: boolean;
};

const ENGLISH_SET_NAMES: Record<string, string> = {
  "englishWords:1,2": "2000單",
  "englishWords:3,4": "4000單",
  "englishWords:5,6": "6000單",
  englishWords: "英文",
  quoteChinese: "名言佳句",
};

export type InitialProfile = {
  id: string;
  name: string;
  email?: string;        // always passed from server (used for client isOwner check)
  emailPublic?: boolean;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: Record<string, string | undefined>;
  records?: QuizRecord[];
};

type Props = {
  urlName: string;
  isOwner: boolean;
  initialProfile: InitialProfile;
};

// ── main component ────────────────────────────────────────────────────────────

export default function ProfileClient({ urlName, isOwner: initialIsOwner, initialProfile }: Props) {
  const { data: session, status } = useSession();

  const [isOwner, setIsOwner] = useState(initialIsOwner);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // ── profile state ──
  const [name, setName] = useState(initialProfile.name || "");
  const [email] = useState(initialProfile.email || "");
  const [emailPublic, setEmailPublic] = useState(Boolean(initialProfile.emailPublic));
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>((initialProfile.socialLinks as SocialLinks) || {});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── lists state ──
  const [listsLoaded, setListsLoaded] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [sharedLists, setSharedLists] = useState<QuestionList[]>([]);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // ── record state ──
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [quizRecords, setQuizRecords] = useState<QuizRecord[]>(initialProfile.records || []);

  // ── follow state ──
  const [followersLoaded, setFollowersLoaded] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [following, setFollowing] = useState<FollowUser[]>([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // client-side isOwner upgrade: only set true, never false
  // compares session name OR email against the profile being viewed
  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) return;
    const nameMatch = (session.user as any).name === urlName;
    const emailMatch = initialProfile.email && (session.user as any).email === initialProfile.email;
    if (nameMatch || emailMatch) setIsOwner(true);
  }, [status, session, urlName, initialProfile.email]);

  // ── load lists when tab activated ─────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "lists" || listsLoaded) return;
    setListsLoading(true);
    if (isOwner) {
      fetch("/api/lists")
        .then(r => r.json())
        .then(d => {
          setLists(d.lists ?? []);
          setSharedLists(d.sharedLists ?? []);
          setListsLoaded(true);
        })
        .finally(() => setListsLoading(false));
    } else {
      fetch(`/api/users/${encodeURIComponent(urlName)}/lists`)
        .then(r => r.json())
        .then(d => { setLists(d.lists ?? []); setListsLoaded(true); })
        .finally(() => setListsLoading(false));
    }
  }, [activeTab, listsLoaded, isOwner, urlName]);

  // ── load records when tab activated ───────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "record" || recordLoaded) return;
    setRecordLoading(true);
    fetch(`/api/user/profile?name=${encodeURIComponent(urlName)}`)
      .then(r => r.json())
      .then(data => { setQuizRecords(data.user?.records || []); setRecordLoaded(true); })
      .finally(() => setRecordLoading(false));
  }, [activeTab, recordLoaded, urlName]);

  // ── load follow counts & isFollowing on mount ─────────────────────────────

  useEffect(() => {
    if (!urlName || !session?.user) return;
    fetch(`/api/users/${encodeURIComponent(urlName)}/follow`)
      .then(r => r.json())
      .then(d => setIsFollowing(Boolean(d.following)))
      .catch(() => {});
  }, [urlName, session]);

  // ── load followers tab ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "followers" || followersLoaded) return;
    setFollowersLoading(true);
    fetch(`/api/users/${encodeURIComponent(urlName)}/followers`)
      .then(r => r.json())
      .then(d => {
        const list = (d.followers ?? []) as Array<{ followerName: string; followerAvatarUrl?: string; followerId: string }>;
        setFollowers(list.map(f => ({ id: f.followerId, name: f.followerName, avatarUrl: f.followerAvatarUrl })));
        setFollowersLoaded(true);
      })
      .finally(() => setFollowersLoading(false));
  }, [activeTab, followersLoaded, urlName]);

  // ── load following tab ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "following" || followingLoaded) return;
    setFollowingLoading(true);
    fetch(`/api/users/${encodeURIComponent(urlName)}/following`)
      .then(r => r.json())
      .then(d => {
        const list = (d.following ?? []) as Array<{ followingName: string; followingAvatarUrl?: string; followingId: string }>;
        setFollowing(list.map(f => ({ id: f.followingId, name: f.followingName, avatarUrl: f.followingAvatarUrl })));
        setFollowingLoaded(true);
      })
      .finally(() => setFollowingLoading(false));
  }, [activeTab, followingLoaded, urlName]);

  // ── menu click-outside ─────────────────────────────────────────────────────

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    if (menuOpenId) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpenId]);

  // ── profile actions ───────────────────────────────────────────────────────

  async function uploadAvatar(file: File) {
    setSaveError(null);
    if (file.size > 15 * 1024 * 1024) { setSaveError("圖片過大，請選擇 15MB 以下檔案"); return; }
    const src = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load failed"));
      i.src = src;
    });
    const max = 512;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    let data = canvas.toDataURL("image/jpeg", 0.82);
    if (data.length > 2.5 * 1024 * 1024) data = canvas.toDataURL("image/jpeg", 0.7);
    const res = await fetch("/api/user/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) {
      setAvatarUrl(j.url);
      window.dispatchEvent(new Event("profile:updated"));
    } else {
      setSaveError(j?.error || "頭像上傳失敗");
    }
  }

  async function saveProfile() {
    setSaving(true); setSaveError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio, avatarUrl, socialLinks, emailPublic }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveError(j?.error || "儲存失敗"); return; }
    setEditing(false);
    window.dispatchEvent(new Event("profile:updated"));
  }

  function makeSocialHref(platform: string, value?: string) {
    if (!value) return null;
    const v = value.trim();
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    const clean = v.replace(/^@+/, "");
    switch (platform) {
      case "facebook": return `https://facebook.com/${clean}`;
      case "instagram": return `https://instagram.com/${clean}`;
      case "x": return `https://x.com/${clean}`;
      case "website": return `https://${clean}`;
      default: return null;
    }
  }

  // ── lists actions ─────────────────────────────────────────────────────────

  const togglePublic = async (list: QuestionList) => {
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, isPublic: !l.isPublic } : l));
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !list.isPublic }),
    });
  };

  const saveListEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setLists(prev => prev.map(l => l.id === id ? { ...l, title: editTitle.trim() } : l));
    setEditingListId(null);
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
  };

  const deleteList = async (id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (expandedId === id) setExpandedId(null);
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
  };

  const removeQuestion = async (listId: string, questionId: string, collectionId: string) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? { ...l, questions: l.questions.filter((q: ListQuestion) => !(q.questionId === questionId && q.collectionId === collectionId)) }
        : l
    ));
    await fetch(`/api/lists/${listId}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, collectionId }),
    });
  };

  const addShare = async (listId: string) => {
    const target = shareInput.trim();
    if (!target) return;
    setShareLoading(true);
    setShareError(null);
    const res = await fetch(`/api/lists/${listId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName: target }),
    });
    const j = await res.json();
    if (!res.ok) {
      setShareError(j.error ?? "失敗");
    } else {
      setLists(prev => prev.map(l =>
        l.id === listId ? { ...l, sharedWith: [...(l.sharedWith ?? []), target] } : l
      ));
      setShareInput("");
    }
    setShareLoading(false);
  };

  const removeShare = async (listId: string, targetName: string) => {
    await fetch(`/api/lists/${listId}/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName }),
    });
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, sharedWith: (l.sharedWith ?? []).filter(n => n !== targetName) } : l
    ));
  };

  // ── follow action ─────────────────────────────────────────────────────────

  const toggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const method = isFollowing ? "DELETE" : "POST";
    await fetch(`/api/users/${encodeURIComponent(urlName)}/follow`, { method });
    setIsFollowing(f => !f);
    setFollowersLoaded(false);
    setFollowLoading(false);
  };

  // ── tabs config ───────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; ownerOnly?: boolean }[] = [
    { id: "profile", label: "個人檔案" },
    { id: "lists", label: "個人試卷" },
    { id: "record", label: "紀錄", ownerOnly: true },
    { id: "followers", label: "追蹤者" },
    { id: "following", label: "追蹤中" },
  ];
  const visibleTabs = tabs.filter(t => !t.ownerOnly || isOwner);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent dark:bg-black">
      <main className="w-full max-w-2xl px-6 pt-10 pb-36 sm:pb-10">

        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <img
              src={avatarUrl || "/avatar-placeholder.svg"}
              alt="avatar"
              className="w-14 h-14 rounded-full object-cover"
            />
            <h1 className="text-2xl font-bold zen-title">{urlName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {!isOwner && session?.user && (
              <button
                onClick={toggleFollow}
                disabled={followLoading}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                style={isFollowing
                  ? { borderColor: "#5fa870", color: "#5fa870", background: "transparent" }
                  : { borderColor: "#5fa870", color: "white", background: "#5fa870" }
                }
              >
                {isFollowing ? "已追蹤" : "追蹤"}
              </button>
            )}
          </div>
        </div>

        {/* tab bar */}
        <div className="flex gap-1 mb-8 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTab(t.id); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? "border-current"
                  : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              }`}
              style={activeTab === t.id ? { color: "var(--zen-ink)" } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── profile tab ─────────────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <div>
            <div className="flex flex-col gap-4">
              {/* avatar (large, editing mode) */}
              {editing && (
                <div className="flex items-center gap-4">
                  <img src={avatarUrl || "/avatar-placeholder.svg"} alt="avatar" className="w-24 h-24 rounded-md object-cover" />
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                    <button type="button"
                      className="px-4 py-2 border rounded-full border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      style={{ color: "var(--zen-ink)" }}
                      onClick={() => fileInputRef.current?.click()}>
                      更換頭像
                    </button>
                  </div>
                </div>
              )}

              {/* name */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">顯示名稱</label>
                {editing
                  ? <input className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none"
                      style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      value={name} onChange={e => setName(e.target.value)} />
                  : <p className="text-sm" style={{ color: "var(--zen-ink)" }}>{name || <span className="text-zinc-400">未設定</span>}</p>
                }
              </div>

              {/* email */}
              {(isOwner || emailPublic) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Email</label>
                  <p className="text-sm" style={{ color: "var(--zen-ink)" }}>{email || <span className="text-zinc-400">未設定</span>}</p>
                  {isOwner && editing && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={emailPublic}
                        onChange={e => setEmailPublic(e.target.checked)}
                        className="w-4 h-4" />
                      <span className="text-xs text-zinc-400">公開電子郵件</span>
                    </label>
                  )}
                </div>
              )}

              {/* bio */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">自我介紹</label>
                {editing
                  ? <textarea className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none resize-none"
                      style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      rows={4} value={bio} onChange={e => setBio(e.target.value)} />
                  : <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--zen-ink)" }}>{bio || <span className="text-zinc-400">尚未設定</span>}</p>
                }
              </div>

              {/* social links */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">社群連結</label>
                {editing ? (
                  <div className="flex flex-col gap-2">
                    {(["facebook", "instagram", "x", "website"] as const).map(p => (
                      <input key={p}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                        placeholder={p === "x" ? "X (Twitter)" : p.charAt(0).toUpperCase() + p.slice(1)}
                        value={(socialLinks as any)[p] || ""}
                        onChange={e => setSocialLinks({ ...socialLinks, [p]: e.target.value })} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {(["facebook", "instagram", "x", "website"] as const).map(p => {
                      const val = (socialLinks as any)[p];
                      if (!val) return null;
                      const href = makeSocialHref(p, val);
                      return (
                        <a key={p} href={href || undefined} target="_blank" rel="noreferrer"
                          className="text-sm text-accent hover:underline">
                          {p === "website" ? val : `${p}: ${val}`}
                        </a>
                      );
                    })}
                    {!Object.values(socialLinks).some(Boolean) && <span className="text-sm text-zinc-400">尚未設定</span>}
                  </div>
                )}
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              {/* edit / save buttons */}
              {isOwner && (
                <div className="flex gap-2 mt-2">
                  {!editing
                    ? <button onClick={() => setEditing(true)}
                        className="px-4 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        style={{ color: "var(--zen-ink)" }}>
                        編輯
                      </button>
                    : <>
                        <button onClick={saveProfile} disabled={saving}
                          className="px-4 py-2 text-sm rounded-full bg-white text-black border hover:opacity-90 transition-opacity disabled:opacity-50">
                          {saving ? "儲存中..." : "儲存"}
                        </button>
                        <button onClick={() => setEditing(false)}
                          className="px-4 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}>
                          取消
                        </button>
                      </>
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── lists tab ───────────────────────────────────────────────────── */}
        {activeTab === "lists" && (
          <div>
            {listsLoading ? (
              <p className="text-sm zen-subtle">載入中...</p>
            ) : lists.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">
                {isOwner ? "尚無試卷，在題目頁按 + 新增" : "尚無公開試卷"}
              </p>
            ) : (
              <ul className="space-y-3">
                {lists.map(list => (
                  <li key={list.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3 p-4">
                      <button type="button" className="flex-1 min-w-0 text-left"
                        onClick={() => setExpandedId(expandedId === list.id ? null : list.id)}>
                        {isOwner && editingListId === list.id ? (
                          <input autoFocus value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            onBlur={() => saveListEdit(list.id)}
                            onKeyDown={e => { if (e.key === "Enter") saveListEdit(list.id); if (e.key === "Escape") setEditingListId(null); }}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-2 py-0.5 text-sm rounded border border-zinc-300 dark:border-zinc-600 outline-none"
                            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }} />
                        ) : (
                          <span className="font-medium" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
                        )}
                        <p className="text-xs text-zinc-400 mt-0.5">{list.questions.length} 題</p>
                      </button>

                      {list.questions.length > 0 && (
                        <a href={`/test/list?listId=${list.id}`}
                          className="text-xs px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}>
                          作答
                        </a>
                      )}

                      {isOwner && (
                        <div className="relative" ref={menuOpenId === list.id ? menuRef : null}>
                          <button type="button"
                            onClick={() => setMenuOpenId(menuOpenId === list.id ? null : list.id)}
                            className="flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-400"
                            style={{ width: "1.75rem", height: "1.75rem", minWidth: "1.75rem" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          </button>
                          {menuOpenId === list.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                              <button type="button"
                                onClick={() => { togglePublic(list); setMenuOpenId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                style={{ color: "var(--zen-ink)" }}>
                                設為{list.isPublic ? "私人" : "公開"}
                              </button>
                              <button type="button"
                                onClick={() => { setEditingListId(list.id); setEditTitle(list.title); setMenuOpenId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                style={{ color: "var(--zen-ink)" }}>
                                改名
                              </button>
                              <button type="button"
                                onClick={() => { setShareOpenId(shareOpenId === list.id ? null : list.id); setShareInput(""); setShareError(null); setMenuOpenId(null); }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                style={{ color: "var(--zen-ink)" }}>
                                分享
                              </button>
                              <button type="button"
                                onClick={() => { deleteList(list.id); setMenuOpenId(null); }}
                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                刪除
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`shrink-0 text-zinc-400 transition-transform ${expandedId === list.id ? "rotate-180" : ""}`}>
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>

                    {/* share panel */}
                    {isOwner && shareOpenId === list.id && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 py-3">
                        <p className="text-xs text-zinc-400 mb-2">分享給帳號</p>
                        <div className="flex gap-2 mb-2">
                          <input
                            value={shareInput}
                            onChange={e => { setShareInput(e.target.value); setShareError(null); }}
                            onKeyDown={e => { if (e.key === "Enter") addShare(list.id); }}
                            placeholder="輸入帳號名稱"
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 outline-none"
                            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                          />
                          <button type="button"
                            onClick={() => addShare(list.id)}
                            disabled={shareLoading || !shareInput.trim()}
                            className="px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                            style={{ color: "var(--zen-ink)" }}>
                            新增
                          </button>
                        </div>
                        {shareError && <p className="text-xs text-red-500 mb-2">{shareError}</p>}
                        {(list.sharedWith ?? []).length > 0 && (
                          <ul className="flex flex-col gap-2">
                            {(list.sharedWith ?? []).map(n => {
                              const results = (list.sharedResults ?? {})[n] ?? [];
                              return (
                                <li key={n} className="text-xs" style={{ color: "var(--zen-ink)" }}>
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium">{n}</span>
                                    <button type="button" onClick={() => removeShare(list.id, n)}
                                      className="text-red-400 hover:text-red-500 transition-colors">移除</button>
                                  </div>
                                  {results.length > 0 ? (
                                    <ul className="mt-1 flex flex-col gap-0.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                                      {results.map((r: any, i: number) => (
                                        <li key={i} className="flex items-center gap-2 text-zinc-400">
                                          <span>{r.correct}/{r.answered}</span>
                                          <span>{new Date(r.timestamp).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <p className="mt-0.5 pl-2 text-zinc-400">尚未作答</p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    )}

                    {expandedId === list.id && (
                      <div className="border-t border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-b-xl">
                        {list.questions.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-zinc-400">清單是空的</p>
                        ) : (
                          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {list.questions.map((q: ListQuestion, i: number) => (
                              <li key={`${q.questionId}-${i}`} className="flex items-center gap-3 px-4 py-2">
                                <span className="text-xs text-zinc-400 w-6 shrink-0 text-right">{q.number}</span>
                                <span className="flex-1 text-sm" style={{ color: "var(--zen-ink)" }}>{q.title}</span>
                                <span className="text-xs text-zinc-400">{getCollectionLabel(q.collectionId, q.level)}</span>
                                {isOwner && (
                                  <button type="button"
                                    onClick={() => removeQuestion(list.id, q.questionId, q.collectionId)}
                                    className="text-xs text-red-400 hover:text-red-500 transition-colors">
                                    移除
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* shared-with-me lists */}
            {isOwner && sharedLists.length > 0 && (
              <div className="mt-8">
                <p className="text-xs text-zinc-400 mb-3">分享給我的試卷</p>
                <ul className="space-y-3">
                  {sharedLists.map(list => (
                    <li key={list.id} className="rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center gap-3 p-4">
                        <button type="button" className="flex-1 min-w-0 text-left"
                          onClick={() => setExpandedId(expandedId === list.id ? null : list.id)}>
                          <span className="font-medium" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
                          <p className="text-xs text-zinc-400 mt-0.5">{list.ownerName} · {list.questions.length} 題</p>
                        </button>
                        {list.questions.length > 0 && (
                          <a href={`/test/list?listId=${list.id}`}
                            className="text-xs px-2 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                            style={{ color: "var(--zen-ink)" }}>
                            作答
                          </a>
                        )}
                        <div className="relative" ref={menuOpenId === list.id ? menuRef : null}>
                          <button type="button"
                            onClick={() => setMenuOpenId(menuOpenId === list.id ? null : list.id)}
                            className="flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-zinc-400"
                            style={{ width: "1.75rem", height: "1.75rem", minWidth: "1.75rem" }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            </svg>
                          </button>
                          {menuOpenId === list.id && (
                            <div className="absolute right-0 top-full mt-1 z-30 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                              <button type="button"
                                onClick={async () => {
                                  setMenuOpenId(null);
                                  const res = await fetch(`/api/lists/${list.id}/copy`, { method: "POST" });
                                  if (res.ok) {
                                    const d = await res.json();
                                    setLists(prev => [d.list, ...prev]);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                style={{ color: "var(--zen-ink)" }}>
                                複製
                              </button>
                              <button type="button"
                                onClick={async () => {
                                  setMenuOpenId(null);
                                  const res = await fetch(`/api/lists/${list.id}/unsubscribe`, { method: "DELETE" });
                                  if (res.ok) setSharedLists(prev => prev.filter(l => l.id !== list.id));
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                刪除
                              </button>
                            </div>
                          )}
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                          className={`shrink-0 text-zinc-400 transition-transform ${expandedId === list.id ? "rotate-180" : ""}`}>
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </div>
                      {expandedId === list.id && list.questions.length > 0 && (
                        <div className="border-t border-zinc-100 dark:border-zinc-800 overflow-hidden rounded-b-xl">
                          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {list.questions.map((q: ListQuestion, i: number) => (
                              <li key={`${q.questionId}-${i}`} className="flex items-center gap-3 px-4 py-2">
                                <span className="text-xs text-zinc-400 w-6 shrink-0 text-right">{q.number}</span>
                                <span className="flex-1 text-sm" style={{ color: "var(--zen-ink)" }}>{q.title}</span>
                                <span className="text-xs text-zinc-400">{getCollectionLabel(q.collectionId, q.level)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── record tab ──────────────────────────────────────────────────── */}
        {activeTab === "record" && (
          <div>
            <p className="text-xs text-zinc-400 mb-4">保留最近十筆測驗紀錄</p>
            {recordLoading ? (
              <p className="text-sm zen-subtle">載入中...</p>
            ) : quizRecords.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">尚無紀錄</p>
            ) : (
              <div className="space-y-3">
                {[...quizRecords]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .slice(-10).reverse()
                  .map((item, index) => (
                    <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--zen-ink)" }}>
                            {ENGLISH_SET_NAMES[item.set] ?? item.set}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-600" style={{ color: "var(--zen-ink)" }}>
                            {item.category === "詩文背誦"
                              ? (item.success ? "✓ 成功" : "✗ 失敗")
                              : `${item.correct}/${item.answered}`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {new Date(item.timestamp).toLocaleDateString("zh-TW", {
                            year: "numeric", month: "2-digit", day: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ── followers tab ───────────────────────────────────────────────── */}
        {activeTab === "followers" && (
          <div>
            {followersLoading ? (
              <p className="text-sm zen-subtle">載入中...</p>
            ) : followers.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">尚無追蹤者</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {followers.map(u => (
                  <li key={u.id}>
                    <a href={`/${encodeURIComponent(u.name)}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <img src={u.avatarUrl || "/avatar-placeholder.svg"} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── following tab ───────────────────────────────────────────────── */}
        {activeTab === "following" && (
          <div>
            {followingLoading ? (
              <p className="text-sm zen-subtle">載入中...</p>
            ) : following.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">尚無追蹤中的使用者</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {following.map(u => (
                  <li key={u.id}>
                    <a href={`/${encodeURIComponent(u.name)}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <img src={u.avatarUrl || "/avatar-placeholder.svg"} alt={u.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
