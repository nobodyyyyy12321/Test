"use client";

import Link from "next/link";

export default function EnglishPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black text-center">
        <h1 className="max-w-xs text-4xl font-bold zen-title">英文</h1>

        <div className="mt-8 w-full max-w-3xl">
          <div className="bookshelf-scroll">
            <div className="bookshelf-grid">
              <Link href="/english/2000" className="book-link">
                2000單字
              </Link>
              <Link href="/english/學測" className="book-link">
                學測
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
