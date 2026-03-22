"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, Suspense, useRef } from "react";
import Link from "next/link";
import MusicTip from "./components/MusicTip";
import ShareIcon from "./components/ShareIcon";

import "./speaker-icon.css";


type HomeContentProps = {
  categories: string[];
  siteTitle: string;
  isSimplified: boolean;
  language: string;
};

type SearchArticle = {
  title?: string;
  author?: string;
  category?: string;
  number?: number;
};

function HomeContent({ categories, siteTitle, isSimplified, language }: HomeContentProps) {
      const [tonearmOn, setTonearmOn] = useState(false);
    // Add childSubjects declaration
    const childSubjects =
      language === "en"
        ? []
        : language === "zh-CN"
          : language === "es"
            ? []
            : language === "th"
              ? []
              : language === "id"
                ? []
                : [];
    const [musicPlaying, setMusicPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const musicUrl = "/music/light-music.mp3";
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [loadedCategories, setLoadedCategories] = useState<string[]>([]);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [articleMatches, setArticleMatches] = useState<Array<{ name: string; href: string }>>([]);
  const subjects =
    language === "en"
      ? [
          { name: "Learn Chinese", href: "/study-chinese" },
          { name: "Math", href: "/under-construction" },
          { name: "Physics", href: "/under-construction" },
          { name: "Chemistry", href: "/under-construction" },
          { name: "Contest", href: "/under-construction" },
          { name: "Quote", href: "/under-construction" },
        ]
      : language === "zh-CN"
        ? [
            { name: "背东西", href: "/recitation" },
            { name: "国文", href: "/chinese" },
            { name: "英文", href: "/english" },
            { name: "公职考试", href: "/公職考試" },
            { name: "名言佳句", href: "/quote" },
            { name: "综合", href: "/綜合" },
            { name: "比赛", href: "/under-construction" },
            { name: "撩语录", href: "/under-construction" },
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
          ]
      : language === "es"
        ? [
            { name: "Matemáticas", href: "/under-construction" },
            { name: "Química", href: "/under-construction" },
            { name: "Concurso", href: "/under-construction" },
            { name: "Cita", href: "/under-construction" },
          ]
      : language === "th"
        ? [
            { name: "คณิตศาสตร์", href: "/under-construction" },
            { name: "ฟิสิกส์", href: "/under-construction" },
            { name: "เคมี", href: "/under-construction" },
            { name: "การแข่งขัน", href: "/under-construction" },
            { name: "คำคม", href: "/under-construction" },
          ]
      : language === "id"
        ? [
            { name: "Matematika", href: "/under-construction" },
            { name: "Fisika", href: "/under-construction" },
            { name: "Kimia", href: "/under-construction" },
            { name: "Kompetisi", href: "/under-construction" },
            { name: "Kutipan", href: "/under-construction" },
          ]
      : language === "ko"
        ? [
            { name: "수학", href: "/under-construction" },
            { name: "물리", href: "/under-construction" },
            { name: "화학", href: "/under-construction" },
            { name: "대회", href: "/under-construction" },
            { name: "명언", href: "/under-construction" },
          ]
      : [
            { name: "背東西", href: "/recitation" },
            { name: "國文", href: "/chinese" },
            { name: "英文", href: "/english" },
            { name: "公職考試", href: "/公職考試" },
            { name: "名言佳句", href: "/quote" },
            { name: "綜合", href: "/綜合" },
            { name: "比賽", href: "/under-construction" },
            { name: "撩語錄", href: "/under-construction" },
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

  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return subjects;
    const rangePattern = /^\d+\s*-\s*\d+$/;
    const searchPool = [...subjects, ...childSubjects].filter((subject) => !rangePattern.test(subject.name.trim()));
    const subjectMatches = searchPool.filter((subject) => subject.name.toLowerCase().includes(q));
    const unique = new Map<string, { name: string; href: string }>();

    for (const item of subjectMatches) {
      unique.set(`${item.name}::${item.href}`, item);
    }

    for (const item of articleMatches) {
      unique.set(`${item.name}::${item.href}`, item);
    }

    return Array.from(unique.values());
  }, [subjects, childSubjects, subjectQuery, articleMatches]);

  useEffect(() => {
    // Fetch categories
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => setLoadedCategories(data.categories || []))
      .catch((err) => console.error("Failed to fetch categories:", err));

    // global stats moved to /stats page
  }, []);

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      {/* ...existing code... */}
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
          <p className="max-w-md text-lg leading-8 zen-subtle">sapiens.camp</p>
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
                {filteredSubjects.map((subject) => (
                  <div key={subject.name} style={{ position: "relative" }}>
                    <Link
                      href={subject.href}
                      className="book-link bookshelf-btn"
                      data-title={subject.name}
                      data-href={subject.href}
                    >
                      {subject.name}
                    </Link>
                  </div>
                ))}
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
            <img src="/icons/speaker.png" alt="Speaker Icon" />
            {/* 音樂提示隨語言切換 */}
            <MusicTip />
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
  const [siteTitle, setSiteTitle] = useState("智人題庫");
  const [isSimplified, setIsSimplified] = useState(false);
  const [language, setLanguage] = useState("zh-TW");

  useEffect(() => {
    const syncTitle = () => {
      const language = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(language);
      setIsSimplified(language === "zh-CN");
      setSiteTitle(language === "zh-CN" ? "智人题库" : "智人題庫");
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
            <p className="max-w-md text-lg leading-8 zen-subtle">sapiens.camp</p>

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
                      { name: "名言佳句", href: "/quote" },
                      { name: "综合", href: "/綜合" },
                      { name: "撩语录", href: "/under-construction" },
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
                      { name: "名言佳句", href: "/quote" },
                      { name: "綜合", href: "/綜合" },
                      { name: "撩語錄", href: "/under-construction" },
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
                            { name: "名言佳句", href: "/quote" },
                            { name: "综合", href: "/綜合" },
                            { name: "撩语录", href: "/under-construction" },
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
                            { name: "名言佳句", href: "/quote" },
                            { name: "綜合", href: "/綜合" },
                            { name: "撩語錄", href: "/under-construction" },
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
              alt="sapiens.camp logo"
              className="w-10 h-10 object-contain"
            />
          </div>

          {/* Fixed speaker icon at bottom left */}
          <div className="fixed left-6 bottom-6 z-50 group">
            <img
              src="/public/icons/unnamed__1_-removebg-preview.png"
              alt="Speaker icon"
              className="w-10 h-10 object-contain cursor-pointer"
            />
            <span className="absolute left-12 top-1/2 -translate-y-1/2 bg-zinc-900 text-white text-xs rounded px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-lg border border-zinc-700">
              <MusicTip />
            </span>
          </div>
        </main>
      </div>
    }>
      <HomeContent categories={[]} siteTitle={siteTitle} isSimplified={isSimplified} language={language} />
    </Suspense>
  );
}
