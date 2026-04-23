"use client";
import Link from "next/link";
import AuthNav from "./AuthNav";
import ShareButton from "./ShareButton";

export default function MobileBottomBar() {

  return (
    <div
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-8 pt-2 pb-4"
      style={{ backgroundColor: "var(--zen-bg)", borderTop: "1px solid color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
        <Link href="/" aria-label="回到首頁">
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
            <path d="M9 21V12h6v9" />
          </svg>
        </Link>
      </div>
      <div className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
        <ShareButton />
      </div>
      <div className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
        <AuthNav />
      </div>
    </div>
  );
}
