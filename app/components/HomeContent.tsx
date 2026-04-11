"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";

export function HomeContent({ language }: { language: string }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const subjects = useFilteredCategories(language, query);

  useEffect(() => {
    setOpenKey(null);
    setOpenDropKey(null);
    setOpenYearKey(null);
    setQuery("");
  }, [language]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16">
        <div className="flex flex-col items-center gap-6 text-center w-full">
          <h1 className="max-w-xs text-4xl font-bold zen-title" style={{ color: "#c9a84c" }}>Test</h1>
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>

          <input
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 outline-none transition-all focus:ring-2 focus:ring-zinc-100"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenKey(null); }}
          />

          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid home-bookshelf-grid">
              {subjects.map((subject, i) => {
                const key = `${language}-${i}-${subject.href || subject.name}`;
                const isOpen = openKey === key;
                const hasSub = !!subject.children?.length;

                return (
                  <div key={key} className="contents">
                    <div>
                      {hasSub ? (
                        <button
                          type="button"
                          className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`}
                          onClick={() => setOpenKey(isOpen ? null : key)}
                        >
                          {subject.name}
                        </button>
                      ) : (
                        <Link href={subject.href || "#"} className="book-link bookshelf-btn">
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
                                  onClick={() => setOpenYearKey(openYearKey === subKey ? null : subKey)}
                                >
                                  年份
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                                </button>
                                {openYearKey === subKey && (
                                <div className="year-dropdown absolute top-full left-0 z-50 mt-1 rounded-lg border border-[#a8f0c6] bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto" style={{ maxHeight: "16rem", minWidth: "5rem" }}>
                                  {sub.dropdown.map((opt) => (
                                    <Link
                                      key={opt.href + opt.name}
                                      href={opt.href}
                                      className="block px-4 py-2 text-sm text-left"
                                      style={{ color: "#a8f0c6" }}
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
                          <Link href={sub.href || "#"} className="book-link bookshelf-btn sub-item">
                            {sub.name}
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {subjects.length === 0 && (
              <p className="text-sm zen-subtle text-center mt-10 opacity-50">
                {language === "en" ? "No matching subjects" : "沒有符合的科目"}
              </p>
            )}
          </div>
        </div>
        <Footer language={language} />
      </main>
    </div>
  );
}
