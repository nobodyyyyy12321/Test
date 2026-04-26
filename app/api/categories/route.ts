import { NextResponse } from "next/server";
import { getArticles } from "../../../lib/articles-supabase";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const language = url.searchParams.get("language");

    const articles = await getArticles();

    const languages = Array.from(
      new Set(articles.map((a) => (a.language ? a.language : "中文")))
    );

    let filtered = articles;
    if (language) {
      filtered = articles.filter((a) => (a.language ? a.language : "中文") === language);
    }

    const categories = Array.from(
      new Set(filtered.map((a) => a.category || a.type || "uncategorized"))
    );

    // Order categories by historical/dynasty order when possible
    const eraOrder = [
      "先秦",
      "漢",
      "三國",
      "魏晉",
      "南北朝",
      "隋",
      "唐",
      "五代",
      "宋",
      "元",
      "明",
      "清",
      "民",
      "現代",
      "uncategorized",
    ];

    categories.sort((a, b) => {
      const ia = eraOrder.indexOf(a as string);
      const ib = eraOrder.indexOf(b as string);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return String(a).localeCompare(String(b), "zh-Hant");
    });

    return NextResponse.json({ categories, languages });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json({ categories: [], languages: [] });
  }
}
