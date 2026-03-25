
// HomeContent 組件：首頁主內容，包含科目搜尋、書架 grid、展開子分類等
"use client";


import React, { useState } from "react";
import Link from "next/link";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";


// Props 型別：語言、標題、簡體模式
interface HomeContentProps {
  language: string;
  siteTitle: string;
}

export function HomeContent({ language, siteTitle }: HomeContentProps) {
  const [subjectQuery, setSubjectQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // 取得過濾後的科目（含 children）
  const subjects = useFilteredCategories(language, subjectQuery);

  // --- UI 結構 ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16">
        {/* 標題、搜尋區塊 */}
        <div className="flex flex-col items-center gap-6 text-center w-full">
          {/* 網站標題 */}
          <h1 className="max-w-xs text-4xl font-bold zen-title">
            {siteTitle}
          </h1>
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>

          {/* 搜尋輸入框 */}
          <input
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 outline-none"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
            value={subjectQuery}
            onChange={(e) => {
              setSubjectQuery(e.target.value);
              setOpenCategory(null); // 搜尋時自動收合所有展開
            }}
          />

          {/* 書架 grid 區塊 */}
          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid home-bookshelf-grid">
              {/* 只顯示主節點，展開時子節點橫向右側排列 */}
              {subjects.map((subject) => {
                // 以 href 或 name 當作唯一 key
                const catKey = subject.href?.replace(/^\//, "") || subject.name;
                const isOpen = openCategory === catKey;
                // children 可能為 undefined，需保護
                const hasSub = Array.isArray(subject.children) && (subject.children?.length ?? 0) > 0;
                return (
                  <div key={catKey} className="flex flex-row items-center relative">
                    {/* 母節點：有子分類用 button，否則用 Link */}
                    {hasSub ? (
                      <button
                        type="button"
                        className={`book-link bookshelf-btn ${isOpen ? 'active-category' : ''}`}
                        onClick={() => setOpenCategory(isOpen ? null : catKey)}
                        style={{ width: 'fit-content', minWidth: 0, padding: '0.5rem 1rem' }}
                      >
                        {subject.name}
                      </button>
                    ) : (
                      <Link href={subject.href || "#"} className="book-link bookshelf-btn" style={{ width: 'fit-content', minWidth: 0, padding: '0.5rem 1rem' }}>
                        {subject.name}
                      </Link>
                    )}
                    {/* 子分類：只有展開時才顯示，橫向右側排列，children 可能為 undefined */}
                    {isOpen && hasSub && (
                      <div className="flex flex-row items-center ml-2 gap-2">
                        {(subject.children ?? []).map((sub, idx) => (
                          <Link key={sub.href || idx} href={sub.href || "#"} className="book-link bookshelf-btn sub-item" style={{ width: 'fit-content', minWidth: 0, padding: '0.5rem 1rem' }}>
                            {sub.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 無搜尋結果時的提示 */}
            {subjects.length === 0 && (
              <p className="text-sm zen-subtle text-center mt-10 opacity-50">
                {language === "en" ? "No matching subjects" : "沒有符合的科目"}
              </p>
            )}
          </div>
        </div> {/* 搜尋區塊結束 */}

        {/* 頁尾 */}
        <Footer language={language} />
      </main>
    </div>
  );
}