"use client";

import { useState } from "react";
import { SearchModal } from "./SearchModal";

export default function SearchButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="搜尋"
        className="flex items-center justify-center transition-opacity hover:opacity-70"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
