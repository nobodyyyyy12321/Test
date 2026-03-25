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
    let allData: CategoryNode[];
    switch (language) {
      case "en":
        allData = enData as CategoryNode[];
        break;
      case "zh-TW":
        allData = zhTWData as CategoryNode[];
        break;
      case "zh-CN":
        allData = zhCNData as CategoryNode[];
        break;
      case "ko":
        allData = koData as CategoryNode[];
        break;
      case "es":
        allData = esData as CategoryNode[];
        break;
      case "th":
        allData = thData as CategoryNode[];
        break;
      case "id":
        allData = idData as CategoryNode[];
        break;
      default:
        allData = zhTWData as CategoryNode[];
    }

    if (!query) return allData;

    const lowerQuery = query.toLowerCase();

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