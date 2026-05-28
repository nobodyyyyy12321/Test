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

type Props = { language: string };

export default function PersonalMenu({ language }: Props) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  const uiLang = normalizeProfileLanguage(language);
  const t = (k: Parameters<typeof getProfileText>[1]) => getProfileText(uiLang, k);

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

  // close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="menu"
        aria-expanded={open}
        className="fixed top-6 left-4 sm:left-6 z-[60] inline-flex items-center justify-center w-10 h-10 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        style={{ color: "var(--zen-ink)", backgroundColor: "transparent" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22" height="22" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="3" y1="6"  x2="21" y2="6"  />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <aside
        ref={drawerRef}
        className={`fixed left-0 top-0 h-screen w-56 max-w-[60vw] z-50 overflow-y-auto transition-opacity duration-150 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        <div className="h-[60px]" />
        <nav className="flex flex-col py-2">
          {isAuthed ? (
            <>
              {tabs.map(tab => (
                <Link
                  key={tab.id}
                  href={tabHref(tab.id)}
                  onClick={() => setOpen(false)}
                  className="text-left px-4 py-2.5 text-sm transition-colors hover:opacity-100"
                  style={{ color: "var(--zen-ink)", opacity: 0.7 }}
                >
                  {tab.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => { setOpen(false); signOut({ callbackUrl: "/" }); }}
                className="text-left px-4 py-2.5 text-sm transition-colors"
                style={{ color: "#b19739", opacity: 0.85, fontWeight: 400 }}
              >
                {t("signOut")}
              </button>
            </>
          ) : (
            <Link
              href="/auth/login"
              onClick={() => setOpen(false)}
              className="text-left px-4 py-2.5 text-sm transition-colors"
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
