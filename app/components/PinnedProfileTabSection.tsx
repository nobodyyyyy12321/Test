"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type { QuestionList } from "../../lib/lists-supabase";
import { PersonalListsView, type MyCollection, type UserFolder } from "./PersonalListsView";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";

type Tab = "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked" | "shared";

type UserItem = { id: string; name: string; avatarUrl?: string };
type GroupItem = { id: string; name: string; ownerName?: string; ownerAvatarUrl?: string; memberCount?: number };
type SharedCategory = { id: string; categoryKey: string; categoryName: string; sharedByName?: string };
type QuizRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category?: string;
  success?: boolean;
};

const ENGLISH_SET_NAMES: Record<string, string> = {
  "englishWords:1,2": "2000單",
  "englishWords:3,4": "4000單",
  "englishWords:5,6": "6000單",
  englishWords: "英文",
  quoteChinese: "名言佳句",
};

type Props = {
  name: string;
  tab: Tab;
  label: string;
  onContextMenu: (e: React.MouseEvent) => void;
};

export function PinnedProfileTabSection({ name, tab, label, onContextMenu }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const isOwner = session?.user?.name === name || session?.user?.name === decodeURIComponent(name) || (session?.user as any)?.email === name || (session?.user as any)?.email === decodeURIComponent(name);

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Session resolution can flip `isOwner` after the first fetch already ran on
  // the wrong branch — reset `loaded` so the owner/non-owner fetch re-runs.
  useEffect(() => {
    if (sessionStatus === "loading") return;
    setLoaded(false);
  }, [isOwner, sessionStatus]);

  const [lists, setLists] = useState<QuestionList[]>([]);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [profileFolders, setProfileFolders] = useState<UserFolder[]>([]);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);

  const [users, setUsers] = useState<UserItem[]>([]);
  const [ownedGroups, setOwnedGroups] = useState<GroupItem[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<GroupItem[]>([]);
  const [records, setRecords] = useState<QuizRecord[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<UserItem[]>([]);
  const [sharedCats, setSharedCats] = useState<SharedCategory[]>([]);

  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    const finish = () => { setLoaded(true); setLoading(false); };

    if (tab === "lists") {
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
          setOwnedGroups((d.owned ?? []) as GroupItem[]);
          setJoinedGroups((d.joined ?? []) as GroupItem[]);
        })
        .catch(() => {})
        .finally(finish);
    } else if (tab === "record") {
      fetch(`/api/user/profile?name=${encodeURIComponent(name)}`)
        .then(r => r.json())
        .then(d => setRecords((d.user?.records ?? []) as QuizRecord[]))
        .catch(() => {})
        .finally(finish);
    } else if (tab === "blocked") {
      if (isOwner) {
        fetch("/api/users/blocked")
          .then(r => r.json())
          .then(d => setBlockedUsers((d.blocked ?? []) as UserItem[]))
          .catch(() => {})
          .finally(finish);
      } else {
        finish();
      }
    } else if (tab === "shared") {
      if (isOwner) {
        fetch("/api/categories/shared")
          .then(r => r.json())
          .then(d => setSharedCats((d.sharedCategories ?? []) as SharedCategory[]))
          .catch(() => {})
          .finally(finish);
      } else {
        finish();
      }
    } else {
      finish();
    }
  }, [open, loaded, tab, name, isOwner]);

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
        loading && tab !== "lists" ? (
          <p className="text-sm zen-subtle">載入中...</p>
        ) : tab === "lists" ? (
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
        ) : tab === "followers" || tab === "following" ? (
          users.length === 0 ? (
            <p className="text-sm zen-subtle opacity-50">{tab === "followers" ? "尚無追蹤者" : "尚無追蹤中的使用者"}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {users.map(u => (
                <li key={u.id}>
                  <a href={`/${encodeURIComponent(u.name)}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                    <Image src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          )
        ) : tab === "groups" ? (
          ownedGroups.length === 0 && joinedGroups.length === 0 ? (
            <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>尚無群組</p>
          ) : (
            <div className="flex flex-col gap-6">
              {ownedGroups.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>我建立的群組</p>
                  {ownedGroups.map(g => (
                    <Link
                      key={g.id}
                      href={profileHref}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
                    >
                      <span className="text-sm font-medium" style={{ color: "#b19739" }}>{g.name}</span>
                      <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{g.memberCount ?? 0} 位成員</span>
                    </Link>
                  ))}
                </div>
              )}
              {joinedGroups.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>加入的群組</p>
                  {joinedGroups.map(g => (
                    <Link
                      key={g.id}
                      href={profileHref}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
                    >
                      <span className="text-sm font-medium" style={{ color: "#5fa870" }}>{g.name}</span>
                      <span className="flex items-center gap-1.5">
                        <Image src={g.ownerAvatarUrl || AVATAR_PLACEHOLDER} alt={g.ownerName ?? ""} width={18} height={18} unoptimized className="rounded-full object-cover" style={{ width: 18, height: 18 }} />
                        <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{g.ownerName ?? ""}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        ) : tab === "record" ? (
          records.length === 0 ? (
            <p className="text-sm zen-subtle opacity-50">尚無紀錄</p>
          ) : (
            <>
              <p className="text-xs text-zinc-400 mb-4">保留最近十筆測驗紀錄</p>
              <div className="space-y-3">
                {[...records]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .slice(-10).reverse()
                  .map((item, index) => (
                    <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--zen-ink)" }}>
                            {ENGLISH_SET_NAMES[item.set] ?? item.set}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-600" style={{ color: "var(--zen-ink)" }}>
                            {item.category === "詩文背誦"
                              ? (item.success ? "✓ 成功" : "✗ 失敗")
                              : `${item.correct}/${item.answered}`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {new Date(item.timestamp).toLocaleDateString("zh-TW", {
                            year: "numeric", month: "2-digit", day: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )
        ) : tab === "blocked" ? (
          !isOwner ? (
            <Link href={profileHref} className="inline-block text-sm px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--zen-ink)" }}>
              前往「{label}」
            </Link>
          ) : blockedUsers.length === 0 ? (
            <p className="text-sm zen-subtle opacity-50">尚無封鎖帳號</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {blockedUsers.map(u => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <Image src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover shrink-0" />
                  <span className="text-sm font-medium truncate" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                </li>
              ))}
            </ul>
          )
        ) : tab === "shared" ? (
          !isOwner ? (
            <Link href={profileHref} className="inline-block text-sm px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" style={{ color: "var(--zen-ink)" }}>
              前往「{label}」
            </Link>
          ) : sharedCats.length === 0 ? (
            <p className="text-sm zen-subtle opacity-50">尚無分享項目</p>
          ) : (
            <div className="bookshelf-grid">
              {(() => {
                let listIdx = 0, catIdx = 0;
                return sharedCats.map(cat => {
                  const key = cat.categoryKey;
                  const isList = key.startsWith("list:");
                  const href = isList
                    ? `/test/list?listId=${key.slice(5)}&autostart=1`
                    : key.includes(":")
                      ? `/test/${encodeURIComponent(key.split(":")[0])}?levels=${encodeURIComponent(key.split(":")[1])}&autostart=1`
                      : `/test/${encodeURIComponent(key)}?autostart=1`;
                  const color = "#5fa870";
                  if (isList) listIdx++; else catIdx++;
                  return (
                    <a key={cat.id} href={href} className="book-link bookshelf-btn" style={{ color }}>
                      {cat.categoryName}{cat.sharedByName ? ` [${cat.sharedByName}]` : ""}
                    </a>
                  );
                });
              })()}
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
