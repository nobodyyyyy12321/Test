// 這是 Next.js 首頁的主要組件，負責顯示主畫面與科目分類
"use client";
import React, { useEffect, useState, useMemo, Suspense } from "react";

// Next.js 路由與 hooks
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

import ShareIcon from "./components/ShareIcon";
import "./speaker-icon.css";
import MusicTip from "./components/MusicTip";
import type { CategoryNode } from "./components/CategoryNode";
import { useFilteredCategories } from "./components/useFilteredCategories";
import { CategoryButton } from "./components/CategoryButton";
import { HomeContent } from "./components/HomeContent";

import zhCNData from "../public/locale/zh-CN.json";
import esData from "../public/locale/es.json";
import thData from "../public/locale/th.json";
import idData from "../public/locale/id.json";
import koData from "../public/locale/ko.json";
import zhTWData from "../public/locale/zh-TW.json";
import enData from "../public/locale/en.json";


const locales: Record<string, CategoryNode[]> = {
  "zh-TW": zhTWData as CategoryNode[],
  "zh-CN": zhCNData as CategoryNode[],
  "en": enData as CategoryNode[],
  "es": esData as CategoryNode[],
  "th": thData as CategoryNode[],
  "id": idData as CategoryNode[],
  "ko": koData as CategoryNode[],
};


export const SUPPORTED_LOCALES = {
  "zh-TW": "繁體中文",
  "en": "English",
  "zh-CN": "简体中文",
  "es": "Español",
  "th": "ไทย",
  "id": "Bahasa Indonesia",
  "ko": "한국어",
};


// 搜尋文章的型別
type SearchArticle = {
  title?: string;
  author?: string;
  category?: string;
  number?: number;
};

type HomeContentProps = {
  categories: string[];
  siteTitle: string;
  language: string;
};

// 這是 Server Component，不需要加 "use client"


interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export function Page({ searchParams }: PageProps) {
  // 1. 從網址取得語系參數，例如 ?lang=en (預設為繁中)
  const language = (searchParams?.lang as string) || "zh-TW";
  
  // 2. 定義標題 (也可以根據語言變換)
  const siteTitle = language === "en" ? "Sapiens.camp" : "智人學園";
  
  // 3. (已移除 isSimplified 判斷)

  return (
    // 這裡直接呼叫你寫好的 HomeContent
    <HomeContent 
      language={language} 
      siteTitle={siteTitle} 
    />
  );
}

export default function Home() {
  const [language, setLanguage] = useState("zh-TW");


  // 1. 統一管理語系同步邏輯
  useEffect(() => {
    const syncSettings = () => {
      const lang = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(lang);

    };

    syncSettings();
    window.addEventListener("storage", syncSettings);
    window.addEventListener("site-language-change", syncSettings);
    return () => {
      window.removeEventListener("storage", syncSettings);
      window.removeEventListener("site-language-change", syncSettings);
    };
  }, []);

  // 2. 標題邏輯精簡化
  const siteTitle = "Test"; 

  return (
    <Suspense fallback={<LoadingState title={siteTitle}  />}>
      {/* 實際內容 */}
      <HomeContent 
        language={language} 
        siteTitle={siteTitle} 
      />
    </Suspense>
  );
}

// 3. 將 Loading 狀態抽離，避免主組件太臃腫
function LoadingState({ title }: { title: string}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center py-20 px-16">
        <h1 className={`text-4xl font-bold `}>
          {title}
        </h1>
        <div className="mt-20 animate-pulse text-zinc-300">Loading...</div>
      </main>
    </div>
  );
}