"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getProfileText, normalizeProfileLanguage } from "../lib/i18n/profile";
import SharePanel from "./SharePanel";
import SettingsPanel from "./SettingsPanel";

type ProfileRoute =
  | "lists"
  | "profile"
  | "record"
  | "assignments"
  | "upload";

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
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [settingsPanelOpen, setSettingsPanelOpen] = useState(false);
  const subOpen = langPickerOpen || sharePanelOpen || settingsPanelOpen;
  const closeAllSubs = () => { setLangPickerOpen(false); setSharePanelOpen(false); setSettingsPanelOpen(false); };
  const openLang = () => { closeAllSubs(); setLangPickerOpen(true); };
  const openShare = () => { closeAllSubs(); setSharePanelOpen(true); };
  const openSettings = () => { closeAllSubs(); setSettingsPanelOpen(true); };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchUsers, setSearchUsers] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [searchCats, setSearchCats] = useState<{ id: string; name: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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

  // Debounced search for users + categories (same endpoints as SearchModal).
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!searchOpen) return;
    if (!searchQuery.trim()) {
      setSearchUsers([]);
      setSearchCats([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchDebounceRef.current = setTimeout(() => {
      Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`).then(r => r.json()).catch(() => ({ users: [] })),
        fetch(`/api/search/categories?q=${encodeURIComponent(searchQuery.trim())}&language=${encodeURIComponent(language)}`).then(r => r.json()).catch(() => ({ results: [] })),
      ]).then(([u, c]) => {
        setSearchUsers(u.users ?? []);
        setSearchCats((c.results ?? []).map((r: { id: string; name: string }) => ({ id: r.id, name: r.name })));
      }).finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [searchQuery, searchOpen, language]);

  // Focus the search input when it opens; clear results on close.
  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
      setSearchUsers([]);
      setSearchCats([]);
    }
  }, [searchOpen]);

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
  const isAuthed = status === "authenticated" && !!myName;

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

  // Reset sub-views when the drawer closes so the next open shows the main view.
  useEffect(() => {
    if (!open) {
      setLangPickerOpen(false);
      setSharePanelOpen(false);
      setSettingsPanelOpen(false);
      setSearchOpen(false);
    }
  }, [open]);

  const routeHref = (route: ProfileRoute): string => {
    if (!myName) return "/auth/login";
    const enc = encodeURIComponent(myName);
    if (route === "profile") return `/${enc}`;
    return `/${enc}/${route}`;
  };

  // Links to the logged-in user's own account pages, regardless of whose
  // profile is currently being viewed.
  const profileLinks: { id: ProfileRoute; label: string }[] = isAuthed
    ? [
        { id: "lists",       label: t("tabLists") },
        { id: "profile",     label: t("tabProfile") },
        { id: "record",      label: t("tabRecord") },
        { id: "assignments", label: t("tabAssignOutbox") },
        { id: "upload",      label: t("uploadQuestions") },
      ]
    : [];

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
        className={`fixed z-50 overflow-x-hidden overflow-y-auto transition-opacity duration-75 max-h-[70vh] shadow-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800
          inset-x-0 bottom-0 top-auto rounded-t-2xl
          sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-20 sm:w-64 sm:max-w-[70vw] sm:rounded-lg ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div
          style={{ width: "200%" }}
          className={`flex transition-transform duration-200 ${subOpen ? "-translate-x-1/2" : ""}`}
        >
        <nav className="w-1/2 shrink-0 flex flex-col py-2">
          {/* inline search — appears above the icon row, pushes items down */}
          {searchOpen && (
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex flex-col gap-2">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={uiLang === "en" ? "Search subjects or accounts" : "搜尋科目或帳號"}
                className="w-full px-3 py-2 rounded-lg border text-sm outline-none"
                style={{
                  backgroundColor: "var(--zen-bg)",
                  color: "var(--zen-ink)",
                  borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
                }}
              />
              {searchQuery.trim() && (
                <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
                  {searchLoading && (
                    <p className="text-xs opacity-50 py-2 text-center" style={{ color: "var(--zen-ink)" }}>
                      {uiLang === "en" ? "Searching…" : "搜尋中…"}
                    </p>
                  )}
                  {!searchLoading && searchUsers.length === 0 && searchCats.length === 0 && (
                    <p className="text-xs opacity-50 py-2 text-center" style={{ color: "var(--zen-ink)" }}>
                      {uiLang === "en" ? "No results" : "沒有結果"}
                    </p>
                  )}
                  {searchUsers.map(u => (
                    <Link
                      key={`u-${u.id}`}
                      href={`/${encodeURIComponent(u.name)}`}
                      onClick={() => { setSearchOpen(false); setOpen(false); }}
                      className="text-left px-2 py-1.5 text-sm rounded transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 truncate"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      @{u.name}
                    </Link>
                  ))}
                  {searchCats.map(c => (
                    <Link
                      key={`c-${c.id}`}
                      href={`/test/${encodeURIComponent(c.id)}`}
                      onClick={() => { setSearchOpen(false); setOpen(false); }}
                      className="text-left px-2 py-1.5 text-sm rounded transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700 truncate"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* utility icons: home / share / search / language */}
          <div className="flex items-center justify-center gap-4 px-4 py-4 sm:py-2.5">
            <Link href="/" aria-label="home" onClick={() => setOpen(false)} className="flex items-center justify-center transition-opacity hover:opacity-70">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
                <path d="M9 21V12h6v9" />
              </svg>
            </Link>
            <button
              type="button"
              onClick={() => sharePanelOpen ? setSharePanelOpen(false) : openShare()}
              aria-label="分享"
              aria-expanded={sharePanelOpen}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ opacity: sharePanelOpen ? 1 : undefined }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/>
                <circle cx="6" cy="12" r="3"/>
                <circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(v => !v)}
              aria-label="搜尋"
              aria-expanded={searchOpen}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ opacity: searchOpen ? 1 : undefined }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => langPickerOpen ? setLangPickerOpen(false) : openLang()}
              aria-label="語言選擇"
              aria-expanded={langPickerOpen}
              className="flex items-center justify-center transition-opacity hover:opacity-70"
              style={{ opacity: langPickerOpen ? 1 : undefined }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18" />
                <path d="M12 3a14 14 0 0 0 0 18" />
                <path d="M12 3a14 14 0 0 1 0 18" />
              </svg>
            </button>
            {isAuthed && (
              <button
                type="button"
                onClick={() => settingsPanelOpen ? setSettingsPanelOpen(false) : openSettings()}
                aria-label={t("tabSettings")}
                title={t("tabSettings")}
                aria-expanded={settingsPanelOpen}
                className="flex items-center justify-center transition-opacity hover:opacity-70"
                style={{ opacity: settingsPanelOpen ? 1 : undefined }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}
          </div>

          {isAuthed ? (
            <div className="grid grid-cols-2">
              {profileLinks.map(link => (
                <Link
                  key={link.id}
                  href={routeHref(link.id)}
                  onClick={() => setOpen(false)}
                  className="text-center px-2 py-4 sm:py-2.5 text-sm transition-colors hover:opacity-100 hover:bg-zinc-200 dark:hover:bg-zinc-700 truncate"
                  style={{ color: "var(--zen-ink)", opacity: 0.7 }}
                >
                  {link.label}
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
                className="text-center px-2 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                style={{ color: "#b19739", opacity: 0.85, fontWeight: 400 }}
              >
                {t("signOut")}
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                style={{ color: "var(--zen-ink)", opacity: 0.85 }}
              >
                {uiLang === "en" ? "Sign In" : "登入"}
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setOpen(false)}
                className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                style={{ color: "var(--zen-ink)", opacity: 0.85 }}
              >
                {uiLang === "en" ? "Sign Up" : "註冊"}
              </Link>
            </>
          )}
        </nav>

        {/* sub-view pane — shows language OR share content based on which is open */}
        <div className="w-1/2 shrink-0 flex flex-col py-2">
          {langPickerOpen && (
            <>
              <button
                type="button"
                onClick={() => setLangPickerOpen(false)}
                aria-label="back"
                className="flex items-center gap-2 px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                style={{ color: "var(--zen-ink)" }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                <span className="font-medium">{uiLang === "en" ? "Language" : "語言"}</span>
              </button>
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => handleLanguageChange(l.value)}
                  className="text-left px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  style={{
                    color: "var(--zen-ink)",
                    fontWeight: language === l.value ? 600 : 400,
                    opacity: language === l.value ? 1 : 0.7,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </>
          )}
          {sharePanelOpen && (
            <SharePanel onClose={() => setSharePanelOpen(false)} />
          )}
          {settingsPanelOpen && (
            <SettingsPanel onClose={() => setSettingsPanelOpen(false)} />
          )}
        </div>
        </div>
      </aside>
    </>
  );
}
