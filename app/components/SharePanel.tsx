"use client";

import { useEffect, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useShare } from "../providers/ShareProvider";

function getPageTitle(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === "/" || pathname === "") return "wikiTest";

  const segments = pathname.split("/").filter(Boolean);

  if (segments[0] === "test" && segments[1]) {
    const explicitName = searchParams.get("name");
    if (explicitName) return decodeURIComponent(explicitName);
    const id = decodeURIComponent(segments[1]);
    return id;
  }

  return "wikiTest";
}

function SharePanelInner({ onClose }: { onClose: () => void }) {
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
    ? document.title.replace(/\s*[—\-]\s*wikiTest\s*$/, "").trim()
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

  // Seed the edit text when the panel mounts / share context changes.
  useEffect(() => {
    setEditText(shareScoreCard ? (shareText ?? "") : isTextMode ? shareText! : `${title}\n${getUrl()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareScoreCard, shareText, title]);

  const handleCopy = () => {
    if (shareScoreCard) {
      const W = 800, PAD = 48, FONT_SIZE = 28, LINE_HEIGHT = 40;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;
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
        onClick={onClose}
        aria-label="back"
        className="flex items-center gap-2 px-4 py-4 sm:py-2.5 text-sm transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
        style={{ color: "var(--zen-ink)" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="font-medium">分享</span>
      </button>
      <div className="px-4 py-3 flex flex-col gap-3">
        {shareScoreCard && (
          <div
            className="w-full rounded-lg px-3 py-2 text-xs font-medium select-none text-center"
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
          className="w-full text-xs resize-none outline-none rounded-md border p-2"
          style={{
            backgroundColor: "var(--zen-bg)",
            color: "var(--zen-ink)",
            borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
            height: shareScoreCard ? "3rem" : "6rem",
          }}
        />
        <button
          type="button"
          onClick={handleCopy}
          className="w-full px-3 py-2 rounded-md text-xs border transition-opacity hover:opacity-80"
          style={{ borderColor: "var(--zen-ink)", color: "var(--zen-ink)", background: "transparent" }}
        >
          {copied ? "已複製!" : shareScoreCard ? "複製圖片" : "複製"}
        </button>
      </div>
    </>
  );
}

export default function SharePanel({ onClose }: { onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <SharePanelInner onClose={onClose} />
    </Suspense>
  );
}
