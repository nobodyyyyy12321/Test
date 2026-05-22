"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

type LanguageCode = "zh-TW" | "zh-CN" | "en" | "es" | "th" | "id" | "ko";

const LANGUAGES: { value: LanguageCode; label: string }[] = [
  { value: "zh-TW", label: "中文繁體" },
  // { value: "zh-CN", label: "中文简体" },
  { value: "en", label: "English" },
  // { value: "es", label: "Español" },
  // { value: "th", label: "ไทย" },
  // { value: "id", label: "Bahasa Indonesia" },
  // { value: "ko", label: "한국어" },
];

const GLOBE_COLOR = "#b19739";

export default function LanguageSelector() {
  // TODO: re-enable after zh-TW features are done
  const [language, setLanguage] = useState<LanguageCode>("zh-TW");
  //return null;
  const [isOpen, setIsOpen] = useState(false);
  const [domMounted, setDomMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const stored = (localStorage.getItem("siteLanguage") as LanguageCode | null) ?? "zh-TW";
    setLanguage(stored);
  }, []);

  useEffect(() => {
    setDomMounted(true);
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
    router.push("/");
  }

  const currentIndex = LANGUAGES.findIndex((l) => l.value === language);
  const currentLabel = LANGUAGES[currentIndex]?.label ?? language;

  return (
    <div className="relative" ref={menuRef}>
      {/* 觸發按鈕（桌機＋手機共用） */}
      <button
        className="p-0 rounded-md text-sm inline-flex items-center justify-center"
        style={{ backgroundColor: "var(--zen-bg)", color: GLOBE_COLOR }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="語言選擇"
        title={currentLabel}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5 transition-transform duration-200 hover:scale-[1.15]"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14 14 0 0 0 0 18" />
          <path d="M12 3a14 14 0 0 1 0 18" />
        </svg>
        <span className="sr-only">{currentLabel}</span>
      </button>

      {/* 桌機：向下展開 */}
      {isOpen && (
        <div className="hidden sm:block absolute left-full top-0 ml-2 w-44 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
          {LANGUAGES.map((l, i) => (
            <button
              key={l.value}
              onClick={() => handleLanguageChange(l.value)}
              className={`w-full text-left px-4 py-2.5 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${i < LANGUAGES.length - 1 ? 'border-b border-zinc-100 dark:border-zinc-800' : ''} ${language === l.value ? 'font-semibold' : 'font-normal'}`}
              style={{ color: "var(--zen-ink)" }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* 手機：頂部下滑 action sheet（Threads 風格，由上向下展開） */}
      {domMounted && createPortal(
        <>
          <div
            className={`sm:hidden fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={`sm:hidden fixed top-0 left-0 right-0 z-[80] rounded-b-2xl bg-zinc-100 dark:bg-zinc-950 transition-transform duration-300 ${isOpen ? 'translate-y-0' : '-translate-y-full'}`}
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
          >
            <div className="px-3 pt-3">
              <div className="rounded-2xl overflow-hidden bg-white dark:bg-zinc-800">
                {LANGUAGES.map((l, i) => (
                  <button
                    key={l.value}
                    onClick={() => handleLanguageChange(l.value)}
                    className={`w-full text-left px-5 py-4 text-base ${i < LANGUAGES.length - 1 ? 'border-b border-zinc-200 dark:border-zinc-700' : ''} ${language === l.value ? 'font-semibold' : 'font-normal'}`}
                    style={{ color: "var(--zen-ink)" }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-9 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
