import type { Metadata } from "next";
import { Geist, Noto_Serif_TC } from "next/font/google";
import "./globals.css";
import PersonalMenu from "./components/PersonalMenu";

import Providers from "./providers/SessionProvider";
import LanguageGate from "./components/LanguageGate";
import PWARegister from "./components/PWARegister";
import RotatePrompt from "./components/RotatePrompt";
import PullToRefresh from "./components/PullToRefresh";
import ThemeWatcher from "./components/ThemeWatcher";
import { Analytics } from "@vercel/analytics/next";
import "./speaker-icon.css";
// ...existing code...

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const notoSerif = Noto_Serif_TC({
  variable: "--font-zen-serif",
  subsets: ["latin"],
});

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || "default";
const FAVICON = `/icons/favicon.png?v=${BUILD_ID}`;

export const metadata: Metadata = {
  title: {
    default: "Exam",
    template: "%s — Exam",
  },
  description: "多方位測驗平台",
  metadataBase: new URL("https://exam.farm"),
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: FAVICON, type: "image/png" }],
    shortcut: [{ url: FAVICON, type: "image/png" }],
    apple: [{ url: FAVICON, type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Exam",
    title: "Exam",
    description: "多方位測驗平台",
    locale: "zh_TW",
  },
  twitter: {
    card: "summary_large_image",
    title: "Exam",
    description: "多方位測驗平台",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'&&t!=='system')t='system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${notoSerif.variable} antialiased`}
      >
        <Providers>
          <ThemeWatcher />
          <aside className="flex fixed right-4 top-4 z-[60] flex-row items-center gap-2">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
              <PersonalMenu />
            </div>
          </aside>

          <PWARegister />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "Exam",
                "url": "https://exam.farm",
              }),
            }}
          />
          <div id="main-content">
            <LanguageGate>{children}</LanguageGate>
          </div>
          <PullToRefresh />
          <RotatePrompt />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
