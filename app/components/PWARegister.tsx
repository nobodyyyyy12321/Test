"use client";

import { useEffect } from "react";

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error instanceof Event) return `Event(${error.type})`;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export default function PWARegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 鎖定直式（PWA standalone 模式下有效）
    if ("orientation" in screen && (screen.orientation as any).lock) {
      (screen.orientation as any).lock("portrait").catch(() => {});
    }

    // Register service worker — version query string busts old caches per build.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      const buildId = process.env.NEXT_PUBLIC_BUILD_ID || "default";
      navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(buildId)}`, { scope: "/" }).catch((error) => {
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
  try {
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    (window as any).__pwaPrompt = null;
    return outcome === "accepted" ? "accepted" : "dismissed";
  } catch (error) {
    console.error("PWA install prompt failed:", formatUnknownError(error));
    (window as any).__pwaPrompt = null;
    return "unavailable";
  }
}
