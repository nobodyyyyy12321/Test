"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";
import LanguageSelector from "./LanguageSelector";
import type { CategoryNode } from "./CategoryNode";

type UserResult = { id: string; name: string; avatarUrl?: string };

export function HomeContent({ initialCategories }: { initialCategories: CategoryNode[] }) {
  const [language, setLanguage] = useState("zh-TW");
  const [categories, setCategories] = useState<CategoryNode[]>(initialCategories ?? []);
  const [loadingLang, setLoadingLang] = useState(false);
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [catOpen, setCatOpen] = useState(true);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [draggingFrom, setDraggingFrom] = useState<"pinned" | "grid" | null>(null);
  const [overPinned, setOverPinned] = useState(false);
  const [overGrid, setOverGrid] = useState(false);
  const [openPinnedKey, setOpenPinnedKey] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ name: string; x: number; y: number } | null>(null);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragRef = useRef<{ name: string; from: "pinned" | "grid" } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressPendingRef = useRef<{ e: React.TouchEvent; name: string; from: "pinned" | "grid" } | null>(null);
  const cancelLongPressRef = useRef(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    longPressPendingRef.current = null;
  });
  const subjects = useFilteredCategories(categories, query);

  const colors = ["#b19739", "#5fa870"];

  // find a node by name at top-level or child level
  const findSubject = (name: string): { node: CategoryNode; color: string } | null => {
    for (let i = 0; i < subjects.length; i++) {
      const s = subjects[i];
      if (s.name === name) return { node: s, color: colors[i % colors.length] };
      const child = s.children?.find(c => c.name === name);
      if (child) return { node: child, color: colors[i % colors.length] };
    }
    return null;
  };

  // load pinned from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("pinnedCats");
      if (stored) setPinnedNames(JSON.parse(stored));
    } catch {}
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

  // stable refs for touch handlers
  const pinRef = useRef(pin);
  const unpinRef = useRef(unpin);
  useEffect(() => { pinRef.current = pin; unpinRef.current = unpin; });

  // touch drag global listeners
  useEffect(() => {
    const onMove = (e: TouchEvent) => {
      if (longPressPendingRef.current) cancelLongPressRef.current();
      if (!touchDragRef.current) return;
      e.preventDefault();
      const t = e.touches[0];
      setGhostPos({ name: touchDragRef.current.name, x: t.clientX, y: t.clientY });
    };
    const onEnd = (e: TouchEvent) => {
      cancelLongPressRef.current();
      const drag = touchDragRef.current;
      if (!drag) return;
      const t = e.changedTouches[0];
      const el = document.elementFromPoint(t.clientX, t.clientY);
      if (el?.closest('[data-drop="pinned"]') && drag.from === "grid") pinRef.current(drag.name);
      else if (el?.closest('[data-drop="grid"]') && drag.from === "pinned") unpinRef.current(drag.name);
      touchDragRef.current = null;
      setGhostPos(null);
      setDragging(null);
      setDraggingFrom(null);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, []);

  const startTouchDrag = (e: React.TouchEvent, name: string, from: "pinned" | "grid") => {
    if (!loggedIn) return;
    const t = e.touches[0];
    const startX = t.clientX;
    const startY = t.clientY;
    longPressPendingRef.current = { e, name, from };
    longPressTimerRef.current = setTimeout(() => {
      const pending = longPressPendingRef.current;
      if (!pending) return;
      touchDragRef.current = { name: pending.name, from: pending.from };
      setDragging(pending.name);
      setDraggingFrom(pending.from);
      setGhostPos({ name: pending.name, x: startX, y: startY });
      longPressPendingRef.current = null;
    }, 500);
  };

  // sync language from localStorage
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

  // fetch categories when language changes
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

  // user search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setUserResults([]); return; }
    debounceRef.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        .then(r => r.json())
        .then(d => setUserResults(d.users ?? []))
        .catch(() => setUserResults([]));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  return (
    <div className="flex min-h-screen items-start justify-start bg-transparent font-sans dark:bg-black">
      {/* touch drag ghost */}
      {ghostPos && (
        <div
          className="fixed pointer-events-none z-[200] book-link bookshelf-btn opacity-80"
          style={{ left: ghostPos.x, top: ghostPos.y + 12, color: "#b19739", transform: "translateX(-50%) scale(1.08)" }}
        >
          {ghostPos.name}
        </div>
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
        <input
          className="home-search w-[12.5rem] sm:w-[18.75rem] p-2 rounded-full border text-sm outline-none transition-all"
          style={{ backgroundColor: "var(--zen-bg)", color: "#b19739", borderColor: "#b19739" }}
          placeholder={language === "en" ? "Search subjects or users" : "搜尋分類或帳號"}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpenKey(null); }}
        />
      </div>

      <main className="flex min-h-screen w-full flex-col pt-36 pb-10 px-4 sm:pl-16 sm:pr-16">
        <div className="flex flex-row items-start gap-6 w-full flex-1">
          {/* Left panel — categories */}
          <div className="w-full sm:w-[42%] shrink-0">

            {/* Pinned bar — drop target */}
            <div
              data-drop="pinned"
              className="min-h-[5.5rem] px-2 py-2 border-b transition-colors"
              style={{
                borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)",
                background: loggedIn && overPinned ? "color-mix(in srgb, #5fa870 8%, transparent)" : "transparent",
              }}
              onDragOver={e => { if (!loggedIn) return; e.preventDefault(); setOverPinned(true); }}
              onDragLeave={() => setOverPinned(false)}
              onDrop={e => {
                if (!loggedIn) return;
                e.preventDefault();
                if (dragging) pin(dragging);
                setDragging(null);
                setOverPinned(false);
              }}
            >
              {loggedIn && pinnedNames.length === 0 && !overPinned && (
                <span className="text-xs opacity-25 select-none" style={{ color: "var(--zen-ink)" }}>
                  {language === "en" ? "Favorites" : "釘選"}
                </span>
              )}
              {loggedIn && pinnedNames.length > 0 && (
                <div className="bookshelf-grid home-bookshelf-grid">
                  {pinnedNames.map(name => {
                    const found = findSubject(name);
                    if (!found) return null;
                    const { node: subject, color } = found;
                    const isExpanded = openPinnedKey === name;
                    return (
                      <div key={name} className="contents">
                        <div
                          className="relative"
                          draggable
                          onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragging(name); setDraggingFrom("pinned"); }}
                          onDragEnd={() => { setDragging(null); setDraggingFrom(null); }}
                          onTouchStart={e => startTouchDrag(e, name, "pinned")}
                          style={{ cursor: "grab" }}
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
                            <div className="year-dropdown absolute top-full left-0 z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto" style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
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
                              draggable
                              onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragging(child.name); setDraggingFrom(childPinned ? "pinned" : "grid"); }}
                              onDragEnd={() => { setDragging(null); setDraggingFrom(null); }}
                              onTouchStart={e => startTouchDrag(e, child.name, childPinned ? "pinned" : "grid")}
                              style={{ cursor: "grab", opacity: childPinned ? 0.4 : 1 }}
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
                className="ml-auto opacity-40 hover:opacity-80 transition-opacity"
                onClick={() => setCatOpen(o => !o)}
                aria-label={catOpen ? "收合" : "展開"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: catOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>

            {catOpen && (
              <div className="mt-2 overflow-visible">
                {loadingLang ? (
                  <p className="text-sm zen-subtle opacity-50 py-4">載入中...</p>
                ) : (
                  <div
                    data-drop="grid"
                    className="bookshelf-grid home-bookshelf-grid"
                    onDragOver={e => { e.preventDefault(); if (draggingFrom === "pinned") setOverGrid(true); }}
                    onDragLeave={() => setOverGrid(false)}
                    onDrop={e => {
                      e.preventDefault();
                      if (draggingFrom === "pinned" && dragging) unpin(dragging);
                      setDragging(null); setDraggingFrom(null); setOverGrid(false);
                    }}
                    style={{ outline: overGrid ? "2px dashed #5fa870" : "none", borderRadius: "0.5rem" }}
                  >
                    {subjects.map((subject, i) => {
                      const key = `${language}-${i}-${subject.href || subject.name}`;
                      const isOpen = !!query || openKey === key || openKey === subject.name;
                      const hasSub = !!subject.children?.length;
                      const hasDrop = !!subject.dropdown?.length;
                      const color = colors[i % colors.length];
                      const btnStyle = { color };
                      const isPinned = pinnedNames.includes(subject.name);
                      if (loggedIn && isPinned) return null;

                      return (
                        <div key={key} className="contents">
                          <div
                            className="relative"
                            draggable={loggedIn}
                            onDragStart={loggedIn ? e => { e.dataTransfer.effectAllowed = "move"; setDragging(subject.name); setDraggingFrom("grid"); } : undefined}
                            onDragEnd={loggedIn ? () => { setDragging(null); setDraggingFrom(null); } : undefined}
                            onTouchStart={e => startTouchDrag(e, subject.name, "grid")}
                            style={{ cursor: loggedIn ? "grab" : undefined }}
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
                              <div className="year-dropdown absolute top-full left-0 z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto" style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
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
                                    draggable
                                    onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragging(sub.name); setDraggingFrom("grid"); }}
                                    onDragEnd={() => { setDragging(null); setDraggingFrom(null); }}
                                    onTouchStart={e => startTouchDrag(e, sub.name, "grid")}
                                    style={{ cursor: "grab", display: pinnedNames.includes(sub.name) ? "none" : undefined }}
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
                                        <div className="year-dropdown absolute top-full left-0 z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto" style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
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
                                draggable
                                onDragStart={e => { e.dataTransfer.effectAllowed = "move"; setDragging(sub.name); setDraggingFrom("grid"); }}
                                onDragEnd={() => { setDragging(null); setDraggingFrom(null); }}
                                onTouchStart={e => startTouchDrag(e, sub.name, "grid")}
                                style={{ cursor: "grab" }}
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

                {!loadingLang && subjects.length === 0 && userResults.length === 0 && query && (
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
                            <img
                              src={u.avatarUrl || "/avatar-placeholder.svg"}
                              alt={u.name}
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

          {/* Right 2/3 — reserved */}
          <div className="hidden sm:block flex-1" />
        </div>

        <Footer language={language} />
      </main>
    </div>
  );
}
