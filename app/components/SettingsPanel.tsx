"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getStoredTheme, setTheme as setThemeMode, type ThemeMode, THEME_CHANGE_EVENT } from "../lib/theme";
import { getProfileText, normalizeProfileLanguage } from "../lib/i18n/profile";

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [themeMode, setThemeState] = useState<ThemeMode>("system");
  const [quizMode, setQuizModeState] = useState<"practice" | "formal">("practice");
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [language, setLanguage] = useState<string>("zh-TW");

  const uiLang = normalizeProfileLanguage(language);
  const t = (k: Parameters<typeof getProfileText>[1]) => getProfileText(uiLang, k);

  useEffect(() => {
    const fromCookie = document.cookie.match(/(?:^|;\s*)siteLanguage=([^;]+)/)?.[1];
    const fromStorage = localStorage.getItem("siteLanguage");
    setLanguage(fromCookie ?? fromStorage ?? "zh-TW");
    setThemeState(getStoredTheme());
    try {
      const stored = localStorage.getItem("quizMode");
      if (stored === "formal" || stored === "practice") setQuizModeState(stored);
    } catch {}
  }, []);

  useEffect(() => {
    const onChange = (e: Event) => {
      const m = (e as CustomEvent).detail?.mode as ThemeMode | undefined;
      if (m === "system" || m === "light" || m === "dark") setThemeState(m);
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let mounted = true;
    fetch("/api/auth/link-google/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (mounted && d) setGoogleLinked(!!d.linked); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [session]);

  const handleThemeChange = (m: ThemeMode) => {
    setThemeState(m);
    setThemeMode(m);
  };

  const handleQuizModeChange = (m: "practice" | "formal") => {
    setQuizModeState(m);
    try { localStorage.setItem("quizMode", m); } catch {}
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    try {
      const res = await fetch("/api/auth/link-google/start", { method: "POST" });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        if (j?.message === "already_linked") { setGoogleLinked(true); return; }
        return;
      }
      const { signIn } = await import("next-auth/react");
      await signIn("google", { callbackUrl: window.location.href });
    } finally {
      setLinkingGoogle(false);
    }
  };

  const sessionName = (session?.user as { name?: string } | undefined)?.name;
  const displayName = typeof window !== "undefined"
    ? (localStorage.getItem("displayName") ?? sessionName ?? "")
    : (sessionName ?? "");

  const selectClass = "w-full text-xs px-2 py-1.5 rounded border outline-none cursor-pointer transition-opacity hover:opacity-80";
  const buttonClass = "w-full text-xs px-2 py-1.5 rounded border outline-none cursor-pointer transition-opacity hover:opacity-80 disabled:opacity-50 text-left";
  const controlStyle = {
    borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
    background: "var(--zen-bg)",
    color: "var(--zen-ink)",
  } as const;

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        aria-label="back"
        className="flex items-center gap-2 px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
        style={{ color: "var(--zen-ink)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="font-medium">{t("tabSettings")}</span>
      </button>
      <div className="px-4 py-3 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--zen-ink)", opacity: 0.6 }}>{t("darkMode")}</label>
          <select value={themeMode} onChange={e => handleThemeChange(e.target.value as ThemeMode)}
            className={selectClass} style={controlStyle} aria-label={t("darkMode")}>
            <option value="system">{t("themeSystem")}</option>
            <option value="light">{t("themeLight")}</option>
            <option value="dark">{t("themeDark")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs" style={{ color: "var(--zen-ink)", opacity: 0.6 }}>{t("quizMode")}</label>
          <select value={quizMode} onChange={e => handleQuizModeChange(e.target.value as "practice" | "formal")}
            className={selectClass} style={controlStyle} aria-label={t("quizMode")}>
            <option value="practice">{t("quizModePractice")}</option>
            <option value="formal">{t("quizModeFormal")}</option>
          </select>
        </div>

        {googleLinked === true ? (
          <span className="text-xs" style={{ color: "var(--zen-ink)", opacity: 0.6 }}>{t("googleLinked")}</span>
        ) : (
          <button type="button" onClick={handleLinkGoogle} disabled={linkingGoogle}
            className={buttonClass} style={controlStyle}>
            {linkingGoogle ? t("linkingGoogle") : t("linkGoogle")}
          </button>
        )}

        {displayName && (
          <button
            type="button"
            onClick={() => { onClose(); router.push(`/${encodeURIComponent(displayName)}?tab=blocked`); }}
            className={buttonClass}
            style={controlStyle}
          >
            {t("blockedList")}
          </button>
        )}
      </div>
    </>
  );
}
