"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";
import LanguageSelector from "./LanguageSelector";
import type { CategoryNode } from "./CategoryNode";

type UserResult = { id: string; name: string; avatarUrl?: string };
type CtxMenu = { id: string; name: string; x: number; y: number; from: "pinned" | "grid" };
type Group = { id: string; name: string };
type ShareTarget = { type: "user" | "group"; id: string; name: string; avatarUrl?: string; memberCount?: number };

export function HomeContent({ initialCategories }: { initialCategories: CategoryNode[] }) {
  const [language, setLanguage] = useState("zh-TW");
  const [categories, setCategories] = useState<CategoryNode[]>(initialCategories ?? []);
  const [loadingLang, setLoadingLang] = useState(false);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [openPinnedKey, setOpenPinnedKey] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [sharePanel, setSharePanel] = useState<{ categoryKey: string; categoryName: string } | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<ShareTarget[]>([]);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const [shareGroups, setShareGroups] = useState<Group[]>([]);
  const [shareSharedIds, setShareSharedIds] = useState<Set<string>>(new Set());
  const [shareSending, setSharingSending] = useState<string | null>(null);
  const shareDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subjects = useFilteredCategories(categories, query);

  const colors = ["#b19739", "#5fa870"];

  const findSubject = (name: string): { node: CategoryNode; color: string } | null => {
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      if (s.name === name) return { node: s, color: colors[i % colors.length] };
      const child = s.children?.find(c => c.name === name);
      if (child) return { node: child, color: colors[i % colors.length] };
    }
    return null;
  };

  useEffect(() => {
    try {
      const stored = localStorage.getItem("pinnedCats");
      if (stored) setPinnedNames(JSON.parse(stored));
    } catch {}
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = (matches: boolean) => {
      if (matches) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
    apply(mq.matches);
    mq.addEventListener("change", e => apply(e.matches));
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      mq.removeEventListener("change", e => apply(e.matches));
    };
  }, []);

  const pin = (name: string) => {
    setPinnedNames(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      localStorage.setItem("pinnedCats", JSON.stringify(next));
      return next;
    });
  };

  const unpin = (name: string) => {
    setPinnedNames(prev => {
      const next = prev.filter(n => n !== name);
      localStorage.setItem("pinnedCats", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ctxMenu]);

  useEffect(() => {
    if (!sharePanel || !loggedIn) return;
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => {
        const owned: Group[] = (d.owned ?? []).map((g: Record<string, unknown>) => ({ id: g.id as string, name: g.name as string }));
        const joined: Group[] = (d.joined ?? []).map((g: Record<string, unknown>) => ({ id: g.id as string, name: g.name as string }));
        setShareGroups([...owned, ...joined]);
      })
      .catch(() => {});
  }, [sharePanel, loggedIn]);

  useEffect(() => {
    if (shareDebounce.current) clearTimeout(shareDebounce.current);
    if (!shareInput.trim()) { setShareSearchResults([]); setShareSearchLoading(false); return; }
    setShareSearchLoading(true);
    shareDebounce.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(shareInput.trim())}`)
        .then(r => r.json())
        .then(d => setShareSearchResults((d.users ?? []).map((u: Record<string, unknown>) => ({ type: "user" as const, id: u.id as string, name: u.name as string, avatarUrl: u.avatarUrl as string | undefined }))))
        .catch(() => setShareSearchResults([]))
        .finally(() => setShareSearchLoading(false));
    }, 300);
    return () => { if (shareDebounce.current) clearTimeout(shareDebounce.current); };
  }, [shareInput]);

  useEffect(() => {
    const sync = () => {
      const lang = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(lang);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("site-language-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("site-language-change", sync);
    };
  }, []);

  useEffect(() => {
    setOpenKey(null);
    setOpenDropKey(null);
    setOpenYearKey(null);
    setQuery("");
    setUserResults([]);

    if (language === "zh-TW") {
      setCategories(initialCategories);
      return;
    }

    setLoadingLang(true);
    fetch(`/api/nav-categories?lang=${encodeURIComponent(language)}`)
      .then(r => r.json())
      .then(d => setCategories(d.data ?? []))
      .catch(() => setCategories([]))
      .finally(() => setLoadingLang(false));
  }, [language, initialCategories]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setUserResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => setUserResults(d.users ?? []))
        .catch(() => setUserResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const openCtx = (e: React.MouseEvent, id: string, name: string, from: "pinned" | "grid") => {
    e.preventDefault();
    setCtxMenu({ id, name, x: e.clientX, y: e.clientY, from });
  };

  const handleShareTo = async (categoryKey: string, categoryName: string, target: { type: "user" | "group"; id: string; name: string }) => {
    setSharingSending(target.id);
    const body = target.type === "user"
      ? { categoryKey, categoryName, targetUserName: target.name }
      : { categoryKey, categoryName, groupId: target.id };
    await fetch("/api/categories/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setShareSharedIds(prev => new Set(prev).add(target.id));
    setSharingSending(null);
  };

  return (
    <div className="flex min-h-screen items-start justify-start bg-transparent font-sans dark:bg-black">
      {/* context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: "5rem" }}
          >
            {ctxMenu.from === "grid" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { pin(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                釘選
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { unpin(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                取消釘選
              </button>
            )}
            {loggedIn && (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { setSharePanel({ categoryKey: ctxMenu.id, categoryName: ctxMenu.name }); setShareInput(""); setShareSearchResults([]); setShareSharedIds(new Set()); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-t border-zinc-100 dark:border-zinc-800"
                style={{ color: "#5fa870" }}
              >
                分享
              </button>
            )}
          </div>
        </>
      )}

      {/* share panel */}
      {sharePanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSharePanel(null)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 max-h-[70vh] flex flex-col rounded-2xl border shadow-xl"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>分享「{sharePanel.categoryName}」</span>
              <button onClick={() => setSharePanel(null)} className="text-lg opacity-40 hover:opacity-70 leading-none" style={{ color: "var(--zen-ink)" }}>×</button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
              {/* user search */}
              <input
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                placeholder="搜尋帳號名稱"
                value={shareInput}
                onChange={e => setShareInput(e.target.value)}
              />
              {shareSearchLoading && <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>}
              {shareSearchResults.length > 0 && (
                <div className="flex flex-col divide-y rounded-xl overflow-hidden border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)", divideColor: "color-mix(in srgb, var(--zen-ink) 8%, transparent)" }}>
                  {shareSearchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--zen-bg)" }}>
                      <div className="flex items-center gap-2">
                        <Image src={u.avatarUrl || "/avatar-placeholder.svg"} alt={u.name} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                        <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                      </div>
                      {shareSharedIds.has(u.id) ? (
                        <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                      ) : (
                        <button
                          onClick={() => handleShareTo(sharePanel.categoryKey, sharePanel.categoryName, u)}
                          disabled={shareSending === u.id}
                          className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                          style={{ borderColor: "#b19739", color: "#b19739" }}
                        >
                          {shareSending === u.id ? "..." : "分享"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* groups */}
              {shareGroups.length > 0 && (
                <>
                  <p className="text-xs opacity-50 mt-1" style={{ color: "var(--zen-ink)" }}>我的群組</p>
                  <div className="flex flex-col divide-y rounded-xl overflow-hidden border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)" }}>
                    {shareGroups.map(g => (
                      <div key={g.id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--zen-bg)" }}>
                        <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{g.name}</span>
                        {shareSharedIds.has(g.id) ? (
                          <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                        ) : (
                          <button
                            onClick={() => handleShareTo(sharePanel.categoryKey, sharePanel.categoryName, { type: "group", id: g.id, name: g.name })}
                            disabled={shareSending === g.id}
                            className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: "#5fa870", color: "#5fa870" }}
                          >
                            {shareSending === g.id ? "..." : "分享"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* top-left brand */}
      <div className="fixed top-8 left-6 sm:left-40 flex items-center gap-12 z-30">
        <div className="relative flex flex-col items-center leading-none">
          <h1 className="text-[2.5rem] font-bold zen-title leading-none" style={{ color: "#b19739" }}>Test</h1>
          <span className="text-sm zen-subtle mt-3 whitespace-nowrap" style={{ color: "#5fa870" }}>testtttt.io</span>
          <div className="absolute -top-1 -right-5">
            <LanguageSelector />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="home-search w-[12.5rem] sm:w-[18.75rem] p-2 rounded-full border text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--zen-bg)", color: "#b19739", borderColor: "#b19739" }}
            placeholder={language === "en" ? "Search subjects or users" : "搜尋分類或帳號"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenKey(null); }}
          />
        </div>
      </div>

      <main className="flex w-full flex-col pt-36 px-4 sm:pl-16 sm:pr-16 min-h-screen sm:pb-10 max-sm:h-dvh max-sm:overflow-hidden">
        <div className="flex flex-row items-start gap-6 w-full flex-1 max-sm:overflow-hidden max-sm:items-stretch max-sm:min-h-0">
          {/* Left panel — categories */}
          <div className="w-full sm:w-[42%] shrink-0 max-sm:flex max-sm:flex-col max-sm:h-full max-sm:overflow-hidden">

            {/* Pinned bar */}
            <div
              className="relative min-h-[5.5rem] px-2 py-2 border-b transition-colors max-sm:shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
            >
              {loggedIn && pinnedNames.length === 0 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 select-none" style={{ color: "var(--zen-ink)" }}>
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              )}
              {loggedIn && pinnedNames.length > 0 && (
                <div className="bookshelf-grid home-bookshelf-grid">
                  {pinnedNames.map((name, pinnedIdx) => {
                    const found = findSubject(name);
                    if (!found) return null;
                    const { node: subject } = found;
                    const color = colors[(pinnedIdx + 1) % colors.length];
                    const isExpanded = openPinnedKey === name;
                    return (
                      <div key={name} className="contents">
                        <div
                          className="relative"
                          onContextMenu={e => openCtx(e, name, subject.name, "pinned")}
                        >
                          {subject.children?.length ? (
                            <button
                              type="button"
                              className={`book-link bookshelf-btn ${isExpanded ? "active-category" : ""}`}
                              style={{ color }}
                              onClick={() => setOpenPinnedKey(isExpanded ? null : name)}
                            >
                              {name}
                            </button>
                          ) : subject.dropdown?.length ? (
                            <button
                              type="button"
                              className={`book-link bookshelf-btn flex items-center gap-1 ${isExpanded ? "active-category" : ""}`}
                              style={{ color }}
                              onClick={() => setOpenPinnedKey(isExpanded ? null : name)}
                            >
                              {name}
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="m6 9 6 6 6-6"/></svg>
                            </button>
                          ) : (
                            <Link href={subject.href || "#"} className="book-link bookshelf-btn" style={{ color }}>
                              {name}
                            </Link>
                          )}
                          {subject.dropdown?.length && isExpanded && (
                            <div className={`year-dropdown absolute top-full z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto ${subject.dropdownAlign === "right" ? "right-0" : "left-0"}`} style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
                              {subject.dropdown.map(opt => (
                                <Link
                                  key={opt.href + opt.name}
                                  href={opt.href}
                                  className="block px-4 py-3 text-left"
                                  style={{ color, fontSize: "inherit" }}
                                  onClick={() => setOpenPinnedKey(null)}
                                >
                                  {opt.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                        {isExpanded && subject.children?.map(child => {
                          const childPinned = pinnedNames.includes(child.name);
                          return (
                            <div
                              key={child.name}
                              onContextMenu={e => openCtx(e, child.name, child.name, childPinned ? "pinned" : "grid")}
                              style={{ opacity: childPinned ? 0.4 : 1 }}
                            >
                              {child.href ? (
                                <Link href={child.href} className="book-link bookshelf-btn sub-item" style={{ color }}>
                                  {child.name}
                                </Link>
                              ) : (
                                <button type="button" className="book-link bookshelf-btn sub-item" style={{ color }}>
                                  {child.name}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* collapse toggle */}
              <button
                type="button"
                className="absolute bottom-2 right-2 opacity-40 hover:opacity-80 transition-opacity"
                onClick={() => setCatOpen(o => !o)}
                aria-label={catOpen ? "收合" : "展開"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: catOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>

            {/* Grid container — scrollable, always present */}
            <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto">
            {catOpen && (
              <div className="mt-2 overflow-visible max-sm:pb-24">
                {loadingLang ? (
                  <p className="text-sm zen-subtle opacity-50 py-4">載入中...</p>
                ) : (
                  <div className="bookshelf-grid home-bookshelf-grid">
                    {subjects
                      .map((subject, i) => ({ subject, i }))
                      .filter(({ subject }) => !(loggedIn && pinnedNames.includes(subject.name)))
                      .map(({ subject, i }, visibleIdx) => {
                      const key = `${language}-${i}-${subject.href || subject.name}`;
                      const isOpen = !!query || openKey === key || openKey === subject.name;
                      const hasSub = !!subject.children?.length;
                      const hasDrop = !!subject.dropdown?.length;
                      const color = colors[visibleIdx % colors.length];
                      const btnStyle = { color };

                      return (
                        <div key={key} className="contents">
                          <div
                            className="relative"
                            onContextMenu={loggedIn ? e => openCtx(e, subject.name, subject.name, "grid") : undefined}
                          >
                            {hasSub ? (
                              <button
                                type="button"
                                className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`}
                                style={btnStyle}
                                onClick={() => setOpenKey(isOpen ? null : key)}
                              >
                                {subject.name}
                              </button>
                            ) : hasDrop ? (
                              <button
                                type="button"
                                className={`book-link bookshelf-btn flex items-center gap-1 ${openDropKey === key ? "active-category" : ""}`}
                                style={btnStyle}
                                onClick={() => setOpenDropKey(openDropKey === key ? null : key)}
                              >
                                {subject.name}
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: openDropKey === key ? "rotate(180deg)" : "rotate(0deg)" }}><path d="m6 9 6 6 6-6"/></svg>
                              </button>
                            ) : (
                              <Link href={subject.href || "#"} className="book-link bookshelf-btn" style={btnStyle}>
                                {subject.name}
                              </Link>
                            )}
                            {hasDrop && openDropKey === key && (
                              <div className={`year-dropdown absolute top-full z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto ${subject.dropdownAlign === "right" ? "right-0" : "left-0"}`} style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
                                {subject.dropdown!.map(opt => (
                                  <Link
                                    key={opt.href + opt.name}
                                    href={opt.href}
                                    className="block px-4 py-3 text-left"
                                    style={{ color, fontSize: "inherit" }}
                                    onClick={() => setOpenDropKey(null)}
                                  >
                                    {opt.name}
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>

                          {isOpen && subject.children?.map((sub, j) => {
                            const subKey = `${key}-${j}`;
                            if (sub.dropdown?.length) {
                              const isDropOpen = openDropKey === subKey;
                              return (
                                <div key={subKey} className="contents">
                                  <div
                                    onContextMenu={loggedIn ? e => openCtx(e, sub.name, sub.name, "grid") : undefined}
                                    style={{ display: pinnedNames.includes(sub.name) ? "none" : undefined }}
                                  >
                                    <button
                                      type="button"
                                      className={`book-link bookshelf-btn sub-item ${isDropOpen ? "active-category" : ""}`}
                                      style={btnStyle}
                                      onClick={() => setOpenDropKey(isDropOpen ? null : subKey)}
                                    >
                                      {sub.name}
                                    </button>
                                  </div>
                                  {isDropOpen && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        className="book-link bookshelf-btn sub-sub-item flex items-center gap-1"
                                        style={btnStyle}
                                        onClick={() => setOpenYearKey(openYearKey === subKey ? null : subKey)}
                                      >
                                        年份
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                      </button>
                                      {openYearKey === subKey && (
                                        <div className={`year-dropdown absolute top-full z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto ${(sub.dropdownAlign === "right" || sub.name === "數學學測") ? "right-0" : "left-0"}`} style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
                                          {sub.dropdown.map((opt) => (
                                            <Link
                                              key={opt.href + opt.name}
                                              href={opt.href}
                                              className="block px-4 py-3 text-left"
                                              style={{ color, fontSize: "inherit" }}
                                              onClick={() => { setOpenDropKey(null); setOpenYearKey(null); }}
                                            >
                                              {opt.name}
                                            </Link>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            if (pinnedNames.includes(sub.name)) return null;
                            return (
                              <div
                                key={subKey}
                                onContextMenu={loggedIn ? e => openCtx(e, sub.name, sub.name, "grid") : undefined}
                              >
                                <Link href={sub.href || "#"} className="book-link bookshelf-btn sub-item" style={btnStyle}>
                                  {sub.name}
                                </Link>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}

                {query && searchLoading && (
                  <p className="text-sm zen-subtle mt-6 opacity-50">搜尋中...</p>
                )}

                {!loadingLang && !searchLoading && subjects.length === 0 && userResults.length === 0 && query && (
                  <p className="text-sm zen-subtle mt-6 opacity-50">
                    {language === "en" ? "No matching results" : "沒有符合的結果"}
                  </p>
                )}

                {userResults.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-zinc-400 mb-3">
                      {language === "en" ? "Users" : "帳號"}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {userResults.map(u => (
                        <li key={u.id}>
                          <Link
                            href={`/${encodeURIComponent(u.name)}`}
                            className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            <Image
                              src={u.avatarUrl || "/avatar-placeholder.svg"}
                              alt={u.name}
                              width={32}
                              height={32}
                              unoptimized
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                            <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>

          {/* Right 2/3 — reserved */}
          <div className="hidden sm:block flex-1" />
        </div>

        <Footer language={language} />
      </main>

      <Link
        href="/feedback"
        aria-label="意見回饋"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center w-11 h-11 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m2 7 10 7 10-7"/>
        </svg>
      </Link>
    </div>
  );
}
