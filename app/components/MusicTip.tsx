"use client";
import React, { useEffect, useState } from "react";

const tipTexts: Record<string, string> = {
  "zh-TW": "推薦搭配一點音樂",
  "zh-CN": "推荐搭配一点音乐",
  "en": "Recommended: Enjoy some music",
  "es": "Recomendado: Escucha algo de música",
  "th": "แนะนำให้ฟังเพลงประกอบ",
  "id": "Disarankan: Dengarkan musik",
  "ko": "음악과 함께 추천합니다",
};

const MusicTip: React.FC = () => {
  const [language, setLanguage] = useState("zh-TW");

  useEffect(() => {
    const updateLanguage = () => {
      const lang = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(lang);
    };
    updateLanguage();
    window.addEventListener("site-language-change", updateLanguage);
    window.addEventListener("storage", updateLanguage);
    return () => {
      window.removeEventListener("site-language-change", updateLanguage);
      window.removeEventListener("storage", updateLanguage);
    };
  }, []);

  return <span className="speaker-tooltip">{tipTexts[language] || tipTexts["zh-TW"]}</span>;
};

export default MusicTip;
