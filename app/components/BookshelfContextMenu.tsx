"use client";

import { useEffect, useState } from "react";

type SavedBook = {
  title: string;
  href: string;
  addedAt: string;
};

const STORAGE_KEY = "my-bookshelf-links";

export default function BookshelfContextMenu() {
  const [open, setOpen] = useState(false);
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [target, setTarget] = useState<{ title: string; href: string; pagePath: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isInBookshelf, setIsInBookshelf] = useState(false);
  const canDownloadPdf = Boolean(
    target && (
      (target.pagePath.startsWith("/chinese/學測") && target.title === "115") ||
      /\.pdf($|\?)/i.test(target.href)
    )
  );

  const getCurrentBookshelf = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed: SavedBook[] = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const closeMenu = () => setOpen(false);

    const onContextMenu = (event: MouseEvent) => {
      const node = event.target as HTMLElement | null;
      const bookshelfBtn = node?.closest("button.bookshelf-btn") as HTMLButtonElement | null;
      if (bookshelfBtn) {
        event.preventDefault();
        // 書櫃按鈕右鍵：顯示書本選單
        setTarget({ title: bookshelfBtn.dataset.title || "", href: bookshelfBtn.dataset.href || "", pagePath: window.location.pathname });
        setX(event.clientX);
        setY(event.clientY);
        setOpen(true);
        return;
      }
      // 其他區域右鍵：顯示個人選單
      event.preventDefault();
      const name = localStorage.getItem("userName") || "使用者";
      setTarget({ title: name, href: "", pagePath: window.location.pathname });
      setX(event.clientX);
      setY(event.clientY);
      setOpen(true);
    };

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", closeMenu);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("keydown", onKeydown);

    return () => {
      window.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("keydown", onKeydown);
    };
  }, []);

  const addToBookshelf = () => {
    if (!target) return;

    try {
      const current = getCurrentBookshelf();
      const exists = current.some((item) => item.href === target.href);
      if (exists) {
        setToast("已在個人清單");
      } else {
        const next: SavedBook[] = [{ ...target, addedAt: new Date().toISOString() }, ...current];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("my-bookshelf-updated"));
        setIsInBookshelf(true);
        setToast("已加入個人清單");
      }
    } catch {
      setToast("加入失敗");
    }

    setOpen(false);
    setTimeout(() => setToast(null), 1400);
  };

  const removeFromBookshelf = () => {
    if (!target) return;

    try {
      const current = getCurrentBookshelf();
      const exists = current.some((item) => item.href === target.href);
      if (!exists) {
        setToast("不在個人清單");
      } else {
        const next = current.filter((item) => item.href !== target.href);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event("my-bookshelf-updated"));
        setIsInBookshelf(false);
        setToast("已移出個人清單");
      }
    } catch {
      setToast("移出失敗");
    }

    setOpen(false);
    setTimeout(() => setToast(null), 1400);
  };

  const downloadPdf = () => {
    if (!target) return;

    if (!canDownloadPdf) return;

    if (target.pagePath.startsWith("/chinese/學測") && target.title === "115") {
      fetch("/api/chineseGSATpdf/single")
        .then(async (res) => {
          const data = await res.json();
          if (!res.ok || !data?.url) {
            throw new Error(data?.error || "download_failed");
          }

          window.open(data.url, "_blank", "noopener,noreferrer");
          setToast("已在新分頁開啟PDF");
        })
        .catch(() => {
          setToast("下載失敗");
        })
        .finally(() => {
          setOpen(false);
          setTimeout(() => setToast(null), 1400);
        });
      return;
    }

    window.open(target.href, "_blank", "noopener,noreferrer");
    setToast("已在新分頁開啟PDF");
    setOpen(false);
    setTimeout(() => setToast(null), 1400);
  };

  return (
    <>
      {open && (
        <div
          className="fixed z-[80] min-w-44 rounded shadow-md border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900"
          style={{ top: y, left: x }}
          role="menu"
        >
          <div className="py-1">
            <div className="px-4 py-3 text-sm flex items-center gap-2 truncate border-b border-zinc-200 dark:border-zinc-800" title={target?.title || "使用者"}>
              <span className="w-7 h-7 rounded-full bg-gray-600 text-white text-base font-semibold flex items-center justify-center mr-2">
                {(target?.title || "使用者").slice(0, 1).toUpperCase()}
              </span>
              <span>{target?.title || "使用者"}</span>//
            </div>
            <button onClick={() => window.location.href = `/account/${encodeURIComponent(target?.title || "")}/profile`} className="block w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">檔案</button>
            <button onClick={() => window.location.href = `/account/${encodeURIComponent(target?.title || "")}/record`} className="block w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">紀錄</button>
            <button onClick={() => window.location.href = `/account/${encodeURIComponent(target?.title || "")}/lists`} className="block w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">個人清單</button>
            <button onClick={() => window.location.href = `/account/${encodeURIComponent(target?.title || "")}/settings`} className="block w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">設定</button>
                        <button onClick={() => window.location.href = "/account/plan"} className="block w-full text-left px-4 py-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 font-semibold">付費方案</button>
            <button onClick={() => window.location.href = `/api/auth/signout`} className="block w-full text-left px-4 py-3 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800">登出</button>
            {/* 點左鍵自動關閉選單，不顯示關閉按鈕 */}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[90] rounded-md bg-black/85 text-white text-sm px-3 py-2">
          {toast}
        </div>
      )}
    </>
  );
}