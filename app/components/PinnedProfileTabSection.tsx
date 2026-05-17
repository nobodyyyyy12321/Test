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

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [lists, setLists] = useState<QuestionList[]>([]);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [profileFolders, setProfileFolders] = useState<UserFolder[]>([]);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);

  const [serverOwner, setServerOwner] = useState<boolean | null>(null);

  const fastOwner =
    session?.user?.name === name ||
    session?.user?.name === decodeURIComponent(name) ||
    (session?.user as { email?: string } | undefined)?.email === name ||
    (session?.user as { email?: string } | undefined)?.email === decodeURIComponent(name);
  const isOwner = fastOwner || serverOwner === true;

  // Session resolution can flip `isOwner` after the first fetch already ran on
  // the wrong branch — reset `loaded` so the owner/non-owner fetch re-runs.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    setLoaded(false);
  }, [isOwner, sessionStatus]);

  useEffect(() => {
    if (tab !== "lists" || !open || loaded) return;
    if (serverOwner === null) return;
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
  }, [open, loaded, tab, name, isOwner, serverOwner]);

  // Server-side owner check when client-side name match fails
  useEffect(() => {
    if (fastOwner || sessionStatus === "loading") {
      if (fastOwner) setServerOwner(true);
      return;
    }
    fetch(`/api/user/profile?name=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { setServerOwner(d?.user?.isOwner === true); })
      .catch(() => setServerOwner(false));
  }, [name, fastOwner, sessionStatus]);

  const profileHref = `/${encodeURIComponent(name)}?tab=${encodeURIComponent(tab)}`;

  const renderListsBody = () => (
    <>
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
        className={`flex items-center gap-1 mb-3 text-xs transition-colors ${open ? "" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"}`}
        style={{ color: open ? "#b19739" : undefined }}
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
