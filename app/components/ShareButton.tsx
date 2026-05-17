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

  const { shareText, shareTitle, shareScoreCard } = useShare();
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
    setEditText(shareScoreCard ? (shareText ?? "") : isTextMode ? shareText! : `${title}\n${getUrl()}`);
    setOpen(true);
  };

  const handleCopy = () => {
    if (shareScoreCard) {
      // Render the card as a PNG image and copy to clipboard
      const W = 800, PAD = 48, FONT_SIZE = 28, LINE_HEIGHT = 40;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
      // Measure text to determine height (simple word-wrap)
      ctx.font = `bold ${FONT_SIZE}px system-ui, sans-serif`;
      const maxW = W - PAD * 2;
      const words = shareScoreCard.split(" ");
      const lines: string[] = [];
      let cur = "";
      for (const w of words) {
        const test = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
        else cur = test;
      }
      if (cur) lines.push(cur);
      const H = PAD * 2 + lines.length * LINE_HEIGHT + (lines.length > 1 ? (lines.length - 1) * 8 : 0);
      canvas.width = W;
      canvas.height = H;
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#5fa870");
      g.addColorStop(1, "#b19739");
      ctx.fillStyle = g;
      const r = 24;
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(W - r, 0); ctx.quadraticCurveTo(W, 0, W, r);
      ctx.lineTo(W, H - r); ctx.quadraticCurveTo(W, H, W - r, H);
      ctx.lineTo(r, H); ctx.quadraticCurveTo(0, H, 0, H - r);
      ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${FONT_SIZE}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const totalTextH = lines.length * (LINE_HEIGHT + 8) - 8;
      const startY = (H - totalTextH) / 2 + LINE_HEIGHT / 2;
      lines.forEach((line, i) => ctx.fillText(line, W / 2, startY + i * (LINE_HEIGHT + 8)));
      canvas.toBlob(blob => {
        if (!blob) { navigator.clipboard?.writeText(editText).catch(() => {}); return; }
        const textBlob = new Blob([editText], { type: "text/plain" });
        navigator.clipboard.write([new ClipboardItem({ "image/png": blob, "text/plain": textBlob })])
          .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })
          .catch(() => navigator.clipboard?.writeText(editText).catch(() => {}));
      }, "image/png");
      return;
    }
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
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
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
              <span className="text-lg font-medium" style={{ color: "#D1D5DB" }}>分享</span>
              <button
                onClick={() => { setOpen(false); setCopied(false); setEditText(""); }}
                className="text-lg leading-none"
                style={{ color: "#D1D5DB" }}
              >✕</button>
            </div>
            <div className="px-5 py-4 flex flex-col gap-3">
              {shareScoreCard && (
                <div
                  className="w-full rounded-lg px-4 py-3 text-sm font-medium select-none text-center"
                  style={{
                    background: "linear-gradient(135deg, #5fa870 0%, #b19739 100%)",
                    color: "#fff",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                >
                  {shareScoreCard}
                </div>
              )}
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full text-sm resize-none outline-none"
                style={{
                  backgroundColor: "var(--zen-paper)",
                  color: "#ffffff",
                  height: shareScoreCard ? "3rem" : "10rem",
                }}
              />
            </div>
            <div className="flex justify-end px-5 py-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleCopy}
                className="px-4 py-2 rounded-full text-sm border transition-opacity hover:opacity-80"
                style={{ borderColor: "#D1D5DB", color: "#D1D5DB", background: "transparent" }}
              >
                {copied ? "已複製！" : shareScoreCard ? "複製圖片" : "複製"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const ShareButtonFallback = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0 }}>
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
