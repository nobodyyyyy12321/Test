"use client";

import Link from "next/link";

export default function EnglishXueCePage() {
  const years = Array.from({ length: 115 - 83 + 1 }, (_, index) => 83 + index);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black text-center">
        <h1 className="max-w-xs text-4xl font-bold zen-title">英文學測</h1>

        <div className="mt-8 w-full max-w-3xl">
          <div className="bookshelf-scroll">
            <div className="bookshelf-grid">
              {years.map((year) => (
                <Link key={year} href="/under-construction" className="book-link">
                  {year}
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
