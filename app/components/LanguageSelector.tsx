"use client";

import { useEffect, useState } from "react";

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

export default function LanguageSelector() {
  const [language, setLanguage] = useState<LanguageCode>("zh-TW");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("siteLanguage") as LanguageCode | null) ?? "zh-TW";
    setLanguage(stored);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("lang-menu-open");
    } else {
      document.body.classList.remove("lang-menu-open");
    }
    return () => {
      document.body.classList.remove("lang-menu-open");
    };
  }, [isOpen]);

  function handleLanguageChange(value: LanguageCode) {
    setLanguage(value);
    localStorage.setItem("siteLanguage", value);
    document.cookie = `siteLanguage=${value}; path=/; max-age=31536000`;
    window.dispatchEvent(new Event("site-language-change"));
    setIsOpen(false);
  }

  const currentLabel = LANGUAGES.find((l) => l.value === language)?.label ?? language;

  return (
    <>
      {/* 桌機：原生 select */}
      <select
        className="hidden sm:block p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm"
        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
        value={language}
        onChange={(e) => handleLanguageChange(e.target.value as LanguageCode)}
        aria-label="語言選擇"
      >
        {LANGUAGES.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>

      {/* 手機：按鈕觸發底部選單 */}
      <button
        className="sm:hidden p-2 rounded-md border border-zinc-200 dark:border-zinc-800 text-sm"
        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
        onClick={() => setIsOpen(true)}
        aria-label="語言選擇"
      >
        {currentLabel}
      </button>

      {/* 手機遮罩 */}
      <div
        className={`sm:hidden fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setIsOpen(false)}
      />

      {/* 手機底部上滑選單 */}
      <div
        className={`sm:hidden fixed bottom-0 left-0 right-0 z-[61] bg-zen-paper dark:bg-zinc-900 rounded-t-2xl shadow-xl transition-transform duration-300 ${isOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* 拖曳指示條 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        <div className="px-5 py-3 text-sm text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
          選擇語言
        </div>
        {LANGUAGES.map((l) => (
          <button
            key={l.value}
            onClick={() => handleLanguageChange(l.value)}
            className={`w-full text-left px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 ${language === l.value ? "font-semibold" : "font-normal"}`}
          >
            {l.label}
          </button>
        ))}
        <div className="pb-6" />
      </div>
    </>
  );
}
