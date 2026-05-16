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
  const [domMounted, setDomMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useLayoutEffect(() => {
    const cached = localStorage.getItem("avatarUrl");
    if (cached) setAvatarUrl(cached);
    const cachedName = localStorage.getItem("displayName");
    if (cachedName) setDisplayName(cachedName);
  }, []);

  useEffect(() => {
    setDomMounted(true);
  }, []);

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
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0 }}>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </button>

          {/* 桌機下拉選單 */}
          {isMenuOpen && (
            <div className="hidden sm:block absolute right-0 top-full mt-2 w-36 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
              <Link href="/auth/login" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>登入</Link>
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
              <Link href="/auth/login" className="block px-5 py-4 text-base text-center hover:bg-zinc-100 dark:hover:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "#5fa870" }} onClick={() => setIsMenuOpen(false)}>登入</Link>
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

  return (
    <Link href={`/${encodedName}`} aria-label="個人頁面" className="flex items-center">
      {avatarUrl ? (
        <Image src={avatarUrl} alt="avatar" width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
        </svg>
      )}
    </Link>
  );
}
