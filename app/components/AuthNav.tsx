"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function AuthNav() {
  const { data: session, status } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [domMounted, setDomMounted] = useState(false);
  const [quizMode, setQuizMode] = useState<"practice" | "formal">("practice");
  const [showModeModal, setShowModeModal] = useState(false);
  const prevLoggedInRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const cached = localStorage.getItem("avatarUrl");
    if (cached) setAvatarUrl(cached);
    const cachedName = localStorage.getItem("displayName");
    if (cachedName) setDisplayName(cachedName);
    const savedMode = localStorage.getItem("quizMode");
    if (savedMode === "formal" || savedMode === "practice") setQuizMode(savedMode);
  }, []);

  useEffect(() => {
    setDomMounted(true);
  }, []);

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

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) return;
        const j = await res.json();
        if (j?.ok && mounted) {
          if (j.user?.avatarUrl) {
            setAvatarUrl(j.user.avatarUrl);
            localStorage.setItem("avatarUrl", j.user.avatarUrl);
          }
          if (j.user?.name) {
            setDisplayName(j.user.name);
            localStorage.setItem("displayName", j.user.name);
          }
        }
      } catch (e) {
        // ignore
      }
    }

    function onProfileUpdated() { loadProfile(); }

    if (session?.user) loadProfile();
    window.addEventListener('profile:updated', onProfileUpdated);
    return () => {
      mounted = false;
      window.removeEventListener('profile:updated', onProfileUpdated);
    };
  }, [session]);

  if (status === "loading") {
    if (avatarUrl) {
      return <Image src={avatarUrl} alt="avatar" width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover" />;
    }
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0 }}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    );
  }

  if (!session?.user) {
    return (
      <>
        {/* 人頭圖示（桌機＋手機共用） */}
        <div className="relative" ref={menuRef}>
          <button
            className="flex items-center"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="開啟登入選單"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>

          {/* 桌機下拉選單 */}
          {isMenuOpen && (
            <div className="hidden sm:block absolute right-0 top-full mt-2 w-36 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
              <Link href="/auth/login" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>登入</Link>
              <Link href="/auth/register" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>註冊</Link>
            </div>
          )}
        </div>

        {/* 手機遮罩 + 頂部下滑選單（用 Portal 渲染到 body，避免被 MobileBottomBar stacking context 限制） */}
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
              <Link href="/auth/login" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>登入</Link>
              <Link href="/auth/register" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>註冊</Link>
            </div>
          </>,
          document.body
        )}
      </>
    );
  }

  const name = displayName || session.user.name || session.user.email || "使用者";
  const encodedName = encodeURIComponent(name);

  const selectMode = (m: "practice" | "formal") => {
    setQuizMode(m);
    localStorage.setItem("quizMode", m);
    setShowModeModal(false);
  };

  const handleSignOut = async () => {
    try {
      setLogoutError(null);
      localStorage.removeItem("avatarUrl");
      localStorage.removeItem("displayName");
      const csrfRes = await fetch("/api/auth/csrf", { method: "GET", credentials: "include" });
      if (!csrfRes.ok) throw new Error(`csrf_http_${csrfRes.status}`);
      const csrfJson = await csrfRes.json();
      const csrfToken = csrfJson?.csrfToken;
      if (!csrfToken) throw new Error("csrf_missing");
      setIsMenuOpen(false);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signout";
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfToken";
      csrfInput.value = csrfToken;
      const callbackInput = document.createElement("input");
      callbackInput.type = "hidden";
      callbackInput.name = "callbackUrl";
      callbackInput.value = "/";
      form.appendChild(csrfInput);
      form.appendChild(callbackInput);
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      const code = error instanceof Error ? error.message : "logout_unknown";
      setLogoutError(code);
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      <div
        className="relative"
        ref={menuRef}
      >
        <button
          aria-haspopup="true"
          aria-label="開啟個人選單"
          className="flex items-center"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt="avatar" width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          )}
        </button>

        {/* 桌機下拉選單 */}
        {isMenuOpen && (
          <div className="hidden sm:block absolute right-0 top-full mt-2 w-44 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
            <div className="py-1">
              <div className="px-4 py-3 text-sm truncate border-b border-zinc-200 dark:border-zinc-800" title={name}>{name}</div>
              <Link href={`/${encodedName}`} className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>個人頁面</Link>
              <Link href="/upload" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>上傳題目</Link>
              <Link href="/under-construction" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>Premium</Link>
              <button
                onClick={() => { setIsMenuOpen(false); setShowModeModal(true); }}
                className="w-full text-left px-4 py-3 !text-sm !leading-5 font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "#5fa870" }}
              >
                作答模式
              </button>
              <button onClick={handleSignOut} className="w-full text-left px-4 py-3 !text-sm !leading-5 font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#b19739" }}>登出</button>
              {logoutError && (
                <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs text-red-600 dark:text-red-400 break-all">登出失敗：{logoutError}</p>
                  <a href="/api/auth/signout" className="mt-1 inline-block text-xs underline">改用預設登出頁</a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 手機遮罩 + 頂部下滑選單（用 Portal 渲染到 body，避免被 MobileBottomBar stacking context 限制） */}
      {domMounted && showModeModal && createPortal(
        <>
          <div className="fixed inset-0 z-[90] bg-black/40" onClick={() => setShowModeModal(false)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[91] w-72 rounded-2xl border shadow-xl p-6 flex flex-col gap-4"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <h2 className="text-sm font-semibold text-center opacity-70" style={{ color: "var(--zen-ink)" }}>作答模式</h2>
            <button
              onClick={() => selectMode("practice")}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left"
              style={quizMode === "practice"
                ? { borderColor: "#5fa870", backgroundColor: "color-mix(in srgb, #5fa870 10%, transparent)", color: "#5fa870" }
                : { borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)", color: "var(--zen-ink)" }}
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
                ? { borderColor: "#b19739", backgroundColor: "color-mix(in srgb, #b19739 10%, transparent)", color: "#b19739" }
                : { borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)", color: "var(--zen-ink)" }}
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
            <div className="px-5 py-4 text-sm text-center truncate border-b border-zinc-100 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400" title={name}>{name}</div>
            <Link href={`/${encodedName}`} className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>個人頁面</Link>
            <Link href="/upload" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>上傳題目</Link>
            <Link href="/under-construction" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#b19739" }} onClick={() => setIsMenuOpen(false)}>Premium</Link>
            <button
              onClick={() => { setIsMenuOpen(false); setShowModeModal(true); }}
              className="w-full text-center px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800"
              style={{ color: "#5fa870" }}
            >
              作答模式
            </button>
            <button onClick={handleSignOut} className="w-full text-center px-5 py-4 text-base font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#b19739" }}>登出</button>
            {logoutError && (
              <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-xs text-red-600 dark:text-red-400 break-all">登出失敗：{logoutError}</p>
                <a href="/api/auth/signout" className="mt-1 inline-block text-xs underline">改用預設登出頁</a>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}
