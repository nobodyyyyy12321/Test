"use client";

import Link from "next/link";

export default function MathIndex() {
  const mathTopics = [
    { name: "學測", href: "/math/學測" },
    { name: "算數" },
    { name: "代數" },
    { name: "幾何" },
    { name: "三角函數" },
    { name: "指數與複數" },
    { name: "解析幾何" },
    { name: "統計" },
    { name: "排列組合" },
    { name: "微積分" },
    { name: "微分方程" },
    { name: "線性代數" },
    { name: "複變函數" },
  ];

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black text-center">
        <h1 className="max-w-xs text-4xl font-bold zen-title">數學</h1>
        
        <div className="mt-8 w-full max-w-3xl">
          <div className="bookshelf-scroll">
            <div className="bookshelf-grid">
              {mathTopics.map((topic) => (
                <Link
                  key={topic.name}
                  href={topic.href || "/under-construction"}
                  className="book-link"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
