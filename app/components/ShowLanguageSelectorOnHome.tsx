"use client";
import { usePathname } from "next/navigation";
import LanguageSelector from "./LanguageSelector";

export default function ShowLanguageSelectorOnHome() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <div className="flex-shrink-0 flex items-center gap-6 pr-5">
      <LanguageSelector />
    </div>
  );
}
