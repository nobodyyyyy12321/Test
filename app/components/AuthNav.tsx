"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function AuthNav() {
  const { data: session, status } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 300);
  };

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) return;
        const j = await res.json();
        if (j?.ok && mounted) {
          if (j.user?.avatarUrl) setAvatarUrl(j.user.avatarUrl);
          if (j.user?.name) setDisplayName(j.user.name);
        }
      } catch (e) {
        // ignore
      }
    }

    function onProfileUpdated() {
      loadProfile();
    }

    if (session?.user) loadProfile();
    window.addEventListener('profile:updated', onProfileUpdated);
    return () => {
      mounted = false;
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
      window.removeEventListener('profile:updated', onProfileUpdated);
    };
  }, [session]);

  if (status === "loading") {
    return <div className="text-sm zen-subtle">載入中…</div>;
  }

  if (!session?.user) {
    return (
      <div className="flex items-center gap-3" style={{ marginTop: '1.5rem',marginRight:'1.5rem' }}>
        <Link href="/auth/login" className="zen-ghost px-3 py-1 rounded ml-2">登入</Link>
        <Link href="/auth/register" className="zen-ghost px-3 py-1 rounded">註冊</Link>
      </div>
    );
  }

  const name = displayName || session.user.name || session.user.email || "使用者";
  const encodedName = encodeURIComponent(name);

  const handleSignOut = async () => {
    try {
      setLogoutError(null);

      const csrfRes = await fetch("/api/auth/csrf", {
        method: "GET",
        credentials: "include",
      });
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
    <div className="flex items-center">
      <div
        className="relative"
        style={{ marginRight: '1.5rem', marginTop: '1.5rem' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          aria-haspopup="true"
          aria-label="開啟個人選單"
          className="flex items-center"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} avatar`} className="w-11 h-11 rounded-full object-cover" />
          ) : session.user.image ? (
            <img src={session.user.image} alt={`${name} avatar`} className="w-11 h-11 rounded-full object-cover" />
          ) : (
            <span className="w-11 h-11 rounded-full bg-gray-600 text-white text-base font-semibold flex items-center justify-center">
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </button>

        {/* 桌機下拉選單 */}
        {isMenuOpen && (
          <div className="hidden md:block absolute right-0 mt-2 w-44 rounded shadow-md z-20 border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
            <div className="py-1">
              <div className="px-4 py-3 text-sm truncate border-b border-zinc-200 dark:border-zinc-800" title={name}>{name}</div>
              <Link href={`/${encodedName}`} className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">個人頁面</Link>
              <Link href="/under-construction" className="block px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">付費方案</Link>
              <button
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 !text-sm !leading-5 font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                登出
              </button>
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

      {/* 手機底部選單遮罩 */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* 手機底部上滑選單 */}
      <div
        className={`md:hidden fixed bottom-0 left-0 right-0 z-50 bg-zen-paper dark:bg-zinc-900 rounded-t-2xl shadow-xl transition-transform duration-300 ${isMenuOpen ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* 拖曳指示條 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        </div>
        {/* 使用者名稱 */}
        <div className="px-5 py-3 text-sm truncate border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400" title={name}>{name}</div>
        <Link
          href={`/${encodedName}`}
          className="block px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => setIsMenuOpen(false)}
        >
          個人頁面
        </Link>
        <Link
          href="/under-construction"
          className="block px-5 py-4 text-base hover:bg-zinc-100 dark:hover:bg-zinc-800"
          onClick={() => setIsMenuOpen(false)}
        >
          付費方案
        </Link>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-5 py-4 text-base font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          登出
        </button>
        {logoutError && (
          <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800">
            <p className="text-xs text-red-600 dark:text-red-400 break-all">登出失敗：{logoutError}</p>
            <a href="/api/auth/signout" className="mt-1 inline-block text-xs underline">改用預設登出頁</a>
          </div>
        )}
        {/* 底部安全區 */}
        <div className="h-safe-bottom pb-6" />
      </div>
    </div>
  );
}
