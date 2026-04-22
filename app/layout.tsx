import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC, Noto_Serif_TC } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthNav from "./components/AuthNav";
import Providers from "./providers/SessionProvider";
import LanguageGate from "./components/LanguageGate";
import PWARegister from "./components/PWARegister";
import GlobalUpOneLevelButton from "./components/GlobalUpOneLevelButton";
import MobileBottomBar from "./components/MobileBottomBar";
import ShareButton from "./components/ShareButton";
import { Analytics } from "@vercel/analytics/next";
import "./speaker-icon.css";
// ...existing code...

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_TC({
  variable: "--font-zen-serif",
  subsets: ["latin"],
});

const notoSerifSc = Noto_Serif_SC({
  variable: "--font-zen-serif-sc",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Test",
  description: "多方位測驗平台",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/favicon.png", type: "image/png" }],
    shortcut: [{ url: "/icons/favicon.png", type: "image/png" }],
    apple: [{ url: "/icons/favicon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSerif.variable} ${notoSerifSc.variable} antialiased`}
      >
        <Providers>
          <aside
            className="hidden sm:flex fixed left-0 top-0 bottom-0 z-40 w-24 flex-col items-center justify-center gap-8"
            style={{ backgroundColor: "var(--zen-bg)", borderRight: "1px solid color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}
          >
            <Link href="/" aria-label="回到首頁" className="inline-flex items-center justify-center w-14 h-12 rounded-xl transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </Link>
            <div className="flex items-center justify-center w-14 h-12 rounded-xl transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <AuthNav />
            </div>
            <div className="flex items-center justify-center w-14 h-12 rounded-xl transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <ShareButton />
            </div>
          </aside>

          <PWARegister />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Test",
                "url": "https://testtttt.io",
              }),
            }}
          />
          {/* ...existing code... */}
          {/* Hide GlobalUpOneLevelButton on feedback page */}
          {/* 只在非 /feedback 路徑顯示上一層按鈕，於伺服器端也正確隱藏 */}
          {typeof window === "undefined" || !(
            (typeof window !== "undefined" && window.location.pathname.startsWith("/feedback"))
          ) ? null : <GlobalUpOneLevelButton />}

          <div className="sm:pl-24">
            <LanguageGate>{children}</LanguageGate>
          </div>
          {/* 手機版底部列 */}
          <MobileBottomBar />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
