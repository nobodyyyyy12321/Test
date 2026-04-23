"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";

export default function UploadButton({ placement = "top" }: { placement?: "right" | "top" }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [hover, setHover] = useState(false);

  const handleClick = () => {
    if (session?.user) router.push("/upload");
  };

  const tooltipPos = placement === "right"
    ? "left-full ml-3 top-1/2 -translate-y-1/2"
    : "bottom-full mb-3 left-1/2 -translate-x-1/2";

  return (
    <div className="relative flex items-center justify-center"
      onMouseEnter={() => !session?.user && setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {hover && (
        <div className={`absolute ${tooltipPos} whitespace-nowrap text-xs px-3 py-1.5 rounded-full bg-zinc-800 text-white dark:bg-zinc-100 dark:text-black pointer-events-none z-50`}>
          登入以使用上傳功能
        </div>
      )}
      <button onClick={handleClick} aria-label="上傳題目">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </button>
    </div>
  );
}
