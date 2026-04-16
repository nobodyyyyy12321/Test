import { useMemo } from "react";
import { CategoryNode } from "./CategoryNode";
import zhTW from "../../public/locale/zh-TW.js";
import en from "../../public/locale/en.js";
import ko from "../../public/locale/ko.js";
import zhCN from "../../public/locale/zh-CN.js";
import es from "../../public/locale/es.js";
import th from "../../public/locale/th.js";
import id from "../../public/locale/id.js";

const localeMap: Record<string, CategoryNode[]> = {
  "zh-TW": zhTW as CategoryNode[],
  en: en as CategoryNode[],
  "zh-CN": zhCN as CategoryNode[],
  ko: ko as CategoryNode[],
  es: es as CategoryNode[],
  th: th as CategoryNode[],
  id: id as CategoryNode[],
};

export function useFilteredCategories(language: string, query: string): CategoryNode[] {
  return useMemo(() => {
    const data = localeMap[language] ?? localeMap["zh-TW"];
    if (!query) return data;
    const q = query.toLowerCase();
    const result: CategoryNode[] = [];
    for (const node of data) {
      const parentMatch = node.name.toLowerCase().includes(q);
      const matchingChildren = node.children?.filter((c) =>
        c.name.toLowerCase().includes(q)
      );
      if (parentMatch) {
        result.push(node);
      } else if (matchingChildren?.length) {
        result.push({ ...node, children: matchingChildren });
      }
    }
    return result;
  }, [language, query]);
}
