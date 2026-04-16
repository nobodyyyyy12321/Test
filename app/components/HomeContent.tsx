"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";

type UserResult = { id: string; name: string; avatarUrl?: string };

export function HomeContent({ language }: { language: string }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subjects = useFilteredCategories(language, query);

  useEffect(() => {
    setOpenKey(null);
    setOpenDropKey(null);
    setOpenYearKey(null);
    setQuery("");
    setUserResults([]);
  }, [language]);

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
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16">
        <div className="flex flex-col items-center gap-6 text-center w-full">
          <div className="flex items-center">
            <h1 className="text-4xl font-bold zen-title">Test</h1>
          </div>
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>

          <input
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 outline-none transition-all focus:ring-2 focus:ring-zinc-100"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects or users" : "搜尋科目或帳號"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenKey(null); }}
          />

          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid home-bookshelf-grid">
              {subjects.map((subject, i) => {
                const key = `${language}-${i}-${subject.href || subject.name}`;
                const isOpen = !!query || openKey === key;
                const hasSub = !!subject.children?.length;
                const colors = ["#7aa8cc", "#5fa870"];
                const color = colors[i % colors.length];
                const btnStyle = { color, borderColor: color };

                return (
                  <div key={key} className="contents">
                    <div>
                      {hasSub ? (
                        <button
                          type="button"
                          className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`}
                          style={btnStyle}
                          onClick={() => setOpenKey(isOpen ? null : key)}
                        >
                          {subject.name}
                        </button>
                      ) : (
                        <Link href={subject.href || "#"} className="book-link bookshelf-btn" style={btnStyle}>
                          {subject.name}
                        </Link>
                      )}
                    </div>

                    {isOpen && subject.children!.map((sub, j) => {
                      const subKey = `${key}-${j}`;
                      if (sub.dropdown?.length) {
                        const isDropOpen = openDropKey === subKey;
                        return (
                          <div key={subKey} className="contents">
                            <div>
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
                      return (
                        <div key={subKey}>
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

            {subjects.length === 0 && userResults.length === 0 && query && (
              <p className="text-sm zen-subtle text-center mt-10 opacity-50">
                {language === "en" ? "No matching results" : "沒有符合的結果"}
              </p>
            )}
          </div>
          {userResults.length > 0 && (
            <div className="mt-8 w-full max-w-sm mx-auto">
              <p className="text-xs text-zinc-400 mb-3 text-left">
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
        <Footer language={language} />
      </main>
    </div>
  );
}
