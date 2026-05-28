"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getProfileText, normalizeProfileLanguage } from "../lib/i18n/profile";

type Tab =
  | "home"
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

export default function PersonalMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("zh-TW");
  const drawerRef = useRef<HTMLElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const uiLang = normalizeProfileLanguage(language);
  const t = (k: Parameters<typeof getProfileText>[1]) => getProfileText(uiLang, k);

  // Detect site language from cookie/localStorage; re-read when LanguageSelector
  // dispatches `site-language-change`.
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

  // Detect whether the current path is a profile page (`/[name]`). Single-
  // segment paths that aren't a known app route are profile pages.
  const pathname = usePathname() ?? "/";
  const profileNameOnPage = (() => {
    const segs = pathname.split("/").filter(Boolean);
    if (segs.length !== 1) return null;
    const first = decodeURIComponent(segs[0]);
    if (NON_PROFILE_ROOTS.has(first)) return null;
    return first;
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
    return `/${encodeURIComponent(targetName)}?tab=${tab}`;
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
        { id: "home",        label: uiLang === "en" ? "Home" : "首頁" },
        { id: "record",      label: t("tabRecord") },
        { id: "assignments", label: t("tabAssignOutbox") },
        { id: "upload",      label: t("uploadQuestions") },
        { id: "groups",      label: t("tabGroups") },
        { id: "gallery",     label: t("tabGallery") },
        { id: "followers",   label: t("tabFollowers") },
        { id: "following",   label: t("tabFollowing") },
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
        className={`fixed right-0 top-20 w-56 max-w-[60vw] z-50 overflow-y-auto transition-opacity duration-150 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ maxHeight: "calc(100vh - 5rem)" }}
        aria-hidden={!open}
      >
        <nav className="flex flex-col py-2">
          {isAuthed ? (
            <>
              {tabs.map(tab => (
                <Link
                  key={tab.id}
                  href={tabHref(tab.id)}
                  onClick={() => setOpen(false)}
                  className="text-left px-4 py-2.5 text-sm transition-colors hover:opacity-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  style={{ color: "var(--zen-ink)", opacity: 0.7 }}
                >
                  {tab.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "#b19739", opacity: 0.85, fontWeight: 400 }}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="text-left px-4 py-2.5 text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              style={{ color: "var(--zen-ink)", opacity: 0.85 }}
            >
              {uiLang === "en" ? "Sign In" : "登入"}
            </Link>
          )}
        </nav>
      </aside>
    </>
  );
}
