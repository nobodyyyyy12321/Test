"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function SettingsMenu() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [domMounted, setDomMounted] = useState(false);
  const [quizMode, setQuizMode] = useState<"practice" | "formal">("practice");
  const [showModeModal, setShowModeModal] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [googleLinked, setGoogleLinked] = useState<boolean | null>(null);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const prevLoggedInRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const savedMode = localStorage.getItem("quizMode");
    if (savedMode === "formal" || savedMode === "practice") setQuizMode(savedMode);
    const cachedName = localStorage.getItem("displayName");
    if (cachedName) setDisplayName(cachedName);
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let mounted = true;
    fetch('/api/user/profile')
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.ok && j.user?.name && mounted) {
          setDisplayName(j.user.name);
          localStorage.setItem("displayName", j.user.name);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    let mounted = true;
    fetch('/api/auth/link-google/status')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j && mounted) setGoogleLinked(j.linked ?? null); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [session]);

  async function handleLinkGoogle() {
    setLinkingGoogle(true);
    try {
      const res = await fetch('/api/auth/link-google/start', { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j?.ok) {
        if (j?.message === 'already_linked') { setGoogleLinked(true); return; }
        return;
      }
      // Trigger Google OAuth — the signIn callback will complete the link.
      const { signIn } = await import('next-auth/react');
      await signIn('google', { callbackUrl: window.location.href });
    } finally {
      setLinkingGoogle(false);
    }
  }

  useEffect(() => {
    const loggedIn = !!session?.user;
    if (loggedIn && !prevLoggedInRef.current) {
      setQuizMode("practice");
      localStorage.setItem("quizMode", "practice");
    }
    prevLoggedInRef.current = loggedIn;
  }, [session]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  if (status === "loading" || !session?.user) return null;

  const selectMode = (m: "practice" | "formal") => {
    setQuizMode(m);
    localStorage.setItem("quizMode", m);
    setShowModeModal(false);
  };

  const userName = displayName || session.user.name || "";
  const blockedHref = userName ? `/${encodeURIComponent(userName)}?tab=blocked` : "/";

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          aria-haspopup="true"
          aria-label="開啟設定選單"
          className="flex items-center"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* 桌機下拉選單 */}
        {isMenuOpen && (
          <div className="hidden sm:block absolute right-0 top-full mt-2 w-44 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
            <div className="py-1">
              <Link href="/upload" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>上傳題目</Link>
              <Link href="/under-construction" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>Premium</Link>
              <button
                onClick={() => { setIsMenuOpen(false); setShowModeModal(true); }}
                className="w-full text-left px-4 py-3 !text-sm !leading-5 font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "#5fa870" }}
              >
                作答模式
              </button>
              <Link href={blockedHref} className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>封鎖名單</Link>
              {googleLinked === false && (
                <button
                  onClick={() => { setIsMenuOpen(false); handleLinkGoogle(); }}
                  disabled={linkingGoogle}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                  style={{ color: "#5fa870" }}
                >
                  {linkingGoogle ? "連結中…" : "連結 Google 帳號"}
                </button>
              )}
              {googleLinked === true && (
                <span className="block px-4 py-3 text-sm opacity-60" style={{ color: "#5fa870" }}>已連結 Google ✓</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 作答模式 modal */}
      {domMounted && showModeModal && createPortal(
        <>
          <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setShowModeModal(false)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-72 rounded-2xl border shadow-xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <h2 className="text-sm font-semibold text-center opacity-70" style={{ color: "#5fa870" }}>作答模式</h2>
            <button
              onClick={() => selectMode("practice")}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
              style={quizMode === "practice"
                ? { borderColor: "#5fa870", backgroundColor: "color-mix(in srgb, #5fa870 10%, transparent)", color: "#5fa870" }
                : { borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)", color: "#5fa870" }}
            >
              <span className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: "#5fa870" }}>
                {quizMode === "practice" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#5fa870" }} />}
              </span>
              <span className="text-sm font-medium">練習模式</span>
            </button>
            <button
              onClick={() => selectMode("formal")}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
              style={quizMode === "formal"
                ? { borderColor: "#b19739", backgroundColor: "color-mix(in srgb, #b19739 10%, transparent)", color: "#5fa870" }
                : { borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)", color: "#5fa870" }}
            >
              <span className="w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0" style={{ borderColor: "#b19739" }}>
                {quizMode === "formal" && <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#b19739" }} />}
              </span>
              <span className="text-sm font-medium">正式模式</span>
            </button>
          </div>
        </>,
        document.body
      )}

      {/* 手機下滑選單 */}
      {domMounted && createPortal(
        <>
          <div
            className={`sm:hidden fixed inset-0 z-[60] bg-black/40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMenuOpen(false)}
          />
          <div
            className={`sm:hidden fixed bottom-0 left-0 right-0 z-[80] bg-zen-paper dark:bg-zinc-900 transition-transform duration-300 ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
            style={{ boxShadow: '0 -4px 16px rgba(0,0,0,0.10)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <Link href="/upload" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>上傳題目</Link>
            <Link href="/under-construction" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>Premium</Link>
            <button
              onClick={() => { setIsMenuOpen(false); setShowModeModal(true); }}
              className="w-full text-center px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800"
              style={{ color: "#5fa870" }}
            >
              作答模式
            </button>
            <Link href={blockedHref} className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>封鎖名單</Link>
            {googleLinked === false && (
              <button
                onClick={() => { setIsMenuOpen(false); handleLinkGoogle(); }}
                disabled={linkingGoogle}
                className="w-full text-center px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 border-t border-zinc-100 dark:border-zinc-800"
                style={{ color: "#5fa870" }}
              >
                {linkingGoogle ? "連結中…" : "連結 Google 帳號"}
              </button>
            )}
            {googleLinked === true && (
              <span className="block px-5 py-4 text-base text-center opacity-60 border-t border-zinc-100 dark:border-zinc-800" style={{ color: "#5fa870" }}>已連結 Google ✓</span>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
