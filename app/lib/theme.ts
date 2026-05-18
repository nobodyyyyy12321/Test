export type ThemeMode = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "theme";
export const THEME_CHANGE_EVENT = "theme:changed";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function setTheme(mode: ThemeMode): void {
  try { localStorage.setItem(THEME_STORAGE_KEY, mode); } catch {}
  applyTheme(mode);
  try { window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { mode } })); } catch {}
}
