"use client";

import { useEffect, useState } from "react";

export default function RotatePrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    function check() {
      const isMobile = window.innerWidth < 640;
      const isLandscape = window.innerWidth > window.innerHeight;
      setShow(isMobile && isLandscape);
    }

    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 text-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="64"
        height="64"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mb-6 animate-pulse"
        style={{ transform: "rotate(90deg)" }}
      >
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="16" r="1" />
        <line x1="12" y1="12" x2="12" y2="13" />
      </svg>
      <p className="text-xl font-medium">請旋轉手機</p>
      <p className="mt-2 text-sm text-gray-400">請將手機轉回直式以獲得最佳瀏覽體驗</p>
    </div>
  );
}
