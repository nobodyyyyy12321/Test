import { useMemo } from "react";
import { CategoryNode } from "@/app/components/CategoryNode";
// 匯入你的各語言 JSON 或 TS 資料
import zhTWData from "../../public/locale/zh-TW.json";
import enData from "../../public/locale/en.json";
import koData from "../../public/locale/ko.json";
import zhCNData from "../../public/locale/zh-CN.json";
import esData from "../../public/locale/es.json";
import thData from "../../public/locale/th.json";
import idData from "../../public/locale/id.json";

// 如果有其他語言... import koData from "@/data/ko.json";

/**
 * 專業的多語系與搜尋過濾 Hook
 * @param language 目前語系代碼 (例如: "zh-TW", "en")
 * @param query 搜尋關鍵字
 */
export function useFilteredCategories(language: string, query: string) {
  return useMemo(() => {
    // 1. 建立語系對照表 (Record)
    const allData: Record<string, CategoryNode[]> = {
      "zh-TW": zhTWData as CategoryNode[],
      "zh-CN": zhCNData as CategoryNode[], 
      "en": enData as CategoryNode[],
      "ko": koData as CategoryNode[],
      "es": esData as CategoryNode[],
      "th": thData as CategoryNode[],
       "id": idData as CategoryNode[],
    };

    // 2. 取得對應語系的原始資料 (若無匹配則預設繁中)
    const categories = allData[language] || allData["zh-TW"];

    // 3. 執行搜尋過濾邏輯
    const q = query.trim().toLowerCase();
    if (!q) return categories;

    return categories.filter((s) => 
      s.name.toLowerCase().includes(q)
    );
  }, [language, query]); // 當語言或搜尋字串改變時，才重新計算
}