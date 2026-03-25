"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";

// 直接在參數列定義型別，移除外部介面
export function HomeContent({ language }: { language: string }) {
  const [subjectQuery, setSubjectQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // 這裡改為固定常數
  const siteTitle = "Test"; 

  // 語系切換時自動重置
  useEffect(() => {
    setOpenCategory(null);
    setSubjectQuery("");
  }, [language]);

  const subjects = useFilteredCategories(language, subjectQuery);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16">
        <div className="flex flex-col items-center gap-6 text-center w-full">
          <h1 className="max-w-xs text-4xl font-bold zen-title">
            {siteTitle}
          </h1>
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>

          <input
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 outline-none transition-all focus:ring-2 focus:ring-zinc-100"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
            value={subjectQuery}
            onChange={(e) => {
              setSubjectQuery(e.target.value);
              setOpenCategory(null);
            }}
          />

          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid home-bookshelf-grid">
              {subjects.map((subject) => {
                const catKey = subject.href?.replace(/^\//, "") || subject.name;
                const langCatKey = `${language}-${catKey}`;
                const isOpen = openCategory === langCatKey;
                // 簡化判斷式
                const hasSub = Array.isArray(subject.children) && subject.children.length > 0;

                return (
                  <div key={langCatKey} className="flex flex-row items-center relative">
                    {hasSub ? (
                      <button
                        type="button"
                        className={`book-link bookshelf-btn ${isOpen ? 'active-category' : ''}`}
                        onClick={() => setOpenCategory(isOpen ? null : langCatKey)}
                      >
                        {subject.name}
                      </button>
                    ) : (
                      <Link href={subject.href || "#"} className="book-link bookshelf-btn">
                        {subject.name}
                      </Link>
                    )}

                    {isOpen && hasSub && (
                      <div className="flex flex-row items-center ml-2 gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                        {subject.children!.map((sub, idx) => (
                          <Link 
                            key={`${language}-${sub.href || idx}`} 
                            href={sub.href || "#"} 
                            className="book-link bookshelf-btn sub-item"
                          >
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