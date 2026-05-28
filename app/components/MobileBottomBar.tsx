"use client";
import PersonalMenu from "./PersonalMenu";

export default function MobileBottomBar() {
  return (
    <div
      id="mobile-bottom-bar"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-[70] flex items-center justify-center gap-8 pt-2 pb-4"
      style={{ backgroundColor: "var(--zen-bg)", borderTop: "1px solid color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
        <PersonalMenu />
      </div>
    </div>
  );
}
