"use client";

import { useEffect, useState } from "react";
import { triggerPWAInstall } from "./PWARegister";

export default function PWAInstallButton() {
  const [installable, setInstallable] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Already captured before this component mounted?
    if ((window as any).__pwaPrompt) setInstallable(true);

    const onInstallable = () => setInstallable(true);
    const onInstalled = () => { setInstallable(false); setInstalled(true); };

    window.addEventListener("pwa-installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("pwa-installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !installable) return null;

  return (
    <button
      onClick={async () => {
        const result = await triggerPWAInstall();
        if (result === "accepted") setInstalled(true);
        if (result !== "unavailable") setInstallable(false);
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
      title="安裝 App 到桌面"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4" />
        <path d="M8 12l4 4 4-4" />
        <path d="M4 20h16" />
      </svg>
      安裝 App
    </button>
  );
}
