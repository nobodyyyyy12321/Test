"use client";

import React, { useState } from "react";
import { useFilteredCategories } from "./useFilteredCategories";
import { CategoryButton } from "./CategoryButton";
import { Footer } from "./Footer";

// 定義 Props 型別
interface HomeContentProps {
  language: string;
  siteTitle: string;
  isSimplified: boolean;
}

export function HomeContent({ language, siteTitle, isSimplified }: HomeContentProps) {
  // 狀態管理：搜尋字串與目前展開的科目 ID
  const [subjectQuery, setSubjectQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // 1. 從 Hook 取得過濾後的科目（資料結構中已包含 children）
  const subjects = useFilteredCategories(language, subjectQuery);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16">
        
        {/* 2. 標題與搜尋區塊 */}
        <div className="flex flex-col items-center gap-6 text-center w-full">
          <h1 className={`max-w-xs text-4xl font-bold ${isSimplified ? "zen-title-sc" : "zen-title"}`}>
            {siteTitle}
          </h1>
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>

          <input
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 outline-none focus:ring-2 focus:ring-zinc-100 dark:focus:ring-zinc-800 transition-all"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
            value={subjectQuery}
            onChange={(e) => {
              setSubjectQuery(e.target.value);
              setOpenCategory(null); // 搜尋時自動收合所有選單
            }}
          />

          {/* 3. 核心書架區塊 */}
          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid">
              {subjects.map((s) => {
                // 使用 href (去斜線) 或 name 作為唯一的展開 Key
                const catId = s.href?.replace(/^\//, "") || s.name;

                return (
                   <CategoryButton
                     key={s.name}
                     subject={{
                     name: s.name,
                     href: s.href ?? "#",
                    }}
                    isOpen={openCategory === catId}
                    onToggle={() => setOpenCategory(prev => prev === catId ? null : catId)}
                   
                  subCategories={s.children?.map(sub => ({
                  name: sub.name,
                  href: sub.href ?? "#"
                  }))} 
                     />
                );
              })}
            </div>

            {/* 4. 無搜尋結果時的提示 */}
            {subjects.length === 0 && (
              <p className="text-sm zen-subtle text-center mt-10 opacity-50">
                {language === "en" ? "No matching subjects" : "沒有符合的科目"}
              </p>
            )}
          </div>
        </div>

        {/* 5. 頁尾組件 */}
        <Footer language={language} />
      </main>
    </div>
  );
}