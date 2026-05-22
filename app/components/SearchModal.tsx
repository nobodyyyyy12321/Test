"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";

type UserResult = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type OwnerCatResult = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string | null;
  ownerAvatarUrl: string | null;
  problemsPerTest: number | null;
  shuffleProblems: boolean | null;
};

const FOLDER_COLOR = "#b19739";
const LEAF_COLOR = "#D1D5DB";

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [ownerCatResults, setOwnerCatResults] = useState<OwnerCatResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [language, setLanguage] = useState("zh-TW");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const lang = localStorage.getItem("siteLanguage") || "zh-TW";
    setLanguage(lang);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setUserResults([]);
      setOwnerCatResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setUserResults([]);
      setOwnerCatResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      Promise.all([
        fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`).then(r => r.json()).catch(() => ({ users: [] })),
        fetch(`/api/search/categories?q=${encodeURIComponent(query.trim())}&language=${encodeURIComponent(language)}`).then(r => r.json()).catch(() => ({ results: [] })),
      ]).then(([userData, catData]) => {
        setUserResults(userData.users ?? []);
        setOwnerCatResults(catData.results ?? []);
      }).finally(() => setSearchLoading(false));
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, language]);

  if (!open) return null;

  const groupedByOwner = ownerCatResults.reduce((map, cat) => {
    if (!map.has(cat.ownerId)) {
      map.set(cat.ownerId, { ownerName: cat.ownerName, ownerAvatarUrl: cat.ownerAvatarUrl, cats: [] as OwnerCatResult[] });
    }
    map.get(cat.ownerId)!.cats.push(cat);
    return map;
  }, new Map<string, { ownerName: string | null; ownerAvatarUrl: string | null; cats: OwnerCatResult[] }>());

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
        <div
          className="w-full max-w-lg mx-4 rounded-2xl border shadow-xl overflow-hidden"
          style={{
            backgroundColor: "var(--zen-bg)",
            borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)",
            maxHeight: "70vh",
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}>
            <input
              ref={inputRef}
              className="flex-1 p-3 rounded-xl border text-sm outline-none"
              style={{
                backgroundColor: "var(--zen-bg)",
                color: "var(--zen-ink)",
                borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
              }}
              placeholder={language === "en" ? "Search subjects or users" : "搜尋分類或帳號"}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="關閉"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 80px)" }}>
            {searchLoading && (
              <p className="text-sm text-center py-8 opacity-50" style={{ color: "var(--zen-ink)" }}>
                {language === "en" ? "Searching..." : "搜尋中..."}
              </p>
            )}

            {!searchLoading && query && userResults.length === 0 && ownerCatResults.length === 0 && (
              <p className="text-sm text-center py-8 opacity-50" style={{ color: "var(--zen-ink)" }}>
                {language === "en" ? "No matching results" : "沒有符合的結果"}
              </p>
            )}

            {groupedByOwner.size > 0 && (
              <div className="p-4">
                {Array.from(groupedByOwner).map(([ownerId, { cats }]) => (
                  <div key={ownerId} className="mb-6">
                    <div className="bookshelf-grid">
                      {cats.map(cat => {
                        const href = cat.id ? `/test/${encodeURIComponent(cat.id)}` : "#";
                        return (
                          <a
                            key={cat.id}
                            href={href}
                            className="book-link bookshelf-btn"
                            style={{ color: LEAF_COLOR }}
                            onClick={onClose}
                          >
                            {cat.name}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {userResults.length > 0 && (
              <div className="p-4">
                <p className="text-xs opacity-50 mb-3" style={{ color: "var(--zen-ink)" }}>
                  {language === "en" ? "Users" : "帳號"}
                </p>
                <div className="bookshelf-grid">
                  {userResults.map(u => (
                    <Link
                      key={u.id}
                      href={`/${encodeURIComponent(u.name)}`}
                      className="book-link bookshelf-btn flex flex-col items-center gap-1.5"
                      style={{ color: "var(--zen-ink)" }}
                      onClick={onClose}
                    >
                      <Image
                        src={u.avatarUrl || AVATAR_PLACEHOLDER}
                        alt={u.name}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                      />
                      <span className="text-sm font-medium text-center leading-tight" style={{ color: FOLDER_COLOR }}>{u.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
