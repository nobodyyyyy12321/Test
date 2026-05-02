"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useShare } from "../providers/ShareProvider";

function getPageTitle(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === "/" || pathname === "") return "Test";

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "test" && segments[1]) {
    const explicitName = searchParams.get("name");
    if (explicitName) return decodeURIComponent(explicitName);
    const id = decodeURIComponent(segments[1]);
    return id;
  }

  return "Test";
}

function ShareButtonInner() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editText, setEditText] = useState("");
  const [resolvedUrlTitle, setResolvedUrlTitle] = useState<string | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const segments = pathname.split("/").filter(Boolean);
  const isTestRoute = segments[0] === "test" && !!segments[1] && segments[1] !== "list";

  const { shareText, shareTitle } = useShare();
  const urlTitle = getPageTitle(pathname, searchParams);
  const documentTitle = typeof document !== "undefined"
    ? document.title.replace(/\s*[\u2014\-]\s*Test\s*$/, "").trim()
    : "";
  const title = isTestRoute
    ? (resolvedUrlTitle || shareTitle || documentTitle || urlTitle)
    : (shareTitle || documentTitle || resolvedUrlTitle || urlTitle);
  const isTextMode = !!shareText;

  useEffect(() => {
    setResolvedUrlTitle(null);

    const explicitName = searchParams.get("name");
    if (explicitName || segments[0] !== "test" || !segments[1] || segments[1] === "list") {
      return;
    }

    const id = decodeURIComponent(segments[1]);
    const params = new URLSearchParams({ id });
    const levels = searchParams.get("levels");
    const lang = searchParams.get("lang") ?? searchParams.get("language") ?? (typeof localStorage !== "undefined" ? localStorage.getItem("siteLanguage") : null);
    if (levels) params.set("levels", levels);
    if (lang) params.set("lang", lang);

    let cancelled = false;
    fetch(`/api/share-title?${params.toString()}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { title?: string } | null) => {
        if (!cancelled && data?.title) setResolvedUrlTitle(data.title);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  const getUrl = () => {
    const isHome = pathname === "/" || pathname === "";
    return isHome
      ? "https://testtttt.io"
      : `${window.location.origin}${pathname}${window.location.search}`;
  };

  const handleOpen = () => {
    setEditText(isTextMode ? shareText! : `${title}\n${getUrl()}`);
    setOpen(true);
  };

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(editText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => window.prompt("複製", editText));
    } else {
      window.prompt("複製", editText);
    }
  };


  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="分享"
        title="分享"
        className="flex items-center justify-center transition-opacity hover:opacity-70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/>
          <circle cx="6" cy="12" r="3"/>
          <circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40"
          onClick={() => { setOpen(false); setCopied(false); setEditText(""); }}
        >
          <div
            className="relative w-full max-w-sm mx-4 rounded-xl shadow-xl overflow-hidden"
            style={{ backgroundColor: "var(--zen-paper)" }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-lg font-medium" style={{ color: "#b19739" }}>分享</span>
              <button
                onClick={() => { setOpen(false); setCopied(false); setEditText(""); }}
                className="text-lg leading-none"
                style={{ color: "#5fa870" }}
              >✕</button>
            </div>
            <div className="px-5 py-4">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full h-40 text-sm resize-none outline-none"
                style={{ backgroundColor: "var(--zen-paper)", color: "#ffffff" }}
              />
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-full text-sm border transition-opacity hover:opacity-80"
                style={{ borderColor: "#5fa870", color: "#5fa870", background: "transparent" }}
              >
                {copied ? "已複製！" : "複製"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ShareButtonFallback = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0 }}>
    <circle cx="18" cy="5" r="3"/>
    <circle cx="6" cy="12" r="3"/>
    <circle cx="18" cy="19" r="3"/>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
  </svg>
);

export default function ShareButton() {
  return (
    <Suspense fallback={<ShareButtonFallback />}>
      <ShareButtonInner />
    </Suspense>
  );
}
