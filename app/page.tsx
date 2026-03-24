

// 這是 Next.js 首頁的主要組件，負責顯示主畫面與科目分類
"use client";
import React from "react";


// Next.js 路由與 hooks
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, useRef } from "react";
import Link from "next/link";
// 自訂元件

import ShareIcon from "./components/ShareIcon";


import "./speaker-icon.css";
import MusicTip from "./components/MusicTip";



// 首頁內容元件的 props 型別
type HomeContentProps = {
  categories: string[];
  siteTitle: string;
  isSimplified: boolean;
  language: string;
};


// 搜尋文章的型別
type SearchArticle = {
  title?: string;
  author?: string;
  category?: string;
  number?: number;
};



function HomeContent({ categories, siteTitle, isSimplified, language }: HomeContentProps) {
  // 子分類（目前僅英文有，其他語言可擴充）
  const childSubjects: { name: string; href: string }[] = [];
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const category2: Record<string, Array<{ name: string; href: string }>> = {
    english: [
      { name: "2000單", href: "/test/englishQuestions?random=1" },
      { name: "學測", href: "/under-construction" },
      // 其他子分類...
    ],
    recitation: [
      { name: "漢", href: "/recitation/漢" },
      { name: "唐", href: "/recitation/唐" },
      { name: "宋", href: "/recitation/宋" },
      { name: "明", href: "/recitation/明" },
      { name: "清", href: "/recitation/清" },
      { name: "民", href: "/recitation/民" },
      // 你可以根據實際需求增減子分類
    ],
    // chinese: [...],
    // math: [...],
  };
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [loadedCategories, setLoadedCategories] = useState<string[]>([]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [articleMatches, setArticleMatches] = useState<Array<{ name: string; href: string }>>([]);
  let category1: { name: string; href: string }[] = [];
  if (language === "en") {
    category1 = [
      { name: "Learn Chinese", href: "/study-chinese" },
      { name: "Math", href: "/under-construction" },
      { name: "Physics", href: "/under-construction" },
      { name: "Chemistry", href: "/under-construction" },
      { name: "Contest", href: "/under-construction" },
      { name: "Quote", href: "/under-construction" },
    ];
  } else if (language === "zh-CN") {
    category1 = [
      { name: "背东西", href: "/recitation" },
      { name: "国文", href: "/chinese" },
      { name: "英文", href: "/english" },
      { name: "公职考试", href: "/公職考試" },
      { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
      { name: "综合", href: "/綜合" },
      { name: "比赛", href: "/under-construction" },
      { name: "八卦", href: "/under-construction" },
      { name: "猜谜", href: "/under-construction" },
      { name: "笑话", href: "/under-construction" },
      { name: "数学", href: "/math" },
      { name: "物理", href: "/physics" },
      { name: "化学", href: "/chemistry" },
      { name: "生物", href: "/under-construction" },
      { name: "地理", href: "/under-construction" },
      { name: "天文", href: "/under-construction" },
      { name: "历史", href: "/under-construction" },
      { name: "公民", href: "/under-construction" },
      { name: "心理", href: "/under-construction" },
      { name: "哲學", href: "/under-construction" },
      { name: "自然", href: "/natural" },
      { name: "社会", href: "/social" },
    ];
  } else if (language === "es") {
    category1 = [
      { name: "Matemáticas", href: "/under-construction" },
      { name: "Química", href: "/under-construction" },
      { name: "Física", href: "/under-construction" },
      { name: "Concurso", href: "/under-construction" },
      { name: "Cita", href: "/under-construction" },
    ];
  } else if (language === "th") {
    category1 = [
      { name: "คณิตศาสตร์", href: "/under-construction" },
      { name: "ฟิสิกส์", href: "/under-construction" },
      { name: "เคมี", href: "/under-construction" },
      { name: "การแข่งขัน", href: "/under-construction" },
      { name: "คำคม", href: "/under-construction" },
    ];
  } else if (language === "id") {
    category1 = [
      { name: "Matematika", href: "/under-construction" },
      { name: "Fisika", href: "/under-construction" },
      { name: "Kimia", href: "/under-construction" },
      { name: "Kompetisi", href: "/under-construction" },
      { name: "Kutipan", href: "/under-construction" },
    ];
  } else if (language === "ko") {
    category1 = [
      { name: "수학", href: "/under-construction" },
      { name: "물리", href: "/under-construction" },
      { name: "화학", href: "/under-construction" },
      { name: "대회", href: "/under-construction" },
      { name: "명언", href: "/under-construction" },
    ];
  } else {
    category1 = [
      { name: "背東西", href: "/recitation" },
      { name: "國文", href: "/chinese" },
      { name: "英文", href: "/english" },
      { name: "公職考試", href: "/公職考試" },
      { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
      { name: "綜合", href: "/綜合" },
      { name: "比賽", href: "/under-construction" },
      { name: "八卦", href: "/under-construction" },
      { name: "猜謎", href: "/under-construction" },
      { name: "笑話", href: "/under-construction" },
      { name: "數學", href: "/math" },
      { name: "物理", href: "/physics" },
      { name: "化學", href: "/chemistry" },
      { name: "生物", href: "/under-construction" },
      { name: "地理", href: "/under-construction" },
      { name: "天文", href: "/under-construction" },
      { name: "歷史", href: "/under-construction" },
      { name: "公民", href: "/under-construction" },
      { name: "心理", href: "/under-construction" },
      { name: "哲學", href: "/under-construction" },
      { name: "自然", href: "/natural" },
      { name: "社會", href: "/social" },
    ];
  }

  // 監聽搜尋欄輸入，debounce 後向 /api/search 查詢文章標題
  useEffect(() => {
    const q = subjectQuery.trim();
    if (q.length < 2) {
      setArticleMatches([]);
      return;
    }

    const controller = new AbortController();
    const debounce = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { articles: [] }))
        .then((data) => {
          const results: SearchArticle[] = Array.isArray(data?.articles) ? data.articles : [];
          const mapped = results
            .filter((article) => article?.title && article?.number)
            .slice(0, 30)
            .map((article) => ({
              name: `${article.number} · ${article.title}${article.author ? ` - ${article.author}` : ""}`,
              href: `/${encodeURIComponent(article.category || "未分類")}/${article.number}`,
            }));
          setArticleMatches(mapped);
        })
        .catch(() => {
          setArticleMatches([]);
        });
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [subjectQuery]);

  // 根據搜尋欄過濾科目與文章標題
  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return category1;
    const rangePattern = /^\d+\s*-\s*\d+$/;
    // 過濾掉範圍型名稱
    const searchPool = [...category1, ...childSubjects].filter((subject) => !rangePattern.test(subject.name.trim()));
    // 名稱包含關鍵字的科目
    const subjectMatches = searchPool.filter((subject) => subject.name.toLowerCase().includes(q));
    // 合併科目與文章搜尋結果，去重
    const unique = new Map<string, { name: string; href: string }>();
    for (const item of subjectMatches) {
      unique.set(`${item.name}::${item.href}`, item);
    }
    for (const item of articleMatches) {
      unique.set(`${item.name}::${item.href}`, item);
    }
    return Array.from(unique.values());
  }, [category1, childSubjects, subjectQuery, articleMatches]);

  // 首頁載入時取得所有分類（API）
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setLoadedCategories(data.categories || []))
      .catch((err) => console.error("Failed to fetch categories:", err));
    // 全站統計已移至 /stats 頁面
  }, []);

  // 監聽網址驗證參數，顯示驗證訊息
  useEffect(() => {
    const verified = searchParams?.get("verified");
    const error = searchParams?.get("error");

    if (verified === "1") {
      setVerificationMessage("success");
      window.history.replaceState({}, "", "/");
    } else if (verified === "0") {
      if (error === "missing_token") setVerificationMessage("missing_token");
      else if (error === "invalid_token") setVerificationMessage("invalid_token");
      else if (error === "expired") setVerificationMessage("expired");
      else setVerificationMessage("error");
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  // --- 畫面渲染 ---
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      {/* 首頁主內容區塊 */}
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black">
        {verificationMessage && (
          <div className={`w-full mb-6 p-4 rounded-md ${
            verificationMessage === "success"
              ? "bg-green-50 border border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
              : "bg-red-50 border border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          }`}>
            {verificationMessage === "success" && (
              <p className="font-medium">✅ 電子郵件驗證成功！您現在可以登入了。</p>
            )}
            {verificationMessage === "missing_token" && (
              <p className="font-medium">❌ 驗證連結無效：缺少驗證令牌。</p>
            )}
            {verificationMessage === "invalid_token" && (
              <p className="font-medium">❌ 驗證連結無效：令牌不存在或已使用。</p>
            )}
            {verificationMessage === "expired" && (
              <p className="font-medium">❌ 驗證連結已過期，請重新申請驗證郵件。</p>
            )}
            {verificationMessage === "error" && (
              <p className="font-medium">❌ 驗證過程中發生錯誤，請稍後再試。</p>
            )}
          </div>
        )}


        <div className="flex flex-col items-center gap-6 text-center">
          <h1
            className={`max-w-xs text-4xl font-bold ${isSimplified ? "zen-title-sc" : "zen-title"}`}
          >
            {siteTitle}
          </h1>
          {/* 副標題 */}
          <p className="max-w-md text-lg leading-8 zen-subtle">testtttt.io</p>
          {/* 公告區塊已移除 */}
          {/* 全站統計已移至 「全站統計」 頁面 */}

          <div className="mt-4 flex w-full max-w-5xl flex-col gap-10">
            <input
              className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm"
              style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              placeholder={language === "en" ? "Search subjects" : language === "zh-CN" ? "搜索科目" : "搜尋科目"}
              value={subjectQuery}
              onChange={(e) => setSubjectQuery(e.target.value)}
              aria-label={language === "en" ? "Search subjects" : language === "zh-CN" ? "搜索科目" : "搜尋科目"}
            />
            <div className="w-full overflow-visible">
              <div className="bookshelf-grid home-bookshelf-grid">
                {(() => {
                  // bookshelf-grid 設定 8 欄
                  const COLS = 8;
                  const rows: React.ReactNode[] = [];
                  let insertIdx = -1;
                  let subcatKey = '';
                  // 找到展開的母按鈕 index
                  filteredSubjects.forEach((subject, idx) => {
                    const catKey = subject.href.replace(/^\//, "");
                    if (openCategory === catKey && category2[catKey]) {
                      insertIdx = idx;
                      subcatKey = catKey;
                    }
                  });
                  // 分割 category1，插入子分類 row
                  let i = 0;
                  while (i < filteredSubjects.length) {
                    // 取出一排
                    const rowSubjects = filteredSubjects.slice(i, i + COLS);
                    // 檢查這排是否為插入點
                    const isInsertRow = insertIdx !== -1 && i + COLS > insertIdx && i <= insertIdx;
                    // 渲染這排
                    const rowContent = (
                      <div style={{ display: 'contents' }} key={"row-" + i}>
                        {rowSubjects.flatMap((subject, idx2) => {
                          const catKey = subject.href.replace(/^\//, "");
                          const hasSub = !!category2[catKey];
                          const isOpen = openCategory === catKey;
                          // 若是展開的母按鈕，右側插入一個 bookshelf-grid 格子作為子按鈕群
                          if (hasSub && isOpen) {
                            return [
                              <div key={subject.name} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="book-link bookshelf-btn"
                                  data-title={subject.name}
                                  data-href={subject.href}
                                  onClick={() => setOpenCategory(isOpen ? null : catKey)}
                                >
                                  {subject.name}
                                </button>
                              </div>,
                              <div key={subject.name + '-sub'}
                                style={{
                                  display: 'flex',
                                  gap: '0.875rem',
                                  alignItems: 'center',
                                  position: 'relative',
                                  zIndex: 10
                                }}
                              >
                                {Array.isArray(category2[catKey]) && category2[catKey].map((sub) => {
                                  const isValidHref =
                                    typeof sub.href === "string" &&
                                    sub.href.trim() !== "" &&
                                    (sub.href.startsWith("/") || sub.href.startsWith("http://") || sub.href.startsWith("https://"));
                                  const isValidName = typeof sub.name === "string" && sub.name.trim() !== "";
                                  if (isValidHref && isValidName) {
                                    return (
                                      <Link
                                        key={sub.href}
                                        href={sub.href}
                                        className="book-link bookshelf-btn"
                                        style={{
                                          minWidth: 0,
                                          whiteSpace: 'nowrap',
                                          background: '#282828d9',
                                          borderRadius: '8px',
                                          boxShadow: '0 1px 4px 0 rgba(0,0,0,0.04)',
                                          padding: '0.25em 1.1em',
                                        }}
                                      >
                                        {sub.name}
                                      </Link>
                                    );
                                  } else {
                                    if (typeof window !== "undefined") {
                                      // eslint-disable-next-line no-console
                                      console.warn("Invalid subcategory for Link:", sub);
                                    }
                                    return null;
                                  }
                                })}
                              </div>
                            ];
                          } else {
                            return (
                              <div key={subject.name} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {hasSub ? (
                                  <button
                                    type="button"
                                    className="book-link bookshelf-btn"
                                    data-title={subject.name}
                                    data-href={subject.href}
                                    onClick={() => setOpenCategory(isOpen ? null : catKey)}
                                  >
                                    {subject.name}
                                  </button>
                                ) : (
                                  <Link
                                    href={subject.href}
                                    className="book-link bookshelf-btn"
                                    data-title={subject.name}
                                    data-href={subject.href}
                                  >
                                    {subject.name}
                                  </Link>
                                )}
                              </div>
                            );
                          }
                        })}
                      </div>
                    );
                    rows.push(
                      <React.Fragment key={"frag-" + i}>
                        {rowContent}
                        {/* 點擊空白區域收合的透明遮罩，zIndex 調低避免遮住子按鈕 */}
                        {isInsertRow && (
                          <div
                            onClick={(e) => { if (e.button === 0) setOpenCategory(null); }}
                            style={{
                              position: 'absolute',
                              left: rowSubjects.findIndex((subject) => {
                                const catKey = subject.href.replace(/^\//, "");
                                return openCategory === catKey && category2[catKey];
                              }) * (100 / COLS) + '%',
                              top: 0,
                              width: (100 / COLS) + '%',
                              height: '100%',
                              zIndex: 9,
                              background: 'transparent',
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                    i += COLS;
                  }
                  return rows;
                })()}
              </div>
            </div>
            {filteredSubjects.length === 0 && (
              <p className="text-sm zen-subtle text-center">
                {language === "en" ? "No matching subjects or recitation titles" : language === "zh-CN" ? "没有符合的科目或诗文标题" : "沒有符合的科目或詩文標題"}
              </p>
            )}
          </div>
        </div>

        <footer className="w-full mt-auto pt-16 pb-6 flex items-center justify-center gap-4 relative">
          <div className="speaker-icon">
            <img src="speaker.png" alt="Speaker Icon" />
            { <MusicTip/>  } 
          </div>
          <Link
            href="/feedback"
            className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-full bg-transparent text-[var(--zen-ink)] text-sm leading-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            {language === "en"
              ? "Feedback"
              : language === "zh-CN"
              ? "意见反馈"
              : language === "es"
              ? "Retroalimentación"
              : language === "th"
              ? "ข้อเสนอแนะ"
              : language === "id"
              ? "Masukan"
              : language === "ko"
              ? "피드백"
              : language === "ru"
              ? "Обратная связь"
              : "意見回饋"}
          </Link>
        </footer>
      </main>
    </div>
  );
}


export default function Home() {
  const [siteTitle, setSiteTitle] = useState("Test");
  const [isSimplified, setIsSimplified] = useState(false);
  const [language, setLanguage] = useState("zh-TW");

  useEffect(() => {
    const syncTitle =() => {
      const language = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(language);
      setIsSimplified(language === "zh-CN");
      setSiteTitle(language === "zh-CN" ? "Test" : "Test");
    };

    syncTitle();
    window.addEventListener("storage", syncTitle);
    window.addEventListener("site-language-change", syncTitle);
    return () => {
      window.removeEventListener("storage", syncTitle);
      window.removeEventListener("site-language-change", syncTitle);
    };
  }, []);

  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
        <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-white dark:bg-black">
          <div className="flex flex-col items-center gap-6 text-center">
            <h1
              className={`max-w-xs text-4xl font-bold ${isSimplified ? "zen-title-sc" : "zen-title"}`}
            >
              {siteTitle}
            </h1>
            <p className="max-w-md text-lg leading-8 zen-subtle"></p>

            <div className="mt-4 flex w-full max-w-5xl flex-col gap-10">
              {(language === "en"
                ? [
                    { name: "Learn Chinese", href: "/study-chinese" },
                  ]
                : language === "zh-CN"
                  ? [
                      { name: "背东西", href: "/recitation" },
                      { name: "国文", href: "/chinese" },
                      { name: "英文", href: "/english" },
                      { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
                      { name: "综合", href: "/綜合" },
                      { name: "数学", href: "/math" },
                      { name: "物理", href: "/physics" },
                      { name: "化学", href: "/chemistry" },
                      { name: "生物", href: "/under-construction" },
                      { name: "地理", href: "/under-construction" },
                      { name: "历史", href: "/under-construction" },
                      { name: "公民", href: "/under-construction" },
                      { name: "心理", href: "/under-construction" },
                      { name: "哲學", href: "/under-construction" },
                      { name: "自然", href: "/natural" },
                      { name: "社会", href: "/social" },
                    ]
                  : [
                      { name: "背東西", href: "/recitation" },
                      { name: "國文", href: "/chinese" },
                      { name: "英文", href: "/english" },
                      { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
                      { name: "綜合", href: "/綜合" },
                      { name: "數學", href: "/math" },
                      { name: "物理", href: "/physics" },
                      { name: "化學", href: "/chemistry" },
                      { name: "生物", href: "/under-construction" },
                      { name: "地理", href: "/under-construction" },
                      { name: "歷史", href: "/under-construction" },
                      { name: "公民", href: "/under-construction" },
                      { name: "心理", href: "/under-construction" },
                      { name: "哲學", href: "/under-construction" },
                      { name: "自然", href: "/natural" },
                      { name: "社會", href: "/social" },
                    ]
              ).length > 0 && (
                <div className="w-full overflow-visible">
                  <div className="bookshelf-grid home-bookshelf-grid">
                    {(language === "en"
                      ? [
                          { name: "Learn Chinese", href: "/study-chinese" },
                        ]
                      : language === "zh-CN"
                        ? [
                            { name: "背东西", href: "/recitation" },
                            { name: "国文", href: "/chinese" },
                            { name: "英文", href: "/english" },
                            { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
                            { name: "综合", href: "/綜合" },
                            { name: "数学", href: "/math" },
                            { name: "物理", href: "/physics" },
                            { name: "化学", href: "/chemistry" },
                            { name: "生物", href: "/under-construction" },
                            { name: "地理", href: "/under-construction" },
                            { name: "历史", href: "/under-construction" },
                            { name: "公民", href: "/under-construction" },
                            { name: "心理", href: "/under-construction" },
                            { name: "哲學", href: "/under-construction" },
                            { name: "自然", href: "/natural" },
                            { name: "社会", href: "/social" },
                          ]
                        : [
                            { name: "背東西", href: "/recitation" },
                            { name: "國文", href: "/chinese" },
                            { name: "英文", href: "/english" },
                            { name: "名言佳句", href: "/test/quoteQuestions?random=1" },
                            { name: "綜合", href: "/綜合" },
                            { name: "數學", href: "/math" },
                            { name: "物理", href: "/physics" },
                            { name: "化學", href: "/chemistry" },
                            { name: "生物", href: "/under-construction" },
                            { name: "地理", href: "/under-construction" },
                            { name: "歷史", href: "/under-construction" },
                            { name: "公民", href: "/under-construction" },
                            { name: "心理", href: "/under-construction" },
                            { name: "哲學", href: "/under-construction" },
                            { name: "自然", href: "/natural" },
                            { name: "社會", href: "/social" },
                          ]
                    ).map((subject) => (
                      <Link
                        key={subject.name}
                        href={subject.href}
                        className="book-link"
                      >
                        {subject.name}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="w-full mt-auto pt-16 pb-6 flex items-center justify-center">
            <Link
              href="/feedback"
              className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 rounded-full bg-transparent text-[var(--zen-ink)] text-sm leading-none cursor-pointer hover:opacity-0 transition-opacity"
            >
              {language === "en"
                ? "Feedback"
                : language === "zh-CN"
                ? "意见反馈"
                : language === "es"
                ? "Retroalimentación"
                : language === "th"
                ? "ข้อเสนอแนะ"
                : language === "id"
                ? "Masukan"
                : language === "ko"
                ? "피드백"
                : language === "ru"
                ? "Обратная связь"
                : "意見回饋"}
            </Link>
          </footer>

          {/* Fixed logo at top left */}
          <div className="fixed left-6 top-6 z-50">
            <img
              src="/public/logo-removebg-preview.png"
              alt="testtttt.io logo"
              className="w-10 h-10 object-contain"
            />
          </div>

          {/* Fixed speaker icon at bottom left */}
          {/* Speaker icon removed */}
        </main>
      </div>
    }>
      <HomeContent categories={[]} siteTitle={siteTitle} isSimplified={isSimplified} language={language} />
    </Suspense>
  );
}
