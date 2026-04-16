"use client";

import { useEffect, useRef, useState } from "react";

type LanguageCode = "zh-TW" | "zh-CN" | "en" | "es" | "th" | "id" | "ko";

const LANGUAGES: { value: LanguageCode; label: string }[] = [
  { value: "zh-TW", label: "中文繁體" },
  { value: "zh-CN", label: "中文简体" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "th", label: "ไทย" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ko", label: "한국어" },
];

const COLORS = ["#7aa8cc", "#5fa870"];

export default function LanguageSelector() {
  const [language, setLanguage] = useState<LanguageCode>("zh-TW");
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = (localStorage.getItem("siteLanguage") as LanguageCode | null) ?? "zh-TW";
    setLanguage(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleLanguageChange(value: LanguageCode) {
    setLanguage(value);
    localStorage.setItem("siteLanguage", value);
    document.cookie = `siteLanguage=${value}; path=/; max-age=31536000`;
    window.dispatchEvent(new Event("site-language-change"));
    setIsOpen(false);
  }

  const currentIndex = LANGUAGES.findIndex((l) => l.value === language);
  const currentColor = COLORS[currentIndex % 2];
  const currentLabel = LANGUAGES[currentIndex]?.label ?? language;

  return (
    <div className="relative" ref={menuRef}>
      {/* 觸發按鈕（桌機＋手機共用） */}
      <button
        className="p-2 rounded-md border text-sm"
        style={{ backgroundColor: "var(--zen-bg)", color: currentColor, borderColor: currentColor }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="語言選擇"
      >
        {currentLabel}
      </button>

      {/* 桌機：向下展開 */}
      {isOpen && (
        <div className="hidden sm:block absolute right-0 top-full mt-1 w-44 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
          {LANGUAGES.map((l, i) => (
            <button
              key={l.value}
              onClick={() => handleLanguageChange(l.value)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${i < LANGUAGES.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''} ${language === l.value ? 'font-semibold' : 'font-normal'}`}
              style={{ color: COLORS[i % 2] }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* 手機遮罩 */}
      <div
        className={`sm:hidden fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* 手機頂部下滑選單 */}
      <div
        className={`sm:hidden fixed top-0 left-0 right-0 z-[61] bg-zen-paper dark:bg-zinc-900 shadow-md transition-transform duration-300 ${isOpen ? 'translate-y-0' : '-translate-y-full'}`}
      >
        {LANGUAGES.map((l, i) => (
          <button
            key={l.value}
            onClick={() => handleLanguageChange(l.value)}
            className={`w-full text-left px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 ${i < LANGUAGES.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''} ${language === l.value ? 'font-semibold' : 'font-normal'}`}
            style={{ color: COLORS[i % 2] }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
