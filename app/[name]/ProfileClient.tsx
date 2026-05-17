"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import NextImage from "next/image";
import type { QuestionList, ListQuestion } from "../../lib/lists-supabase";
import zhTW from "../../public/locale/zh-TW.js";
import type { CategoryNode } from "../components/CategoryNode";
import { PersonalListsView } from "../components/PersonalListsView";
import { SocialIcon } from "../components/SocialIcon";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";
import { getProfileText, normalizeProfileLanguage, type SupportedUILanguage } from "../lib/i18n/profile";

// ── locale helpers ────────────────────────────────────────────────────────────

type LevelEntry = { name: string; levels: number[] };
const SIMPLE_LABELS: Record<string, string> = {};
const LEVEL_LABELS: Record<string, LevelEntry[]> = {};

(function buildLabels() {
  const nodes = zhTW as CategoryNode[];
  function parseHref(href: string) {
    const m = href.match(/^\/test\/([^?]+)(?:\?levels=(.+))?/);
    if (!m) return null;
    return { id: m[1], levels: m[2] ? m[2].split(",").map(Number) : [] };
  }
  for (const node of nodes) {
    if (node.href) {
      const p = parseHref(node.href);
      if (p && !SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
    }
    if (node.children) {
      for (const child of node.children) {
        if (!child.href) continue;
        const p = parseHref(child.href);
        if (!p) continue;
        if (p.levels.length > 0) {
          (LEVEL_LABELS[p.id] = LEVEL_LABELS[p.id] ?? []).push({ name: child.name, levels: p.levels });
          if (!SIMPLE_LABELS[p.id]) SIMPLE_LABELS[p.id] = node.name;
        } else if (!SIMPLE_LABELS[p.id]) {
          SIMPLE_LABELS[p.id] = child.name;
        }
      }
    }
  }
})();

function getCollectionLabel(collectionId: string, level?: number | null): string {
  if (level != null && LEVEL_LABELS[collectionId]) {
    const match = LEVEL_LABELS[collectionId].find(e => e.levels.includes(level));
    if (match) return match.name;
  }
  return SIMPLE_LABELS[collectionId] ?? collectionId;
}

// ── types ─────────────────────────────────────────────────────────────────────

type Tab = "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked" | "shared";

type SharedCategory = { id: string; categoryKey: string; categoryName: string; sharedByName?: string };

type GroupMember = { userId: string; userName: string; avatarUrl?: string; status: "pending" | "accepted"; invitedAt: string };
type Group = { id: string; name: string; ownerId: string; ownerName?: string; ownerAvatarUrl?: string; createdAt: string; memberCount?: number; members?: GroupMember[] };
type PendingInvite = { groupId: string; groupName: string; ownerName: string; invitedAt: string };

type FollowUser = { id: string; name: string; avatarUrl?: string };
type MyCollection = {
  id: string;
  collectionId: string;
  href?: string | null;
  displayName: string;
  createdAt: string;
  fromGrid?: boolean;
  parentId?: string | null;
  problemsPerTest?: number | null;
  shuffleProblems?: boolean | null;
  approvalStatus?: string;
  language: string;
};
type UserFolder = { id: string; name: string; parentId: string | null; isPublic: boolean };

type SocialLinks = { x?: string; facebook?: string; instagram?: string; threads?: string; website?: string };

type QuizRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category?: string;
  success?: boolean;
  answers?: { n: number; u: string | string[] | null }[];
};

function recordToUrl(set: string, replayKey?: string): string | null {
  const sep = set.lastIndexOf("@@");
  const key = sep > 0 ? set.slice(sep + 2) : set;
  if (key.startsWith("個人試卷") || key.toLowerCase().startsWith("personal")) return null;
  const colonIdx = key.indexOf(":");
  let url: string;
  if (colonIdx !== -1) {
    const id = key.slice(0, colonIdx);
    const levels = key.slice(colonIdx + 1);
    url = `/test/${encodeURIComponent(id)}?levels=${encodeURIComponent(levels)}`;
  } else {
    url = `/test/${encodeURIComponent(key)}`;
  }
  if (replayKey) url += `${url.includes("?") ? "&" : "?"}replay=${encodeURIComponent(replayKey)}`;
  url += `${url.includes("?") ? "&" : "?"}autostart=1`;
  return url;
}

function recordDisplaySet(set: string): string {
  const sep = set.lastIndexOf("@@");
  const label = sep > 0 ? set.slice(0, sep) : set;
  return ENGLISH_SET_NAMES[label] ?? label;
}

const ENGLISH_SET_NAMES: Record<string, string> = {
  "englishWords:1,2": "2000 Words",
  "englishWords:3,4": "4000 Words",
  "englishWords:5,6": "6000 Words",
  englishWords: "English Words",
  quoteChinese: "Quotes",
};

export type InitialProfile = {
  id: string;
  name: string;
  email?: string;        // always passed from server (used for client isOwner check)
  emailPublic?: boolean;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: Record<string, string | undefined>;
  records?: QuizRecord[];
};

type Props = {
  urlName: string;
  isOwner: boolean;
  initialProfile: InitialProfile;
};

// ── main component ────────────────────────────────────────────────────────────

export default function ProfileClient({ urlName, isOwner: initialIsOwner, initialProfile }: Props) {
  const { data: session, status } = useSession();
  const [uiLang, setUiLang] = useState<SupportedUILanguage>("zh-TW");

  const isOwner = React.useMemo(() => {
    if (initialIsOwner) return true;
    if (status === "loading" || !session?.user) return false;
    const nameMatch = (session.user as any).name === urlName;
    const emailMatch = Boolean(initialProfile.email && (session.user as any).email === initialProfile.email);
    return nameMatch || emailMatch;
  }, [initialIsOwner, session, status, urlName, initialProfile.email]);
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  // ── profile state ──
  const [name, setName] = useState(initialProfile.name || "");
  const [email] = useState(initialProfile.email || "");
  const [emailPublic, setEmailPublic] = useState(Boolean(initialProfile.emailPublic));
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [avatarUrl, setAvatarUrl] = useState(initialProfile.avatarUrl || "");
  const [socialLinks, setSocialLinks] = useState<SocialLinks>((initialProfile.socialLinks as SocialLinks) || {});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ── lists state ──
  const [listsLoaded, setListsLoaded] = useState(false);
  const [listsLoading, setListsLoading] = useState(false);
  const [lists, setLists] = useState<QuestionList[]>([]);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // ── record state ──
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [recordLoading, setRecordLoading] = useState(false);
  const [quizRecords, setQuizRecords] = useState<QuizRecord[]>(initialProfile.records || []);

  // ── follow state ──
  const [followersLoaded, setFollowersLoaded] = useState(false);
  const [followersLoading, setFollowersLoading] = useState(false);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [followingLoaded, setFollowingLoaded] = useState(false);
  const [followingLoading, setFollowingLoading] = useState(false);
  const [following, setFollowing] = useState<FollowUser[]>([]);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── blocked state ──
  const [blockedLoaded, setBlockedLoaded] = useState(false);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<FollowUser[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // ── shared-with-me state ──
  const [sharedLoaded, setSharedLoaded] = useState(false);
  const [sharedLoading, setSharedLoading] = useState(false);
  const [sharedCats, setSharedCats] = useState<SharedCategory[]>([]);

  // ── groups state ──
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [activeGroupLoading, setActiveGroupLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupInviteInput, setGroupInviteInput] = useState("");
  const [groupInviteLoading, setGroupInviteLoading] = useState(false);
  const [groupInviteError, setGroupInviteError] = useState<string | null>(null);
  const [groupSearchResults, setGroupSearchResults] = useState<{ id: string; name: string; avatarUrl?: string }[]>([]);
  const [groupSearchLoading, setGroupSearchLoading] = useState(false);
  const [groupInvitedIds, setGroupInvitedIds] = useState<Set<string>>(new Set());
  const groupSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [groupShareListId, setGroupShareListId] = useState("");
  const [groupShareLoading, setGroupShareLoading] = useState(false);
  const [groupShareMsg, setGroupShareMsg] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // share-panel unified search (lists tab)
  type ShareResult = { type: "user" | "group"; id: string; name: string; avatarUrl?: string; memberCount?: number };
  const [shareSearchResults, setShareSearchResults] = useState<ShareResult[]>([]);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const [shareSharedGroupIds, setShareSharedGroupIds] = useState<Set<string>>(new Set());
  const shareSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [profileFolders, setProfileFolders] = useState<UserFolder[]>([]);
  const [myCollectionsLoaded, setMyCollectionsLoaded] = useState(false);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });

  // ── pinned profile tabs (shown on home page) ─────────────────────────────
  type PinnedTab = { name: string; tab: Tab; label: string };
  const [pinnedTabs, setPinnedTabs] = useState<PinnedTab[]>([]);
  const [tabCtxMenu, setTabCtxMenu] = useState<{ tab: Tab; label: string; x: number; y: number } | null>(null);
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    // For logged-in owners: load profileLanguage from Supabase, fall back to localStorage -> siteLanguage
    const localLang = localStorage.getItem("profileLanguage") as SupportedUILanguage | null;
    const siteLang = localStorage.getItem("siteLanguage") as SupportedUILanguage | null;

    if (isOwner) {
      fetch("/api/user/profile")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const serverLang = d?.user?.profileLanguage as SupportedUILanguage | undefined;
          const resolved = serverLang ?? localLang ?? siteLang ?? "zh-TW";
          setUiLang(resolved);
          // Sync localStorage so it's available immediately on next visit before fetch
          if (serverLang) localStorage.setItem("profileLanguage", serverLang);
        })
        .catch(() => {
          setUiLang(localLang ?? siteLang ?? "zh-TW");
        });
    } else {
      setUiLang(localLang ?? siteLang ?? "zh-TW");
    }
  }, [isOwner]);

  const setProfileLanguage = (lang: SupportedUILanguage) => {
    localStorage.setItem("profileLanguage", lang);
    setUiLang(lang);
    window.dispatchEvent(new Event("profile-language-change"));
    // Persist to Supabase for logged-in owners
    if (isOwner) {
      fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileLanguage: lang }),
      }).catch(() => {});
    }
  };

  const t = (key: Parameters<typeof getProfileText>[1]) => getProfileText(uiLang, key);
  const normalizedProfileLang = normalizeProfileLanguage(uiLang);
  const dateLocale = normalizedProfileLang === "en" ? "en-US" : normalizedProfileLang === "zh-CN" ? "zh-CN" : "zh-TW";

  useEffect(() => {
    if (isLoggedIn) {
      fetch("/api/user/pins")
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d && Array.isArray(d.pinnedProfileTabs)) setPinnedTabs(d.pinnedProfileTabs);
        })
        .catch(() => {});
    } else {
      try {
        const stored = localStorage.getItem("pinnedProfileTabs");
        if (stored) setPinnedTabs(JSON.parse(stored));
      } catch {}
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      const valid: Tab[] = ["profile", "lists", "record", "followers", "following", "groups", "blocked", "shared"];
      if (t && (valid as string[]).includes(t)) setActiveTab(t as Tab);
    } catch {}
  }, []);

  useEffect(() => {
    if (!tabCtxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setTabCtxMenu(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tabCtxMenu]);

  // Only these tabs can be pinned to home page
  const PINNABLE_TABS: Tab[] = ["lists", "shared"];
  const isTabPinnable = (tab: Tab) => PINNABLE_TABS.includes(tab);
  const isTabPinned = (tab: Tab) => pinnedTabs.some(p => p.name === urlName && p.tab === tab);
  const persistPinnedTabs = (next: PinnedTab[]) => {
    if (isLoggedIn) {
      fetch("/api/user/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedProfileTabs: next }),
      }).catch(() => {});
    } else {
      try { localStorage.setItem("pinnedProfileTabs", JSON.stringify(next)); } catch {}
    }
  };
  const togglePinTab = (tab: Tab, label: string) => {
    // Only allow pinning of specific tabs
    if (!isTabPinnable(tab)) return;
    setPinnedTabs(prev => {
      const exists = prev.some(p => p.name === urlName && p.tab === tab);
      const next = exists
        ? prev.filter(p => !(p.name === urlName && p.tab === tab))
        : [...prev, { name: urlName, tab, label }];
      persistPinnedTabs(next);
      return next;
    });
    setTabCtxMenu(null);
  };


  // ── load lists when tab activated ─────────────────────────────────────────

  useEffect(() => {
    if ((activeTab !== "lists" && activeTab !== "groups") || listsLoaded) return;
    setListsLoading(true);
    if (isOwner) {
      fetch("/api/lists")
        .then(r => r.json())
        .then(d => {
          setLists(d.lists ?? []);
          setListsLoaded(true);
        })
        .finally(() => setListsLoading(false));
    } else {
      fetch(`/api/users/${encodeURIComponent(urlName)}/lists`)
        .then(r => r.json())
        .then(d => {
          setLists(d.lists ?? []);
          setMyCollections((d.collections ?? []).filter((c: { approvalStatus?: string }) => c.approvalStatus !== "pending"));
          setProfileFolders(d.folders ?? []);
          setMyCollectionsLoaded(true);
          setListsLoaded(true);
        })
        .finally(() => setListsLoading(false));
    }
  }, [activeTab, listsLoaded, isOwner, urlName]);

  useEffect(() => {
    if (activeTab !== "lists" || !isOwner || myCollectionsLoaded) return;
    fetch("/api/my-collections?allLanguages=1")
      .then(r => r.json())
      .then(d => {
        setMyCollections((d.collections ?? []).filter((c: { approvalStatus?: string }) => c.approvalStatus !== "pending"));
        setMyCollectionsLoaded(true);
      })
      .catch(() => {
        setMyCollections([]);
        setMyCollectionsLoaded(true);
      });
  }, [activeTab, isOwner, myCollectionsLoaded]);

  // ── load records when tab activated ───────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "record" || recordLoaded) return;
    setRecordLoading(true);
    fetch(`/api/user/profile?name=${encodeURIComponent(urlName)}`)
      .then(r => r.json())
      .then(data => { setQuizRecords(data.user?.records || []); setRecordLoaded(true); })
      .finally(() => setRecordLoading(false));
  }, [activeTab, recordLoaded, urlName]);

  // ── load follow & block status on mount ──────────────────────────────────

  useEffect(() => {
    if (!urlName || !session?.user) return;
    fetch(`/api/users/${encodeURIComponent(urlName)}/follow`)
      .then(r => r.json())
      .then(d => setIsFollowing(Boolean(d.following)))
      .catch(() => {});
    fetch(`/api/users/${encodeURIComponent(urlName)}/block`)
      .then(r => r.json())
      .then(d => setIsBlocking(Boolean(d.blocking)))
      .catch(() => {});
  }, [urlName, session]);

  // ── load followers tab ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "followers" || followersLoaded) return;
    setFollowersLoading(true);
    fetch(`/api/users/${encodeURIComponent(urlName)}/followers`)
      .then(r => r.json())
      .then(d => {
        const list = (d.followers ?? []) as Array<{ followerName: string; followerAvatarUrl?: string; followerId: string }>;
        setFollowers(list.map(f => ({ id: f.followerId, name: f.followerName, avatarUrl: f.followerAvatarUrl })));
        setFollowersLoaded(true);
      })
      .finally(() => setFollowersLoading(false));
  }, [activeTab, followersLoaded, urlName]);

  // ── load following tab ────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "following" || followingLoaded) return;
    setFollowingLoading(true);
    fetch(`/api/users/${encodeURIComponent(urlName)}/following`)
      .then(r => r.json())
      .then(d => {
        const list = (d.following ?? []) as Array<{ followingName: string; followingAvatarUrl?: string; followingId: string }>;
        setFollowing(list.map(f => ({ id: f.followingId, name: f.followingName, avatarUrl: f.followingAvatarUrl })));
        setFollowingLoaded(true);
      })
      .finally(() => setFollowingLoading(false));
  }, [activeTab, followingLoaded, urlName]);

  // ── load blocked tab ─────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "blocked" || blockedLoaded || !isOwner) return;
    setBlockedLoading(true);
    fetch("/api/users/blocked")
      .then(r => r.json())
      .then(d => {
        setBlockedUsers((d.blocked ?? []) as FollowUser[]);
        setBlockedLoaded(true);
      })
      .finally(() => setBlockedLoading(false));
  }, [activeTab, blockedLoaded, isOwner]);

  // ── load shared-with-me tab ──────────────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "shared" || sharedLoaded || !isOwner) return;
    setSharedLoading(true);
    fetch("/api/categories/shared")
      .then(r => r.json())
      .then(d => {
        setSharedCats((d.sharedCategories ?? []) as SharedCategory[]);
        setSharedLoaded(true);
      })
      .finally(() => setSharedLoading(false));
  }, [activeTab, sharedLoaded, isOwner]);

  // ── load groups when tab activated ───────────────────────────────────────

  useEffect(() => {
    if (activeTab !== "groups" || groupsLoaded || !isOwner) return;
    setGroupsLoading(true);
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => {
        setOwnedGroups(d.owned ?? []);
        setJoinedGroups(d.joined ?? []);
        // Check pending invites
        fetch("/api/groups/invites")
          .then(r => r.json())
          .then(inv => setPendingInvites(inv.invites ?? []))
          .catch(() => {});
        setGroupsLoaded(true);
      })
      .finally(() => setGroupsLoading(false));
  }, [activeTab, groupsLoaded, isOwner]);

  const closeGroupSheet = () => {
    setActiveGroupId(null);
    setActiveGroup(null);
    setGroupInviteInput("");
    setGroupSearchResults([]);
    setGroupInviteError(null);
    setGroupInvitedIds(new Set());
    setGroupShareMsg(null);
  };

  const loadActiveGroup = (groupId: string) => {
    setActiveGroupId(groupId);
    setActiveGroupLoading(true);
    setActiveGroup(null);
    setGroupInviteInput("");
    setGroupSearchResults([]);
    setGroupInviteError(null);
    setGroupInvitedIds(new Set());
    setGroupShareMsg(null);
    fetch(`/api/groups/${groupId}`)
      .then(r => r.json())
      .then(d => setActiveGroup(d.group ?? null))
      .finally(() => setActiveGroupLoading(false));
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName.trim() }),
    });
    const d = await res.json();
    if (d.group) {
      setOwnedGroups(prev => [d.group, ...prev]);
      setNewGroupName("");
    }
    setCreatingGroup(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setOwnedGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeGroupId === groupId) closeGroupSheet();
  };

  const handleInviteSearch = (q: string) => {
    setGroupInviteInput(q);
    setGroupInviteError(null);
    if (groupSearchTimer.current) clearTimeout(groupSearchTimer.current);
    if (!q.trim()) { setGroupSearchResults([]); return; }
    groupSearchTimer.current = setTimeout(async () => {
      setGroupSearchLoading(true);
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        setGroupSearchResults(d.users ?? []);
      } finally {
        setGroupSearchLoading(false);
      }
    }, 300);
  };

  const handleInvite = async (userName: string, userId: string) => {
    if (!activeGroupId) return;
    setGroupInviteLoading(true);
    setGroupInviteError(null);
    const res = await fetch(`/api/groups/${activeGroupId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userName }),
    });
    const d = await res.json();
    if (d.ok) {
      setGroupInvitedIds(prev => new Set(prev).add(userId));
      loadActiveGroup(activeGroupId);
    } else {
      setGroupInviteError(d.error ?? `${t("invite")} failed`);
    }
    setGroupInviteLoading(false);
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeGroupId) return;
    await fetch(`/api/groups/${activeGroupId}/members/${userId}`, { method: "DELETE" });
    loadActiveGroup(activeGroupId);
  };

  const handleShareListToGroup = async () => {
    if (!groupShareListId || !activeGroupId) return;
    setGroupShareLoading(true);
    setGroupShareMsg(null);
    const res = await fetch(`/api/groups/${activeGroupId}/share-list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listId: groupShareListId }),
    });
    const d = await res.json();
    setGroupShareMsg(d.ok ? `${t("share")} ${d.shared} ${t("sharedCountSuffix")}` : (d.error ?? t("shareFailed")));
    setGroupShareLoading(false);
  };

  const handleAcceptInvite = async (groupId: string) => {
    await fetch(`/api/groups/${groupId}/accept`, { method: "POST" });
    setPendingInvites(prev => prev.filter(inv => inv.groupId !== groupId));
    setGroupsLoaded(false);
  };

  const handleLeaveGroup = async (groupId: string) => {
    const user = session?.user as { id?: string } | undefined;
    if (!user?.id) return;
    await fetch(`/api/groups/${groupId}/members/${(session!.user as any).id}`, { method: "DELETE" });
    setJoinedGroups(prev => prev.filter(g => g.id !== groupId));
    if (activeGroupId === groupId) closeGroupSheet();
  };

  const handleUnblock = async (user: FollowUser) => {
    setUnblockingId(user.id);
    await fetch(`/api/users/${encodeURIComponent(user.name)}/block`, { method: "DELETE" });
    setBlockedUsers(prev => prev.filter(u => u.id !== user.id));
    setUnblockingId(null);
  };

  // ── load owned groups when share panel opens (for group-share dropdown) ──

  useEffect(() => {
    if (!shareOpenId || !isOwner || groupsLoaded) return;
    setGroupsLoading(true);
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => { setOwnedGroups(d.owned ?? []); setJoinedGroups(d.joined ?? []); setGroupsLoaded(true); })
      .finally(() => setGroupsLoading(false));
  }, [shareOpenId, isOwner, groupsLoaded]);

  // ── context menu close on Escape ─────────────────────────────────────────

  useEffect(() => {
    if (!isOwner) return;
    fetch("/api/user/pins")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.pinnedListIds)) setPinnedListIds(d.pinnedListIds);
        if (Array.isArray(d.pinnedCollectionIds)) setPinnedCollectionIds(d.pinnedCollectionIds);
      })
      .catch(() => {});
  }, [isOwner]);

  useEffect(() => {
    if (!colCtxMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setColCtxMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [colCtxMenuId]);

  useEffect(() => {
    if (!contextMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contextMenuId]);

  // ── group sheet close on Escape ───────────────────────────────────────────

  useEffect(() => {
    if (!activeGroupId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeGroupSheet(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [activeGroupId]);

  // ── profile actions ───────────────────────────────────────────────────────

  async function uploadAvatar(file: File) {
    setSaveError(null);
    if (file.size > 15 * 1024 * 1024) { setSaveError(t("imageTooLarge")); return; }
    const src = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result || ""));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("load failed"));
      i.src = src;
    });
    const max = 512;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0, w, h);
    let data = canvas.toDataURL("image/jpeg", 0.82);
    if (data.length > 2.5 * 1024 * 1024) data = canvas.toDataURL("image/jpeg", 0.7);
    const res = await fetch("/api/user/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.url) {
      setAvatarUrl(j.url);
      window.dispatchEvent(new Event("profile:updated"));
    } else {
      setSaveError(j?.error || t("avatarUploadFailed"));
    }
  }

  async function saveProfile() {
    setSaving(true); setSaveError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, bio, avatarUrl, socialLinks, emailPublic }),
    });
    const j = await res.json();
    setSaving(false);
    if (!res.ok) { setSaveError(j?.error || t("saveFailed")); return; }
    setEditing(false);
    window.dispatchEvent(new Event("profile:updated"));
  }

  function makeSocialHref(platform: string, value?: string) {
    if (!value) return null;
    const v = value.trim();
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    const clean = v.replace(/^@+/, "");
    switch (platform) {
      case "facebook": return `https://facebook.com/${clean}`;
      case "instagram": return `https://instagram.com/${clean}`;
      case "threads": return `https://www.threads.net/@${clean}`;
      case "x": return `https://x.com/${clean}`;
      case "website": return `https://${clean}`;
      default: return null;
    }
  }

  // ── lists actions ─────────────────────────────────────────────────────────

  const toggleListPin = (id: string) => {
    setPinnedListIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      fetch("/api/user/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedListIds: next }),
      }).catch(() => {});
      return next;
    });
  };

  const toggleCollectionPin = (id: string) => {
    setPinnedCollectionIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      fetch("/api/user/pins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedCollectionIds: next }),
      }).catch(() => {});
      return next;
    });
  };

  const togglePublic = async (list: QuestionList) => {
    setLists(prev => prev.map(l => l.id === list.id ? { ...l, isPublic: !l.isPublic } : l));
    await fetch(`/api/lists/${list.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublic: !list.isPublic }),
    });
  };

  const saveListEdit = async (id: string) => {
    if (!editTitle.trim()) return;
    setLists(prev => prev.map(l => l.id === id ? { ...l, title: editTitle.trim() } : l));
    setEditingListId(null);
    await fetch(`/api/lists/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
  };

  const deleteList = async (id: string) => {
    setLists(prev => prev.filter(l => l.id !== id));
    if (expandedId === id) setExpandedId(null);
    await fetch(`/api/lists/${id}`, { method: "DELETE" });
  };

  const removeQuestion = async (listId: string, questionId: string, collectionId: string) => {
    setLists(prev => prev.map(l =>
      l.id === listId
        ? { ...l, questions: l.questions.filter((q: ListQuestion) => !(q.questionId === questionId && q.collectionId === collectionId)) }
        : l
    ));
    await fetch(`/api/lists/${listId}/questions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, collectionId }),
    });
  };

  const handleShareSearch = (q: string) => {
    setShareInput(q);
    setShareError(null);
    if (shareSearchTimer.current) clearTimeout(shareSearchTimer.current);
    if (!q.trim()) { setShareSearchResults([]); return; }
    shareSearchTimer.current = setTimeout(async () => {
      setShareSearchLoading(true);
      const allGroups = [...ownedGroups, ...joinedGroups];
      const lq = q.toLowerCase();
      const matchGroups: ShareResult[] = allGroups
        .filter(g => g.name.toLowerCase().includes(lq))
        .map(g => ({ type: "group", id: g.id, name: g.name, memberCount: g.memberCount }));
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
        const d = await r.json();
        const users: ShareResult[] = (d.users ?? []).map((u: { id: string; name: string; avatarUrl?: string }) => ({ type: "user", id: u.id, name: u.name, avatarUrl: u.avatarUrl }));
        setShareSearchResults([...matchGroups, ...users]);
      } finally {
        setShareSearchLoading(false);
      }
    }, 300);
  };

  const removeShare = async (listId: string, targetName: string) => {
    await fetch(`/api/lists/${listId}/share`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetName }),
    });
    setLists(prev => prev.map(l =>
      l.id === listId ? { ...l, sharedWith: (l.sharedWith ?? []).filter(n => n !== targetName) } : l
    ));
  };

  // ── follow / block actions ────────────────────────────────────────────────

  const toggleFollow = async () => {
    if (followLoading) return;
    setFollowLoading(true);
    const method = isFollowing ? "DELETE" : "POST";
    await fetch(`/api/users/${encodeURIComponent(urlName)}/follow`, { method });
    setIsFollowing(f => !f);
    setFollowersLoaded(false);
    setFollowLoading(false);
    setShowUserMenu(false);
  };

  const toggleBlock = async () => {
    if (blockLoading) return;
    setBlockLoading(true);
    const method = isBlocking ? "DELETE" : "POST";
    const res = await fetch(`/api/users/${encodeURIComponent(urlName)}/block`, { method });
    if (res.ok) setIsBlocking(b => !b);
    setBlockLoading(false);
    setShowUserMenu(false);
  };

  const handleSignOut = async () => {
    try {
      localStorage.removeItem("avatarUrl");
      localStorage.removeItem("displayName");
      const csrfRes = await fetch("/api/auth/csrf", { method: "GET", credentials: "include" });
      if (!csrfRes.ok) throw new Error(`csrf_http_${csrfRes.status}`);
      const csrfJson = await csrfRes.json();
      const csrfToken = csrfJson?.csrfToken;
      if (!csrfToken) throw new Error("csrf_missing");

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "/api/auth/signout";
      const csrfInput = document.createElement("input");
      csrfInput.type = "hidden";
      csrfInput.name = "csrfToken";
      csrfInput.value = csrfToken;
      const callbackInput = document.createElement("input");
      callbackInput.type = "hidden";
      callbackInput.name = "callbackUrl";
      callbackInput.value = "/";
      form.appendChild(csrfInput);
      form.appendChild(callbackInput);
      document.body.appendChild(form);
      form.submit();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // ── tabs config ───────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; ownerOnly?: boolean }[] = [
    { id: "profile", label: t("tabProfile") },
    { id: "lists", label: t("tabLists") },
    { id: "shared", label: t("tabShared"), ownerOnly: true },
    { id: "record", label: t("tabRecord"), ownerOnly: true },
    { id: "groups", label: t("tabGroups"), ownerOnly: true },
    { id: "followers", label: t("tabFollowers") },
    { id: "following", label: t("tabFollowing") },
  ];
  const visibleTabs = tabs.filter(t => !t.ownerOnly || initialIsOwner);

  // ── group detail content (shared between desktop inline card and mobile sheet) ──

  const renderGroupDetailContent = () => {
    const isGroupOwner = ownedGroups.some(g => g.id === activeGroupId);
    const isGroupMember = joinedGroups.some(g => g.id === activeGroupId);
    const canInvite = isGroupOwner || isGroupMember;
    return (
      <div className="px-4 py-4 flex flex-col gap-5" style={{ backgroundColor: "var(--zen-bg)" }}>
        {activeGroupLoading && !activeGroup && (
          <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>{t("loading")}</p>
        )}
        {activeGroup && (
          <>
            {/* owner row (for joined groups) */}
            {isGroupMember && !isGroupOwner && activeGroup.ownerName && (
              <div className="flex items-center gap-2">
                <NextImage src={activeGroup.ownerAvatarUrl || AVATAR_PLACEHOLDER} alt={activeGroup.ownerName} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{activeGroup.ownerName}</span>
                <span className="text-xs opacity-40 border rounded-full px-2" style={{ borderColor: "currentColor", color: "var(--zen-ink)" }}>{t("groupOwner")}</span>
              </div>
            )}

            {/* members */}
            <div className="flex flex-col gap-3">
              <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("groupMembers")}</p>
              {activeGroup.members?.length === 0 && (
                <p className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{t("noMembers")}</p>
              )}
              {activeGroup.members?.map(m => (
                <div key={m.userId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <NextImage src={m.avatarUrl || AVATAR_PLACEHOLDER} alt={m.userName} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                    <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{m.userName}</span>
                    {m.status === "pending" && (
                      <span className="text-xs opacity-50 border rounded-full px-2" style={{ borderColor: "currentColor", color: "var(--zen-ink)" }}>{t("pendingAccept")}</span>
                    )}
                  </div>
                  {isGroupOwner && (
                    <button onClick={() => handleRemoveMember(m.userId)} className="text-xs opacity-40 hover:opacity-80 hover:text-red-500 transition-colors">{t("remove")}</button>
                  )}
                </div>
              ))}
            </div>

            {/* invite */}
            {canInvite && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("inviteMember")}</p>
                <input
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  placeholder={t("searchAccountPlaceholder")}
                  value={groupInviteInput}
                  onChange={e => handleInviteSearch(e.target.value)}
                />
                {groupSearchLoading && (
                  <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>{t("searching")}</p>
                )}
                {!groupSearchLoading && groupInviteInput.trim() && groupSearchResults.length === 0 && (
                  <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>{t("noUserFound")}</p>
                )}
                {groupSearchResults.length > 0 && (
                  <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl overflow-hidden border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)" }}>
                    {groupSearchResults.map(u => {
                      const alreadyMember = activeGroup?.members?.some(m => m.userId === u.id);
                      const justInvited = groupInvitedIds.has(u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--zen-bg)" }}>
                          <div className="flex items-center gap-2">
                            <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                            <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                          </div>
                          {alreadyMember ? (
                            <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{t("alreadyInGroup")}</span>
                          ) : justInvited ? (
                            <span className="text-xs" style={{ color: "#5fa870" }}>{t("invited")}</span>
                          ) : (
                            <button
                              onClick={() => handleInvite(u.name, u.id)}
                              disabled={groupInviteLoading}
                              className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                              style={{ borderColor: "#b19739", color: "#b19739" }}
                            >{t("invite")}</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {groupInviteError && <p className="text-xs text-red-500 px-1">{groupInviteError}</p>}
              </div>
            )}

            {/* share list */}
            {isGroupOwner && lists.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("shareListToGroup")}</p>
                <div className="flex gap-2">
                  <select
                    className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                    value={groupShareListId}
                    onChange={e => { setGroupShareListId(e.target.value); setGroupShareMsg(null); }}
                  >
                    <option value="">{t("selectList")}</option>
                    {lists.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                  </select>
                  <button
                    onClick={handleShareListToGroup}
                    disabled={groupShareLoading || !groupShareListId}
                    className="px-4 py-2 rounded-xl text-sm transition-opacity hover:opacity-80 disabled:opacity-30"
                    style={{ backgroundColor: "#5fa870", color: "#fff" }}
                  >{t("share")}</button>
                </div>
                {groupShareMsg && <p className="text-xs opacity-70" style={{ color: "var(--zen-ink)" }}>{groupShareMsg}</p>}
              </div>
            )}

            {/* delete / leave */}
            {isGroupOwner && (
              <button onClick={() => handleDeleteGroup(activeGroupId!)} className="text-xs self-start opacity-40 hover:opacity-80 hover:text-red-500 transition-colors">{t("deleteGroup")}</button>
            )}
            {joinedGroups.some(g => g.id === activeGroupId) && (
              <button onClick={() => handleLeaveGroup(activeGroupId!)} className="text-xs self-start opacity-40 hover:opacity-80 hover:text-red-500 transition-colors">{t("leaveGroup")}</button>
            )}
          </>
        )}
      </div>
    );
  };

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent dark:bg-black">
      <main className="w-full max-w-2xl md:max-w-4xl px-6 pt-10 pb-36 sm:pb-10">

        {/* header */}
        {activeTab !== "blocked" && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <NextImage
              src={avatarUrl || AVATAR_PLACEHOLDER}
              alt="avatar"
              width={96}
              height={96}
              unoptimized
              className="w-14 h-14 md:w-24 md:h-24 rounded-full object-cover"
            />
            <h1 className="text-2xl md:text-3xl font-bold zen-title" style={{ color: "#b19739" }}>{urlName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {/* profile-page language selector */}
            <select
              value={uiLang}
              onChange={e => setProfileLanguage(e.target.value as SupportedUILanguage)}
              className="text-xs px-2 py-1 rounded-full border outline-none cursor-pointer transition-colors hover:opacity-80"
              style={{ borderColor: "#D1D5DB", color: "#D1D5DB", background: "var(--zen-bg)" }}
              aria-label="Profile page language"
            >
              <option value="zh-TW">中文繁體</option>
              <option value="zh-CN">中文简体</option>
              <option value="en">English</option>
            </select>
            {isOwner && (
              <button
                onClick={handleSignOut}
                className="text-xs px-3 py-1.5 rounded-full border transition-colors"
                style={{ borderColor: "#b19739", color: "#b19739", background: "transparent" }}
              >
                {t("signOut")}
              </button>
            )}
            {!isOwner && session?.user && (
              <>
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className="text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50"
                  style={isFollowing
                    ? { borderColor: "#5fa870", color: "#5fa870", background: "transparent" }
                    : { borderColor: "#5fa870", color: "white", background: "#5fa870" }
                  }
                >
                  {isFollowing ? t("followed") : t("follow")}
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(m => !m)}
                    className="text-sm w-7 h-7 flex items-center justify-center rounded-full border transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", color: "var(--zen-ink)" }}
                    aria-label={t("moreOptions")}
                  >⋯</button>
                  {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                      <div className="absolute right-0 mt-1 z-50 w-28 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={toggleFollow}
                          disabled={followLoading}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                          style={{ color: "#5fa870" }}
                        >
                          {isFollowing ? t("unfollow") : t("follow")}
                        </button>
                        <button
                          type="button"
                          onClick={toggleBlock}
                          disabled={blockLoading}
                          className="w-full text-left px-4 py-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-40"
                          style={{ color: isBlocking ? "#ef4444" : "var(--zen-ink)" }}
                        >
                          {isBlocking ? t("unblock") : t("block")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* tab bar */}
        {activeTab !== "blocked" && (
        <div className="flex gap-1 mb-8 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visibleTabs.map((t, i) => {
            const tabColor = "#D1D5DB";
            return (
              <button
                key={t.id}
                onClick={() => { setActiveTab(t.id); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); }}
                onContextMenu={e => { e.preventDefault(); if (isOwner) setTabCtxMenu({ tab: t.id, label: t.label, x: e.clientX, y: e.clientY }); }}
                className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === t.id
                    ? "border-current"
                    : "border-transparent hover:opacity-70"
                }`}
                style={{ color: activeTab === t.id ? tabColor : tabColor, opacity: activeTab === t.id ? 1 : 0.45 }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        )}

        {/* ── profile tab ─────────────────────────────────────────────────── */}
        {activeTab === "profile" && (
          <div>
            <div className="flex flex-col gap-4">
              {/* avatar (large, editing mode) */}
              {editing && (
                <div className="flex items-center gap-4">
                  <NextImage src={avatarUrl || AVATAR_PLACEHOLDER} alt="avatar" width={96} height={96} unoptimized className="w-24 h-24 rounded-md object-cover" />
                  <div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); }} />
                    <button type="button"
                      className="px-4 py-2 border rounded-full border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      style={{ color: "var(--zen-ink)" }}
                      onClick={() => fileInputRef.current?.click()}>
                      {t("changeAvatar")}
                    </button>
                  </div>
                </div>
              )}

              {/* name */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t("displayName")}</label>
                {editing
                  ? <input className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none"
                      style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      value={name} onChange={e => setName(e.target.value)} />
                  : <p className="text-sm" style={{ color: "var(--zen-ink)" }}>{name || <span className="text-zinc-400">{t("notSet")}</span>}</p>
                }
              </div>

              {/* email */}
              {(isOwner || emailPublic) && (
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">{t("email")}</label>
                  <p className="text-sm" style={{ color: "var(--zen-ink)" }}>{email || <span className="text-zinc-400">{t("notSet")}</span>}</p>
                  {isOwner && editing && (
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input type="checkbox" checked={emailPublic}
                        onChange={e => setEmailPublic(e.target.checked)}
                        className="w-4 h-4" />
                      <span className="text-xs text-zinc-400">{t("publicEmail")}</span>
                    </label>
                  )}
                </div>
              )}

              {/* bio */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t("bio")}</label>
                {editing
                  ? <textarea className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none resize-none"
                      style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      rows={4} value={bio} onChange={e => setBio(e.target.value)} />
                  : <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--zen-ink)" }}>{bio || <span className="text-zinc-400">{t("notSetYet")}</span>}</p>
                }
              </div>

              {/* social links */}
              <div>
                <label className="block text-xs text-zinc-400 mb-1">{t("socialLinks")}</label>
                {editing ? (
                  <div className="flex flex-col gap-2">
                    {(["facebook", "instagram", "threads", "x", "website"] as const).map(p => (
                      <input key={p}
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                        placeholder={p === "x" ? "X (Twitter)" : p.charAt(0).toUpperCase() + p.slice(1)}
                        value={(socialLinks as any)[p] || ""}
                        onChange={e => setSocialLinks({ ...socialLinks, [p]: e.target.value })} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-row flex-wrap gap-3">
                    {(["facebook", "instagram", "threads", "x", "website"] as const).map(p => {
                      const val = (socialLinks as any)[p];
                      if (!val) return null;
                      const href = makeSocialHref(p, val);
                      const tooltip = p === "website" ? val : `${p}: ${val}`;
                      return (
                        <a
                          key={p}
                          href={href || undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={tooltip}
                          title={tooltip}
                          className="inline-flex items-center justify-center shrink-0 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)", width: 48, height: 48, aspectRatio: "1 / 1" }}
                        >
                          <SocialIcon platform={p} size={24} />
                        </a>
                      );
                    })}
                    {!Object.values(socialLinks).some(Boolean) && <span className="text-sm text-zinc-400">{t("notSetYet")}</span>}
                  </div>
                )}
              </div>

              {saveError && <p className="text-sm text-red-500">{saveError}</p>}

              {/* edit / save buttons */}
              {isOwner && (
                <div className="flex gap-2 mt-2">
                  {!editing
                    ? <button onClick={() => setEditing(true)}
                        className="px-4 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        style={{ color: "var(--zen-ink)" }}>
                        {t("edit")}
                      </button>
                    : <>
                        <button onClick={saveProfile} disabled={saving}
                          className="px-4 py-2 text-sm rounded-full bg-white text-black border hover:opacity-90 transition-opacity disabled:opacity-50">
                          {saving ? t("saving") : t("save")}
                        </button>
                        <button onClick={() => setEditing(false)}
                          className="px-4 py-2 text-sm rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}>
                          {t("cancel")}
                        </button>
                      </>
                  }
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── lists tab ───────────────────────────────────────────────────── */}
        {activeTab === "lists" && (
          <div>
            <PersonalListsView
              isOwner={isOwner}
              loading={listsLoading}
              lists={lists}
              setLists={setLists}
              myCollections={myCollections}
              folders={profileFolders}
              pinnedListIds={pinnedListIds}
              setPinnedListIds={setPinnedListIds}
              pinnedCollectionIds={pinnedCollectionIds}
              setPinnedCollectionIds={setPinnedCollectionIds}
              activeLanguage={uiLang}
            />

          </div>
        )}

        {/* ── record tab ──────────────────────────────────────────────────── */}
        {activeTab === "record" && (
          <div>
            <p className="text-xs text-zinc-400 mb-4">{t("recordHint")}</p>
            {recordLoading ? (
              <p className="text-sm zen-subtle">{t("loading")}</p>
            ) : quizRecords.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">{t("noRecords")}</p>
            ) : (
              <div className="space-y-3">
                {[...quizRecords]
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .slice(-10).reverse()
                  .map((item, index) => {
                    const replayKey = item.answers ? item.timestamp : undefined;
                    if (replayKey && item.answers) {
                      try { sessionStorage.setItem(`quiz_replay_${replayKey}`, JSON.stringify({ answers: item.answers })); } catch {}
                    }
                    const url = recordToUrl(item.set, replayKey);
                    const inner = (
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className="text-sm" style={{ color: "var(--zen-ink)" }}>
                            {recordDisplaySet(item.set)}
                          </span>
                          <span className="inline-block px-2 py-0.5 rounded text-xs border border-zinc-300 dark:border-zinc-600" style={{ color: "var(--zen-ink)" }}>
                            {item.category === "詩文背誦"
                              ? (item.success ? t("recitationSuccess") : t("recitationFail"))
                              : `${item.correct}/${item.answered}`}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          {new Date(item.timestamp).toLocaleDateString(dateLocale, {
                            year: "numeric", month: "2-digit", day: "2-digit",
                          })}
                        </p>
                      </div>
                    );
                    return url ? (
                      <a key={index} href={url} className="block border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        {inner}
                      </a>
                    ) : (
                      <div key={index} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4">
                        {inner}
                      </div>
                    );
                  })}

              </div>
            )}
          </div>
        )}

        {/* ── followers tab ───────────────────────────────────────────────── */}
        {activeTab === "followers" && (
          <div>
            {followersLoading ? (
              <p className="text-sm zen-subtle">{t("loading")}</p>
            ) : followers.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">{t("noFollowers")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {followers.map(u => (
                  <li key={u.id}>
                    <a href={`/${encodeURIComponent(u.name)}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── groups tab ──────────────────────────────────────────────────── */}
        {activeTab === "groups" && (
          <div className="flex flex-col gap-6">
            {groupsLoading && <p className="text-sm zen-subtle opacity-50">{t("loading")}</p>}

            {/* pending invites */}
            {pendingInvites.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("pendingInvites")}</p>
                {pendingInvites.map(inv => (
                  <div key={inv.groupId} className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div>
                      <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{inv.groupName}</span>
                      {inv.ownerName && <span className="text-xs opacity-40 ml-2" style={{ color: "var(--zen-ink)" }}>{inv.ownerName}</span>}
                    </div>
                    <button
                      onClick={() => handleAcceptInvite(inv.groupId)}
                      className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80"
                      style={{ borderColor: "#5fa870", color: "#5fa870" }}
                    >{t("accept")}</button>
                  </div>
                ))}
              </div>
            )}

            {/* create group */}
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2 rounded-xl border text-sm outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                placeholder={t("groupNamePlaceholder")}
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateGroup(); }}
              />
              <button
                onClick={handleCreateGroup}
                disabled={creatingGroup || !newGroupName.trim()}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
                style={{ backgroundColor: "#5fa870", color: "#fff" }}
              >{t("create")}</button>
            </div>


            {/* owned groups */}
            {ownedGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("myGroups")}</p>
                {ownedGroups.map(g => (
                  <div key={g.id} className="flex flex-col">
                    <button
                      onClick={() => activeGroupId === g.id ? closeGroupSheet() : loadActiveGroup(g.id)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      style={{ borderColor: activeGroupId === g.id ? "#b19739" : "color-mix(in srgb, var(--zen-ink) 15%, transparent)", borderBottomLeftRadius: activeGroupId === g.id ? 0 : undefined, borderBottomRightRadius: activeGroupId === g.id ? 0 : undefined }}
                    >
                      <span className="text-sm font-medium" style={{ color: "#b19739" }}>{g.name}</span>
                      <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{g.memberCount ?? 0} {t("membersCountSuffix")}</span>
                    </button>
                    {activeGroupId === g.id && (
                      <div className="hidden sm:block border border-t-0 rounded-b-xl overflow-hidden" style={{ borderColor: "#b19739" }}>
                        {renderGroupDetailContent()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* joined groups */}
            {joinedGroups.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{t("joinedGroups")}</p>
                {joinedGroups.map(g => (
                  <div key={g.id} className="flex flex-col">
                    <button
                      onClick={() => activeGroupId === g.id ? closeGroupSheet() : loadActiveGroup(g.id)}
                      className="flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      style={{ borderColor: activeGroupId === g.id ? "#5fa870" : "color-mix(in srgb, var(--zen-ink) 15%, transparent)", borderBottomLeftRadius: activeGroupId === g.id ? 0 : undefined, borderBottomRightRadius: activeGroupId === g.id ? 0 : undefined }}
                    >
                      <span className="text-sm font-medium" style={{ color: "#5fa870" }}>{g.name}</span>
                      <span className="flex items-center gap-1.5">
                        {g.ownerAvatarUrl ? (
                          <NextImage src={g.ownerAvatarUrl} alt={g.ownerName ?? ""} width={18} height={18} className="rounded-full object-cover" style={{ width: 18, height: 18 }} />
                        ) : (
                          <NextImage src={AVATAR_PLACEHOLDER} alt={g.ownerName ?? ""} width={18} height={18} className="rounded-full" style={{ width: 18, height: 18 }} />
                        )}
                        <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{g.ownerName ?? ""}</span>
                      </span>
                    </button>
                    {activeGroupId === g.id && (
                      <div className="hidden sm:block border border-t-0 rounded-b-xl overflow-hidden" style={{ borderColor: "#5fa870" }}>
                        {renderGroupDetailContent()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!groupsLoading && ownedGroups.length === 0 && joinedGroups.length === 0 && groupsLoaded && (
              <p className="text-sm opacity-40" style={{ color: "var(--zen-ink)" }}>{t("noGroups")}</p>
            )}
          </div>
        )}

        {/* ── group bottom sheet (mobile only) ───────────────────────────── */}
        {activeTab === "groups" && activeGroupId && typeof window !== "undefined" && createPortal(
          <div className="sm:hidden">
            {/* backdrop */}
            <div className="fixed inset-0 z-40 bg-black/40" onClick={() => closeGroupSheet()} />
            {/* sheet */}
            <div
              className="sheet-slide-up fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl shadow-2xl flex flex-col"
              style={{ backgroundColor: "var(--zen-bg)", borderTop: "1px solid color-mix(in srgb, var(--zen-ink) 12%, transparent)", maxHeight: "80dvh" }}
            >
              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)" }} />
              </div>
              {/* header */}
              <div className="flex items-center justify-between px-5 py-3 shrink-0" style={{ borderBottom: "1px solid color-mix(in srgb, var(--zen-ink) 8%, transparent)" }}>
                <span className="font-semibold text-base" style={{ color: "var(--zen-ink)" }}>
                  {activeGroupLoading ? t("loading") : activeGroup?.name}
                </span>
                <button
                  onClick={() => closeGroupSheet()}
                  className="w-7 h-7 flex items-center justify-center rounded-full opacity-40 hover:opacity-70 text-sm"
                  style={{ color: "var(--zen-ink)" }}
                >✕</button>
              </div>
              {/* scrollable content */}
              <div className="overflow-y-auto pb-8">
                {renderGroupDetailContent()}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* ── following tab ───────────────────────────────────────────────── */}
        {activeTab === "following" && (
          <div>
            {followingLoading ? (
              <p className="text-sm zen-subtle">{t("loading")}</p>
            ) : following.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">{t("noFollowing")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {following.map(u => (
                  <li key={u.id}>
                    <a href={`/${encodeURIComponent(u.name)}`} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                      <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── shared-with-me tab ──────────────────────────────────────────── */}
        {activeTab === "shared" && (
          <div>
            {sharedLoading ? (
              <p className="text-sm zen-subtle">{t("loading")}</p>
            ) : sharedCats.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">{t("sharedWithMeEmpty")}</p>
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
                      <a
                        key={cat.id}
                        href={href}
                        className="book-link bookshelf-btn"
                        style={{ color }}
                      >
                        {cat.categoryName}{cat.sharedByName ? ` [${cat.sharedByName}]` : ""}
                      </a>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── blocked tab ─────────────────────────────────────────────────── */}
        {activeTab === "blocked" && (
          <div className="pt-[calc(2rem+3cm)]">
            {blockedLoading ? (
              <p className="text-sm zen-subtle">{t("loading")}</p>
            ) : blockedUsers.length === 0 ? (
              <p className="text-sm zen-subtle opacity-50">{t("noBlocked")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {blockedUsers.map(u => (
                  <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={32} height={32} unoptimized className="w-8 h-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm font-medium truncate" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                    </div>
                    <button
                      onClick={() => handleUnblock(u)}
                      disabled={unblockingId === u.id}
                      className="shrink-0 text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                      style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 30%, transparent)", color: "var(--zen-ink)" }}
                    >
                        {unblockingId === u.id ? t("unblocking") : t("unblock")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

      </main>

      {/* ── tab right-click menu ─────────────────────────────────────────── */}
      {tabCtxMenu && isTabPinnable(tabCtxMenu.tab) && typeof window !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTabCtxMenu(null)} onContextMenu={e => { e.preventDefault(); setTabCtxMenu(null); }} />
          <div
            className="fixed z-50 w-32 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ top: tabCtxMenu.y, left: tabCtxMenu.x }}
          >
            <button
              type="button"
              onClick={() => togglePinTab(tabCtxMenu.tab, tabCtxMenu.label)}
              className="w-full text-left px-4 py-2.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}
            >
              {isTabPinned(tabCtxMenu.tab) ? t("removeFromHome") : t("showOnHome")}
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
