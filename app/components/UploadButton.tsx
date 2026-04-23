"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function UploadButton() {
  const { data: session } = useSession();
  if (!session?.user) return null;

  return (
    <Link href="/admin/upload" aria-label="上傳題目">
      <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </Link>
  );
}
