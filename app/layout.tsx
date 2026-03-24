import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC, Noto_Serif_TC } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import AuthNav from "./components/AuthNav";
import Providers from "./providers/SessionProvider";
import { AudioPlayerProvider } from "./components/audio-player-context";
import VisitPing from "./components/VisitPing";
import LanguageGate from "./components/LanguageGate";
import ShowLanguageSelectorOnHome from "./components/ShowLanguageSelectorOnHome";
import PWARegister from "./components/PWARegister";
import BookshelfContextMenu from "./components/BookshelfContextMenu";
import GlobalUpOneLevelButton from "./components/GlobalUpOneLevelButton";
import { Analytics } from "@vercel/analytics/next";
import RecordPlayer from "./components/RecordPlayer";
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
  description: "多方位學習平台",
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
          {/* ...existing code... */}

          {/* 新 header：時間、計時器、語言選單、頭像同一橫排 */}
          <header
              className="w-full py-5 sticky top-0 z-40"
              style={{ backgroundColor: "var(--zen-bg)", boxShadow: "none", borderBottom: "none" }}
            >
              <VisitPing />
              <div className="w-full flex items-center flex-nowrap" style={{ minHeight: '56px' }}>
                {/* logo靠左 */}
                <div className="flex-shrink-0 pl-5">
                  <Link href="/" className="cursor-pointer group" aria-label="回到首頁">
                    <img
                      src="/logo-removebg-preview.png"
                      alt="Test logo"
                      className="w-14 h-14 object-contain transition-opacity group-hover:opacity-80"
                      style={{ background: "transparent" }}
                    />
                  </Link>
                </div>
                {/* 中間空白區或其他元件 */}
                <div className="flex-1" />
                <ShowLanguageSelectorOnHome />
              </div>
            </header>

          <PWARegister />
          <BookshelfContextMenu />
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
        <Analytics />
      </body>
    </html>
  );
}
