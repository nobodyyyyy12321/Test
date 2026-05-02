"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type LanguageCode = "zh-TW" | "zh-CN" | "en" | "es" | "ru";

const QUIZ_PREFIXES = [
  "/quote",
  "/english",
  "/study-chinese",
  "/math",
  "/recitation",
];

const RESERVED_ROOTS = new Set([
  "",
  "admin",
  "auth",
  "account",
  "advertise",
  "api",
  "stats",
  "under-construction",
  "sitemap.xml",
]);

function isQuizPath(pathname: string) {
  if (QUIZ_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return true;
  }

  const firstSegment = pathname.split("/").filter(Boolean)[0] ?? "";
  if (!firstSegment) return false;
  if (RESERVED_ROOTS.has(firstSegment)) return false;

  return true;
}

function isAllowedForLanguage(language: LanguageCode, pathname: string) {
  // 允許所有語言瀏覽 /feedback 和 /test（各語言有自己的題庫）
  if (pathname === "/feedback" || pathname.startsWith("/feedback/")) {
    return true;
  }
  if (pathname === "/test" || pathname.startsWith("/test/")) {
    return true;
  }
  if (language === "en") {
    if (pathname === "/study-chinese" || pathname.startsWith("/study-chinese/")) {
      return true;
    }
    if (["/math", "/physics", "/chemistry"].includes(pathname)) {
      return true;
    }
  }
  if (language === "es" || language === "ru") {
    if (["/math", "/physics", "/chemistry"].includes(pathname)) {
      return true;
    }
  }
  return false;
}

export default function LanguageGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [language, setLanguage] = useState<LanguageCode>("zh-TW");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const syncLanguage = () => {
      const stored = (localStorage.getItem("siteLanguage") as LanguageCode | null) ?? "zh-TW";
      setLanguage(stored);
    };

    syncLanguage();
    setMounted(true);

    window.addEventListener("storage", syncLanguage);
    window.addEventListener("site-language-change", syncLanguage);
    return () => {
      window.removeEventListener("storage", syncLanguage);
      window.removeEventListener("site-language-change", syncLanguage);
    };
  }, []);

  const blocked = useMemo(() => {
    if (!mounted) return false;
    if (language === "zh-TW") return false;
    if (isAllowedForLanguage(language, pathname || "/")) return false;
    return isQuizPath(pathname || "/");
  }, [mounted, language, pathname]);

  if (blocked) {
    router.replace("/under-construction");
    return null;
  }

  return <>{children}</>;
}
