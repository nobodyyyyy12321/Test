"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function RecitationPage() {
    // 取得語言
    const [language, setLanguage] = useState("zh-TW");
    useEffect(() => {
      const syncLanguage = () => {
        const lang = localStorage.getItem("siteLanguage") || "zh-TW";
        setLanguage(lang);
      };
      syncLanguage();
      window.addEventListener("site-language-change", syncLanguage);
      return () => window.removeEventListener("site-language-change", syncLanguage);
    }, []);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const langRes = await fetch("/api/categories");
        const langData = await langRes.json();
        const languages: string[] = langData?.languages || [];

        const chineseLanguage =
          languages.find((lang) => /(中文|chinese|華語|国语|國語)/i.test(lang)) ||
          languages[0];

        if (!chineseLanguage) {
          if (mounted) setCategories([]);
          return;
        }

        const categoryRes = await fetch(`/api/categories?language=${encodeURIComponent(chineseLanguage)}`);
        const categoryData = await categoryRes.json();

        if (!mounted) return;
        setCategories(Array.isArray(categoryData?.categories) ? categoryData.categories : []);
      } catch (e) {
        if (mounted) setError("無法載入分類");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black text-center">
        <h1 className="max-w-xs text-4xl font-bold zen-title">
          {language === "en"
            ? "Recitation"
            : language === "zh-CN"
            ? "背东西"
            : language === "es"
            ? "Memorizar"
            : language === "th"
            ? "ท่องจำ"
            : language === "id"
            ? "Menghafal"
            : language === "ko"
            ? "암기하기"
            : language === "ru"
            ? "Заучивание"
            : "背東西"}
        </h1>

        <div className="mt-8 w-full max-w-3xl">
          {loading ? (
            <p className="text-sm zen-subtle">載入中…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : categories.length === 0 ? (
            <p className="text-sm zen-subtle">目前沒有分類</p>
          ) : (
            <div className="bookshelf-scroll">
              <div className="bookshelf-grid">
                {categories.map((category) => (
                  <Link key={category} href={`recitation/${encodeURIComponent(category)}`} className="book-link">
                    {category}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
