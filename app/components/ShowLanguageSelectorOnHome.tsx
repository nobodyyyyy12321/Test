"use client";
import { usePathname } from "next/navigation";
import LanguageSelector from "./LanguageSelector";

export default function ShowLanguageSelectorOnHome() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <div className="flex-shrink-0 flex items-center gap-6 pr-3 mt-2 mr-1 sm:mt-6 sm:mr-10">
      <LanguageSelector />
    </div>
  );
}
