"use client";

import React, { useEffect, useState, Suspense } from "react";
// 匯入 HomeContent，它是顯示核心
import { HomeContent } from "./components/HomeContent";

// 3. Loading 狀態保留
function LoadingState({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black font-sans">
      <main className="flex w-full max-w-3xl flex-col items-center py-20 px-16">
        <h1 className="text-4xl font-bold">{title}</h1>
        <div className="mt-20 animate-pulse text-zinc-300">Loading...</div>
      </main>
    </div>
  );
}

export default function Home() {
  const [language, setLanguage] = useState("zh-TW");
  const siteTitle = "Test"; // 固定標題

  // 1. 管理語系同步邏輯
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

  return (
    <Suspense fallback={<LoadingState title={siteTitle} />}>
      {/* 核心修正：加上 key={language}
         這會確保當語言改變時，HomeContent 會被「完全銷毀並重新掛載」，
         從而徹底解決所有狀態（如 openCategory）沒收合的問題。
      */}
      <HomeContent 
        key={language} 
        language={language} 
      />
    </Suspense>
  );
}