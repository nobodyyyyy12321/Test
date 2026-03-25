import React from "react";
import Link from "next/link";
import MusicTip from "./MusicTip";
import { useEffect, useMemo, useState, Suspense, useRef } from "react";


interface FooterProps {
  language: string;
}


// --- 新增 SpeakerWithTip 元件 ---
function SpeakerWithTip() {
  const [show, setShow] = useState(false);
  return (
    <div
      className="speaker-icon relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{ display: "inline-block" }}
    >
      <img
        src="/speaker.png"
        alt="Speaker Icon"
        className=" opacity-50 hover:opacity-100 transition-opacity"
      />
      {show && (
        <div
          style={{
            position: "absolute",
            left: "100%",
            top: 0,
            marginLeft: "2px",
            pointerEvents: "none",
            zIndex: 50,
            whiteSpace: "nowrap"
          }}
        >
          <MusicTip />
        </div>
      )}
    </div>
  );
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
        <SpeakerWithTip />
        {/* 意見回饋連結 */}
        <Link
          href="/feedback"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800">
          {label}
        </Link>
      </div>

      {/* 版權或標語 */}

    </footer>
  );
}