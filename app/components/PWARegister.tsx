"use client";

import { useEffect } from "react";

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Register service worker
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }

    // Capture beforeinstallprompt and store on window for triggerPWAInstall()
    const handler = (e: Event) => {
      e.preventDefault();
      (window as any).__pwaPrompt = e;
      window.dispatchEvent(new CustomEvent("pwa-installable"));
    };
    window.addEventListener("beforeinstallprompt", handler as EventListener);

    // Clean up stored prompt after install
    window.addEventListener("appinstalled", () => {
      (window as any).__pwaPrompt = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler as EventListener);
    };
  }, []);

  return null;
}

/** 從任何元件呼叫，觸發 PWA 安裝提示 */
export async function triggerPWAInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const prompt = (window as any).__pwaPrompt;
  if (!prompt) return "unavailable";
  prompt.prompt();
  const { outcome } = await prompt.userChoice;
  (window as any).__pwaPrompt = null;
  return outcome === "accepted" ? "accepted" : "dismissed";
}
