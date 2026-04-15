import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC, Noto_Serif_TC } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthNav from "./components/AuthNav";
import Providers from "./providers/SessionProvider";
import LanguageGate from "./components/LanguageGate";
import ShowLanguageSelectorOnHome from "./components/ShowLanguageSelectorOnHome";
import PWARegister from "./components/PWARegister";
import GlobalUpOneLevelButton from "./components/GlobalUpOneLevelButton";
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

          <header
              className="w-full py-2 sticky top-0 z-40"
              style={{ backgroundColor: "var(--zen-bg)", boxShadow: "none", borderBottom: "none" }}
            >
              <div className="w-full flex items-center flex-nowrap" style={{ minHeight: '28px' }}>
                {/* 左上角 home 圖示，桌機版顯示 */}
                <div className="hidden sm:block flex-shrink-0 pl-5">
                  <Link href="/" aria-label="回到首頁">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                      <path d="M9 21V12h6v9" />
                    </svg>
                  </Link>
                </div>
                <div className="flex-1" />
                <ShowLanguageSelectorOnHome />
                {/* 登入後顯示頭像與帳號名稱的元件 */}
                <AuthNav />
              </div>
            </header>

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

          <LanguageGate>{children}</LanguageGate>
        </Providers>

        {/* 手機版底部左下角房子圖示 */}
        <div className="block sm:hidden fixed bottom-5 left-5 z-50">
          <Link href="/" aria-label="回到首頁">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
              <path d="M9 21V12h6v9" />
            </svg>
          </Link>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
