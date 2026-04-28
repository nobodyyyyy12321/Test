import zhTW from "../../public/locale/zh-TW.js";
import type { CategoryNode } from "./CategoryNode";

type LevelEntry = { name: string; levels: number[] };
const SIMPLE_LABELS: Record<string, string> = {};
const LEVEL_LABELS: Record<string, LevelEntry[]> = {};

(function buildLabels() {
  const nodes = zhTW as CategoryNode[];
  function parseHref(href: string) {
    const m = href.match(/^\/test\/([^?]+)(?:\?levels=(.+))?/);
    if (!m) return null;
    return { id: m[1], levels: m[2] ? m[2].split(",").map(Number) : [] };
  }
  for (const node of nodes) {
    if (node.href) {
      const p = parseHref(node.href);
      if (p && !SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
    }
    if (node.children) {
      for (const child of node.children) {
        if (!child.href) continue;
        const p = parseHref(child.href);
        if (!p) continue;
        if (p.levels.length > 0) {
          (LEVEL_LABELS[p.id] = LEVEL_LABELS[p.id] ?? []).push({ name: child.name, levels: p.levels });
          if (!SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
        } else if (!SIMPLE_LABELS[p.id]) {
          SIMPLE_LABELS[p.id] = child.name;
        }
      }
    }
  }
})();

export function getCollectionLabel(collectionId: string, level?: number | null): string {
  if (level != null && LEVEL_LABELS[collectionId]) {
    const match = LEVEL_LABELS[collectionId].find(e => e.levels.includes(level));
    if (match) return match.name;
  }
  return SIMPLE_LABELS[collectionId] ?? collectionId;
}
