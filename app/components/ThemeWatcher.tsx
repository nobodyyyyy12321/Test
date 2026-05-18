"use client";

import { useEffect } from "react";
import { applyTheme, getStoredTheme, THEME_STORAGE_KEY } from "../lib/theme";

export default function ThemeWatcher() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOsChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY) applyTheme(getStoredTheme());
    };
    mq.addEventListener("change", onOsChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onOsChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
