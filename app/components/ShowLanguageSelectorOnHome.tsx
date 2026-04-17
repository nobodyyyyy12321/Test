"use client";
import { usePathname } from "next/navigation";
import LanguageSelector from "./LanguageSelector";

export default function ShowLanguageSelectorOnHome() {
  const pathname = usePathname();
  if (pathname !== "/") return null;
  return (
    <div className="flex items-center justify-center">
      <LanguageSelector />
    </div>
  );
}
