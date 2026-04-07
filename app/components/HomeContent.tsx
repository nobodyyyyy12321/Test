"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";

export function HomeContent({ language }: { language: string }) {
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const subjects = useFilteredCategories(language, query);

  useEffect(() => {
    setOpenKey(null);
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
                  <div key={key} className="flex flex-row items-center relative">
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

                    {isOpen && (
                      <div className="flex flex-row items-center animate-in fade-in slide-in-from-left-2 duration-300" style={{ gap: "0.875rem", marginLeft: "0.875rem" }}>
                        {subject.children!.map((sub, j) => (
                          <Link key={`${j}-${sub.href}`} href={sub.href || "#"} className="book-link bookshelf-btn sub-item">
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
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
