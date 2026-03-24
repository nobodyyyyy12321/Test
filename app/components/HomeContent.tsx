import React, { useState, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useFilteredCategories } from "./useFilteredCategories";
import { CategoryButton } from "./CategoryButton";
import { HomeHeader } from "./HomeHeader"; // 假設你已將標題與搜尋框抽離
import { Footer } from "./Footer";        // 假設你已將頁尾抽離

// 定義子分類資料 (建議之後也移入 JSON 或 Hook)
const SUB_CATEGORIES: Record<string, Array<{ name: string; href: string }>> = {
  english: [
    { name: "2000單", href: "/test/englishQuestions?random=1" },
    { name: "學測", href: "/under-construction" },
  ],
  recitation: [
    { name: "漢", href: "/recitation/漢" },
    { name: "唐", href: "/recitation/唐" },
    { name: "宋", href: "/recitation/宋" },
    { name: "明", href: "/recitation/明" },
    { name: "清", href: "/recitation/清" },
    { name: "民", href: "/recitation/民" },
  ],
};

interface HomeContentProps {
  language: string;
  siteTitle: string;
  isSimplified: boolean;
}

// 使用具名導出 (Named Export)
export function HomeContent({ language, siteTitle, isSimplified }: HomeContentProps) {
  const [subjectQuery, setSubjectQuery] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  // 1. 直接取得過濾後的科目清單 (內部已處理語系與搜尋)
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
            className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
            value={subjectQuery}
            onChange={(e) => setSubjectQuery(e.target.value)}
          />

          {/* 3. 核心書架區塊 */}
          <div className="mt-10 w-full overflow-visible">
            <div className="bookshelf-grid">
              {subjects.map((s) => {
                // 處理唯一識別碼，用於展開子選單
                const catId = s.href?.replace(/^\//, "") || s.name;
                const subData = SUB_CATEGORIES[catId];

                return (
                  <CategoryButton
                    key={s.name}
                    subject={{
                      name: s.name,
                      href: s.href ?? "#", // 修正 TypeScript string | undefined 錯誤
                    }}
                    isOpen={openCategory === catId}
                    onToggle={() => setOpenCategory(prev => prev === catId ? null : catId)}
                    subCategories={subData}
                  />
                );
              })}
            </div>

            {/* 4. 無結果顯示 */}
            {subjects.length === 0 && (
              <p className="text-sm zen-subtle text-center mt-10">
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