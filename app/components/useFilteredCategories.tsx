import { useMemo } from "react";
import type { CategoryNode } from "./CategoryNode";

export function useFilteredCategories(categories: CategoryNode[], query: string): CategoryNode[] {
  return useMemo(() => {
    if (!query) return categories ?? [];
    const q = query.toLowerCase();
    const result: CategoryNode[] = [];
    for (const node of (categories ?? [])) {
      const parentMatch = node.name.toLowerCase().includes(q);
      const matchingChildren = node.children?.filter(c => c.name.toLowerCase().includes(q));
      if (parentMatch) {
        result.push(node);
      } else if (matchingChildren?.length) {
        result.push({ ...node, children: matchingChildren });
      }
    }
    return result;
  }, [categories, query]);
}
