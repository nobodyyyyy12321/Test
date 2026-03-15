"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function AuthNav() {
  const { data: session, status } = useSession();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      // 只在非頭像按鈕時觸發
      const target = event.target as HTMLElement;
      if (target.closest("button[aria-label='開啟個人選單']")) return;
      event.preventDefault();
      setIsMenuOpen(true);
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);
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
      <div className="flex items-center gap-3">
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
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="頭像"
          className="w-8 h-8 rounded-full object-cover border border-gray-300"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
          <span className="text-lg">👤</span>
        </div>
      )}
      <span className="font-medium text-base truncate max-w-[120px]" title={name}>{name}</span>
      <button
        aria-label="開啟個人選單"
        className="zen-ghost px-2 py-1 rounded"
        onClick={() => setIsMenuOpen((v) => !v)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        ☰
      </button>
      {isMenuOpen && (
        <div
          className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-lg z-50"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <Link href={`/account/${encodedName}/profile`} className="block px-4 py-2 hover:bg-gray-100">個人檔案</Link>
          <button
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
          >登出</button>
          {logoutError && <div className="text-xs text-red-500 px-4 py-1">登出失敗: {logoutError}</div>}
        </div>
      )}
    </div>
  );
}
