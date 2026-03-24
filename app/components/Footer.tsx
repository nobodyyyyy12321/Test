import React from "react";
import Link from "next/link";

interface FooterProps {
  language: string;
}

export function Footer({ language }: FooterProps) {
  // 根據語系定義文字
  const feedbackLabels: Record<string, string> = {
    en: "Feedback",
    "zh-CN": "意见反馈",
    es: "Retroalimentación",
    th: "ข้อเสนอแนะ",
    id: "Masukan",
    ko: "피드백",
    ru: "Обратная связь",
    "zh-TW": "意見回饋",
  };

  const label = feedbackLabels[language] || feedbackLabels["zh-TW"];

  return (
    <footer className="w-full mt-auto pt-16 pb-12 flex flex-col items-center justify-center gap-6 relative">
      {/* 裝飾線或間隔 (可選) */}
      <div className="w-12 h-[1px] bg-zinc-200 dark:bg-zinc-800 mb-4" />

      <div className="flex items-center justify-center gap-6">
        {/* 音樂圖示區塊 */}
        <div className="speaker-icon group relative cursor-help">
          <img 
            src="/speaker.png" 
            alt="Speaker Icon" 
            className="w-5 h-5 opacity-50 hover:opacity-100 transition-opacity"
          />
          {/* 如果你有 MusicTip 組件，放這裡 */}
          {/* <MusicTip /> */}
        </div>

        {/* 意見回饋連結 */}
        <Link
          href="/feedback"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
        >
          {label}
        </Link>
      </div>

      {/* 版權或標語 */}

    </footer>
  );
}