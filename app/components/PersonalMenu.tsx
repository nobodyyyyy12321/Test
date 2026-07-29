"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getProfileText, normalizeProfileLanguage } from "../lib/i18n/profile";
import ShareButton from "./ShareButton";
import SearchButton from "./SearchButton";

type Tab =
  | "lists"
  | "profile"
  | "record"
  | "assignments"
  | "upload"
  | "groups"
  | "gallery"
  | "followers"
  | "following"
  | "settings";

// Single-segment paths that are NOT profile pages (i.e. `/<seg>` is some other
// app route). Anything else of the form `/<seg>` is treated as `/[name]`.
const NON_PROFILE_ROOTS = new Set([
  "admin",
  "api",
  "auth",
  "collections",
  "jsxgraph",
  "lists",
  "recitation",
  "test",
  "under-construction",
  "upload",
]);

const LANGUAGES: { value: string; label: string }[] = [
  { value: "zh-TW", label: "中文繁體" },
  { value: "en", label: "English" },
];

export default function PersonalMenu() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("zh-TW");
  const [langPickerOpen, setLangPickerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    try {
      localStorage.setItem("siteLanguage", value);
      document.cookie = `siteLanguage=${value}; path=/; max-age=31536000`;
    } catch {}
    window.dispatchEvent(new Event("site-language-change"));
    setLangPickerOpen(false);
    setOpen(false);
    router.push("/");
  };

  const uiLang = normalizeProfileLanguage(language);
  const t = (k: Parameters<typeof getProfileText>[1]) => getProfileText(uiLang, k);

  // Detect site language from cookie/localStorage; re-read when a
  // `site-language-change` event fires.
  useLayoutEffect(() => {
    const fromCookie = document.cookie.match(/(?:^|;\s*)siteLanguage=([^;]+)/)?.[1];
    const fromStorage = localStorage.getItem("siteLanguage");
    const lang = fromCookie ?? fromStorage ?? "zh-TW";
    setLanguage(lang);
  }, []);
  useEffect(() => {
    const onChange = () => {
      const fromCookie = document.cookie.match(/(?:^|;\s*)siteLanguage=([^;]+)/)?.[1];
      const fromStorage = localStorage.getItem("siteLanguage");
      setLanguage(fromCookie ?? fromStorage ?? "zh-TW");
    };
    window.addEventListener("site-language-change", onChange);
    return () => window.removeEventListener("site-language-change", onChange);
  }, []);

  // Hydrate name from localStorage cache before paint to avoid stale JWT name.
  useLayoutEffect(() => {
    const cached = localStorage.getItem("displayName");
    if (cached) setDisplayName(cached);
  }, []);

  // Refresh from /api/user/profile whenever session lands or another component
  // emits `profile:updated` (e.g. ProfileClient after a rename).
  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const res = await fetch("/api/user/profile");
        if (!res.ok) return;
        const j = await res.json();
        if (j?.ok && mounted && j.user?.name) {
          setDisplayName(j.user.name);
          localStorage.setItem("displayName", j.user.name);
        }
      } catch {
        // ignore
      }
    }
    if (session?.user) loadProfile();
    const onUpdated = () => loadProfile();
    window.addEventListener("profile:updated", onUpdated);
    return () => {
      mounted = false;
      window.removeEventListener("profile:updated", onUpdated);
    };
  }, [session]);

  const sessionName = (session?.user as { name?: string } | undefined)?.name ?? null;
  const myName = displayName ?? sessionName;

  // Detect whether the current path is a profile page: `/[name]`,
  // `/[name]/followers`, or `/[name]/following`.
  const pathname = usePathname() ?? "/";
  const profileNameOnPage = (() => {
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length === 0) return null;
    const first = decodeURIComponent(segs[0]);
    if (NON_PROFILE_ROOTS.has(first)) return null;
    if (segs.length === 1) return first;
    const PROFILE_SUB_ROUTES = new Set(["followers", "following"]);
    if (segs.length === 2 && PROFILE_SUB_ROUTES.has(segs[1])) return first;
    return null;
  })();

  // The menu navigates within whichever profile is currently in view; on any
  // non-profile page, it falls back to navigating within "my" profile.
  const targetName = profileNameOnPage ?? myName;
  const isViewingOwnProfile = !!targetName && !!myName && targetName === myName;
  const isAuthed = status === "authenticated" && !!myName;
  // Show owner-only tabs only when the viewer owns the target profile (or
  // the target IS the viewer because we're off a profile page entirely).
  const showOwnerTabs = isAuthed && (profileNameOnPage === null || isViewingOwnProfile);

  // close on Esc or outside-click
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (drawerRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const tabHref = (tab: Tab): string => {
    if (!targetName) return "/auth/login";
    const enc = encodeURIComponent(targetName);
    if (tab === "followers") return `/${enc}/followers`;
    if (tab === "following") return `/${enc}/following`;
    return `/${enc}?tab=${tab}`;
  };

  // Tabs visible to *any* viewer (owner or visitor) of a profile page.
  const visitorTabs: { id: Tab; label: string }[] = isAuthed
    ? [
        { id: "lists",       label: t("tabLists") },
        { id: "profile",     label: t("tabProfile") },
      ]
    : [];

  // Extra tabs only shown when the viewer is the owner of the target profile
  // (or when there's no target profile in view, i.e. we're on the homepage).
  const ownerOnlyTabs: { id: Tab; label: string }[] = showOwnerTabs
    ? [
        { id: "record",      label: t("tabRecord") },
        { id: "assignments", label: t("tabAssignOutbox") },
        { id: "upload",      label: t("uploadQuestions") },
        { id: "groups",      label: t("tabGroups") },
        { id: "gallery",     label: t("tabGallery") },
        { id: "settings",    label: t("tabSettings") },
      ]
    : [];

  const tabs = [...visitorTabs, ...ownerOnlyTabs];

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="menu"
        aria-expanded={open}
        className="flex items-center justify-center transition-opacity hover:opacity-70"
        style={{ color: "var(--zen-ink)", backgroundColor: "transparent" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="26" height="26" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside
        ref={drawerRef}
        className={`fixed z-50 overflow-y-auto transition-opacity duration-75 max-h-[70vh] shadow-lg rounded-lg
          right-0 top-20 w-48 max-w-[80vw]
          sm:w-56 sm:max-w-[60vw] ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ backgroundColor: "var(--zen-bg)" }}
        aria-hidden={!open}
      >
        <nav className="flex flex-col py-2">
          {/* utility icons: home / share / search / language */}
          <div className="flex items-center gap-5 px-4 py-4 sm:py-2.5">
            <Link href="/" aria-label="home" onClick={() => setOpen(false)} className="flex items-center justify-center transition-opacity hover:opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </Link>
            <ShareButton />
            <SearchButton />
            <button
              type="button"
              onClick={() => setLangPickerOpen(v => !v)}
              aria-label="語言選擇"
              aria-expanded={langPickerOpen}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3a14 14 0 0 0 0 18" />
                <path d="M12 3a14 14 0 0 1 0 18" />
              </svg>
            </button>
          </div>

          {isAuthed ? (
            <>
              {tabs.map(tab => (
                <Link
                  key={tab.id}
                  href={tabHref(tab.id)}
                  onClick={() => setOpen(false)}
                  className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  style={{ color: "var(--zen-ink)", opacity: 0.7 }}
                >
                  {tab.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  try {
                    localStorage.removeItem("avatarUrl");
                    localStorage.removeItem("displayName");
                  } catch {}
                  signOut({ callbackUrl: "/" });
                }}
                className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "#b19739", opacity: 0.85, fontWeight: 400 }}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "var(--zen-ink)", opacity: 0.85 }}
              >
                {uiLang === "en" ? "Sign In" : "登入"}
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setOpen(false)}
                className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "var(--zen-ink)", opacity: 0.85 }}
              >
                {uiLang === "en" ? "Sign Up" : "註冊"}
              </Link>
            </>
          )}
        </nav>
      </aside>

      {langPickerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
          onClick={() => setLangPickerOpen(false)}
        >
          <div
            className="relative w-full max-w-xs mx-4 rounded-xl shadow-xl overflow-hidden"
            style={{ backgroundColor: "var(--zen-paper)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-lg font-medium" style={{ color: "var(--zen-ink)" }}>
                {uiLang === "en" ? "Language" : "語言"}
              </span>
              <button
                type="button"
                onClick={() => setLangPickerOpen(false)}
                aria-label="close"
                className="text-lg leading-none"
                style={{ color: "var(--zen-ink)" }}
              >
                ×
              </button>
            </div>
            <div className="flex flex-col py-1">
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => handleLanguageChange(l.value)}
                  className="text-left px-5 py-3 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  style={{
                    color: "var(--zen-ink)",
                    fontWeight: language === l.value ? 600 : 400,
                    opacity: language === l.value ? 1 : 0.75,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
