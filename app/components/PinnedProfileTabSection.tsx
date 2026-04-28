"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type Tab = "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked";

type ListItem = { id: string; title: string };
type UserItem = { id: string; name: string; avatarUrl?: string };
type GroupItem = { id: string; name: string };

type Props = {
  name: string;
  tab: Tab;
  label: string;
  onContextMenu: (e: React.MouseEvent) => void;
};

export function PinnedProfileTabSection({ name, tab, label, onContextMenu }: Props) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [lists, setLists] = useState<ListItem[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    const finish = () => { setLoaded(true); setLoading(false); };
    if (tab === "lists") {
      fetch(`/api/users/${encodeURIComponent(name)}/lists`)
        .then(r => r.json())
        .then(d => setLists((d.lists ?? []).map((l: { id: string; title: string }) => ({ id: l.id, title: l.title }))))
        .catch(() => {})
        .finally(finish);
    } else if (tab === "followers") {
      fetch(`/api/users/${encodeURIComponent(name)}/followers`)
        .then(r => r.json())
        .then(d => setUsers((d.followers ?? []).map((f: { followerId: string; followerName: string; followerAvatarUrl?: string }) => ({ id: f.followerId, name: f.followerName, avatarUrl: f.followerAvatarUrl }))))
        .catch(() => {})
        .finally(finish);
    } else if (tab === "following") {
      fetch(`/api/users/${encodeURIComponent(name)}/following`)
        .then(r => r.json())
        .then(d => setUsers((d.following ?? []).map((f: { followingId: string; followingName: string; followingAvatarUrl?: string }) => ({ id: f.followingId, name: f.followingName, avatarUrl: f.followingAvatarUrl }))))
        .catch(() => {})
        .finally(finish);
    } else if (tab === "groups") {
      fetch("/api/groups")
        .then(r => r.json())
        .then(d => {
          const owned: GroupItem[] = (d.owned ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }));
          const joined: GroupItem[] = (d.joined ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name }));
          setGroups([...owned, ...joined]);
        })
        .catch(() => {})
        .finally(finish);
    } else {
      finish();
    }
  }, [open, loaded, tab, name]);

  const colors = ["#c4825a", "#7b9ca0"];
  const profileHref = `/${encodeURIComponent(name)}?tab=${encodeURIComponent(tab)}`;

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
        loading ? (
          <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>載入中...</p>
        ) : tab === "lists" ? (
          lists.length === 0 ? (
            <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>尚無試卷</p>
          ) : (
            <div className="bookshelf-grid">
              {lists.map((list, i) => (
                <Link
                  key={list.id}
                  href={`/test/list?listId=${list.id}`}
                  className="book-link bookshelf-btn"
                  style={{ color: colors[i % 2] }}
                >
                  {list.title}
                </Link>
              ))}
            </div>
          )
        ) : tab === "followers" || tab === "following" ? (
          users.length === 0 ? (
            <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>尚無</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {users.map(u => (
                <li key={u.id}>
                  <Link
                    href={`/${encodeURIComponent(u.name)}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Image
                      src={u.avatarUrl || "/avatar-placeholder.svg"}
                      alt={u.name}
                      width={28}
                      height={28}
                      unoptimized
                      className="w-7 h-7 rounded-full object-cover shrink-0"
                    />
                    <span className="text-sm truncate" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : tab === "groups" ? (
          groups.length === 0 ? (
            <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>尚無群組</p>
          ) : (
            <div className="bookshelf-grid">
              {groups.map((g, i) => (
                <Link
                  key={g.id}
                  href={profileHref}
                  className="book-link bookshelf-btn"
                  style={{ color: colors[i % 2] }}
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )
        ) : (
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
