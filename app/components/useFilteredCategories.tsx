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



export function useFilteredCategories(language: string, query: string): CategoryNode[] {
  const filtered = useMemo(() => {
    // 強制轉型 (Type Assertion)，告訴 TS 這是 CategoryNode 陣列
    // 這樣它就不會覺得 enData 只是一個字串
    const allData = (language === "en" ? enData : zhTWData) as CategoryNode[];

    if (!query) return allData;

    const lowerQuery = query.toLowerCase();

    // 現在 .filter 絕對會存在了
    return allData.filter((parent) => {
      const matchParent = parent.name.toLowerCase().includes(lowerQuery);
      
      const matchChild = parent.children?.some((child) =>
        child.name.toLowerCase().includes(lowerQuery)
      );

      return matchParent || matchChild;
    });
  }, [language, query]);

  return filtered;
}