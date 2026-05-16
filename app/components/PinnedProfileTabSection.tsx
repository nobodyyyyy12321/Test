"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import type { QuestionList } from "../../lib/lists-supabase";
import { PersonalListsView, type MyCollection, type UserFolder } from "./PersonalListsView";

type Tab = "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked" | "shared";

type Props = {
  name: string;
  tab: Tab;
  label: string;
  onContextMenu: (e: React.MouseEvent) => void;
};

export function PinnedProfileTabSection({ name, tab, label, onContextMenu }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const isOwner =
    session?.user?.name === name ||
    session?.user?.name === decodeURIComponent(name) ||
    (session?.user as { email?: string } | undefined)?.email === name ||
    (session?.user as { email?: string } | undefined)?.email === decodeURIComponent(name);

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [lists, setLists] = useState<QuestionList[]>([]);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [profileFolders, setProfileFolders] = useState<UserFolder[]>([]);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);

  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addFolderError, setAddFolderError] = useState<string | null>(null);

  // Session resolution can flip `isOwner` after the first fetch already ran on
  // the wrong branch — reset `loaded` so the owner/non-owner fetch re-runs.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    setLoaded(false);
  }, [isOwner, sessionStatus]);

  useEffect(() => {
    if (tab !== "lists" || !open || loaded) return;
    setLoading(true);
    const finish = () => { setLoaded(true); setLoading(false); };

    if (isOwner) {
      Promise.all([
        fetch("/api/lists").then(r => r.json()).catch(() => ({})),
        fetch("/api/my-collections?allLanguages=1").then(r => r.json()).catch(() => ({})),
        fetch("/api/user/pins").then(r => r.json()).catch(() => ({})),
        fetch("/api/my-folders").then(r => r.json()).catch(() => ({})),
      ]).then(([l, c, p, f]) => {
        setLists(l.lists ?? []);
        setMyCollections((c.collections ?? []).filter((col: { approvalStatus?: string }) => col.approvalStatus !== "pending"));
        setProfileFolders(f.folders ?? []);
        if (Array.isArray(p.pinnedListIds)) setPinnedListIds(p.pinnedListIds);
        if (Array.isArray(p.pinnedCollectionIds)) setPinnedCollectionIds(p.pinnedCollectionIds);
      }).finally(finish);
    } else {
      fetch(`/api/users/${encodeURIComponent(name)}/lists`)
        .then(r => r.json())
        .then(d => {
          setLists(d.lists ?? []);
          setMyCollections((d.collections ?? []).filter((col: { approvalStatus?: string }) => col.approvalStatus !== "pending"));
          setProfileFolders(d.folders ?? []);
        })
        .catch(() => {})
        .finally(finish);
    }
  }, [open, loaded, tab, name, isOwner]);

  const addFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setAddingFolder(false);
      setNewFolderName("");
      return;
    }
    try {
      const res = await fetch("/api/my-folders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "addFolder", name: trimmed, parentId: null }),
      });
      const data: { folders?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAddFolderError(data.error ?? `新增失敗 (${res.status})`);
        return;
      }
      setAddFolderError(null);
      if (Array.isArray(data.folders)) {
        setProfileFolders(data.folders as UserFolder[]);
      }
      setNewFolderName("");
      setAddingFolder(false);
    } catch (e) {
      setAddFolderError(e instanceof Error ? e.message : "新增失敗");
    }
  };

  const profileHref = `/${encodeURIComponent(name)}?tab=${encodeURIComponent(tab)}`;

  const renderListsBody = () => (
    <>
      {isOwner && (
        <div className="mb-3 flex flex-col gap-1">
          {addingFolder ? (
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="資料夾名稱"
              onBlur={() => void addFolder()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addFolder();
                }
                if (e.key === "Escape") {
                  setAddingFolder(false);
                  setNewFolderName("");
                }
              }}
              className="text-sm px-2 py-1 outline-none border border-zinc-300 dark:border-zinc-600 rounded"
              style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setAddFolderError(null);
                setAddingFolder(true);
              }}
              className="self-start text-xs opacity-60 hover:opacity-90 transition-opacity"
              style={{ color: "var(--zen-ink)" }}
            >
              + 新增資料夾
            </button>
          )}
          {addFolderError && (
            <p className="text-xs text-red-600 dark:text-red-400">{addFolderError}</p>
          )}
        </div>
      )}
      <PersonalListsView
        isOwner={isOwner}
        loading={loading}
        lists={lists}
        setLists={setLists}
        myCollections={myCollections}
        folders={profileFolders}
        pinnedListIds={pinnedListIds}
        setPinnedListIds={setPinnedListIds}
        pinnedCollectionIds={pinnedCollectionIds}
        setPinnedCollectionIds={setPinnedCollectionIds}
      />
    </>
  );

  return (
    <div className="mt-6 px-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onContextMenu={onContextMenu}
        className="flex items-center gap-1 mb-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        aria-label={open ? "收合" : "展開"}
      >
        <span>{label}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        >
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        tab === "lists" ? renderListsBody() : (
          <Link
            href={profileHref}
            className="inline-block text-sm px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            style={{ color: "var(--zen-ink)" }}
          >
            前往「{label}」
          </Link>
        )
      )}
    </div>
  );
}
