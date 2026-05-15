"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";
import LanguageSelector from "./LanguageSelector";
import type { CategoryNode } from "./CategoryNode";
import type { MyCollection } from "./PersonalListsView";
import { PinnedProfileTabSection } from "./PinnedProfileTabSection";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";
import type { QuestionList } from "../../lib/lists-supabase";

type UserResult = { 
  id: string; 
  name: string; 
  avatarUrl?: string;
  categories?: Array<{
    id: string;
    name: string;
    href?: string;
    isFolder?: boolean;
    parentId?: string | null;
    problemsPerTest?: number | null;
    shuffleProblems?: boolean | null;
  }>;
  lists?: Array<{
    id: string;
    title: string;
  }>;
};
type RecommendedCategory = {
  id: string;
  name: string;
  href?: string;
  isFolder?: boolean;
  parentId?: string | null;
  problemsPerTest?: number | null;
  shuffleProblems?: boolean | null;
};
type ExternalPinnedRef = {
  name: string;
  href?: string;
  kind: "link" | "folder";
  ownerId?: string;
  folderId?: string;
};
type CtxMenu = {
  id: string;
  name: string;
  href?: string;
  x: number;
  y: number;
  from: "pinned" | "grid" | "inbox" | "inbox-pinned" | "list-pinned" | "my-collection-pinned";
  meta?: { kind?: "folder"; ownerId?: string; folderId?: string };
};
type Group = { id: string; name: string };
type ShareTarget = { type: "user" | "group"; id: string; name: string; avatarUrl?: string; memberCount?: number };
type SharePanelState =
  | { kind: "category"; categoryKey: string; categoryName: string };

export function HomeContent() {
  const [language, setLanguage] = useState("zh-TW");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loadingLang, setLoadingLang] = useState(false);
  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [ownerCatResults, setOwnerCatResults] = useState<Array<{ id: string; name: string; href: string | null; isFolder: boolean; parentId: string | null; ownerId: string; ownerName: string | null; ownerAvatarUrl: string | null; problemsPerTest: number | null; shuffleProblems: boolean | null }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [externalPinnedRefs, setExternalPinnedRefs] = useState<Record<string, ExternalPinnedRef>>({});
  const [openPinnedKeyChain, setOpenPinnedKeyChain] = useState<string[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
  const [sharePanel, setSharePanel] = useState<SharePanelState | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareSearchResults, setShareSearchResults] = useState<ShareTarget[]>([]);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const [shareGroups, setShareGroups] = useState<Group[]>([]);
  const [shareSharedIds, setShareSharedIds] = useState<Set<string>>(new Set());
  const [shareSending, setSharingSending] = useState<string | null>(null);
  const [inboxCats, setInboxCats] = useState<{ id: string; categoryKey: string; categoryName: string; sharedByName?: string }[]>([]);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [pinnedInboxIds, setPinnedInboxIds] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  type PinnedProfileTab = { name: string; tab: string; label: string };
  const [pinnedProfileTabs, setPinnedProfileTabs] = useState<PinnedProfileTab[]>([]);
  const [profileTabCtxMenu, setProfileTabCtxMenu] = useState<{ name: string; tab: string; label: string; x: number; y: number } | null>(null);
  const [homeLists, setHomeLists] = useState<QuestionList[]>([]);
  const [homeListsLoaded, setHomeListsLoaded] = useState(false);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [recommendedAccounts, setRecommendedAccounts] = useState<UserResult[]>([]);
  const [recommendedLoaded, setRecommendedLoaded] = useState(false);
  const [openRecommendedFolderChains, setOpenRecommendedFolderChains] = useState<Record<string, string[]>>({});
  const pinsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shareDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const visiblePinnedProfileTabs = pinnedProfileTabs;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subjects = useFilteredCategories(categories, query);

  const FOLDER_COLOR = "#b19739"; // gold — nodes with children or dropdown
  const LEAF_COLOR = "#5fa870";   // green — leaf items (link directly to a test)
  const colorOf = (n: CategoryNode): string =>
    (n.children?.length || n.dropdown?.length) ? FOLDER_COLOR : LEAF_COLOR;
  const itemClassForDepth = (depth: number): string => {
    if (depth <= 0) return "book-link bookshelf-btn";
    if (depth === 1) return "book-link bookshelf-btn sub-item";
    return "book-link bookshelf-btn sub-sub-item";
  };

  // Build /test/<id> link plus per-collection test options. Folders (no href) stay inert.
  const hrefWithOptions = (n: CategoryNode): string => {
    if (!n.href || !n.id) return "#";
    const base = `/test/${encodeURIComponent(n.id)}`;
    const extra: string[] = [];
    if (n.problemsPerTest != null) extra.push(`count=${encodeURIComponent(n.problemsPerTest)}`);
    if (n.shuffleProblems === false) extra.push(`ordered=true`);
    if (extra.length === 0) return base;
    return base + "?" + extra.join("&");
  };

  const appendHrefOptions = (href?: string, problemsPerTest?: number | null, shuffleProblems?: boolean | null): string => {
    const base = href || "#";
    if (base === "#") return base;
    const extra: string[] = [];
    if (problemsPerTest != null) extra.push(`count=${encodeURIComponent(problemsPerTest)}`);
    if (shuffleProblems === false) extra.push("ordered=true");
    if (extra.length === 0) return base;
    return base + (base.includes("?") ? "&" : "?") + extra.join("&");
  };

  const keyToHref = (pinValue: string): string | null => {
    const key = pinValue.startsWith("href:") ? pinValue.slice(5) : pinValue;
    if (!key || key.startsWith("path:")) return null;
    if (key.startsWith("/")) return key;
    const parts = key.split(":");
    const collectionId = parts[0];
    if (!collectionId) return null;
    if (parts.length > 1) {
      const levels = parts.slice(1).join(":");
      return `/test/${encodeURIComponent(collectionId)}?levels=${encodeURIComponent(levels)}`;
    }
    return `/test/${encodeURIComponent(collectionId)}`;
  };

  const keyToLabel = (pinValue: string): string => {
    const key = pinValue.startsWith("href:") ? pinValue.slice(5) : pinValue;
    const collectionId = key.split(":")[0] || key;
    try {
      return decodeURIComponent(collectionId);
    } catch {
      return collectionId;
    }
  };

  const pathToPinKey = (path: string[]): string => `path:${path.map(encodeURIComponent).join("/")}`;

  const nodeHrefKey = (node: CategoryNode): string | null => {
    if (!node.href) return null;
    return hrefToCategoryKey(node.href);
  };

  const pinIdForNode = (node: CategoryNode, path: string[]): string => {
    const hrefKey = nodeHrefKey(node);
    return hrefKey ? `href:${hrefKey}` : pathToPinKey(path);
  };

  const isPinMatch = (pinValue: string, node: CategoryNode, path: string[]): boolean => {
    const hrefKey = nodeHrefKey(node);
    const pathKey = pathToPinKey(path);
    if (pinValue === pathKey) return true;
    if (hrefKey && (pinValue === hrefKey || pinValue === `href:${hrefKey}`)) return true;
    // Backward compatibility: old pins stored plain names.
    return pinValue === node.name;
  };

  const findPinnedNode = (
    pinValue: string,
    nodes: CategoryNode[],
    path: string[] = []
  ): { node: CategoryNode; path: string[]; pinId: string } | null => {
    for (const n of nodes) {
      const nextPath = [...path, n.name];
      if (isPinMatch(pinValue, n, nextPath)) {
        return { node: n, path: nextPath, pinId: pinIdForNode(n, nextPath) };
      }
      if (n.children?.length) {
        const found = findPinnedNode(pinValue, n.children, nextPath);
        if (found) return found;
      }
    }
    return null;
  };

  const toggleOpenKey = (key: string, depth: number = 0) => {
    setOpenKeys(prev => {
      if (depth === 0) {
        // accordion at top level: close everything, or collapse if already open
        if (prev.has(key)) return new Set();
        return new Set([key]);
      }
      // sub-folders: toggle independently
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isPinnedKeyOpen = (key: string): boolean => openPinnedKeyChain.includes(key);

  const toggleOpenPinnedKey = (key: string, chain: string[] = [key]) => {
    setOpenPinnedKeyChain(prev => {
      const currentIndex = prev.indexOf(key);
      if (currentIndex >= 0) return prev.slice(0, currentIndex);
      return chain;
    });
  };

  const toggleRecommendedFolder = (ownerId: string, folderId: string, categories: UserResult["categories"] | undefined) => {
    if (!categories) return;

    const getPathToFolder = (targetId: string): string[] => {
      const path: string[] = [];
      const visited = new Set<string>();
      let currentId: string | null = targetId;

      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        path.unshift(currentId);
        const current = categories.find((c) => c.id === currentId);
        currentId = current?.parentId ?? null;
      }

      return path;
    };

    setOpenRecommendedFolderChains((prev) => {
      const next = { ...prev };
      const currentChain = next[ownerId] ?? [];
      const path = getPathToFolder(folderId);
      if (path.length === 0) {
        next[ownerId] = [];
        return next;
      }
      if (currentChain.includes(folderId)) {
        next[ownerId] = path.slice(0, -1);
      } else {
        next[ownerId] = path;
      }
      return next;
    });
  };

  const isRecommendedFolder = (cat: RecommendedCategory | undefined): boolean => {
    if (!cat) return false;
    return cat.isFolder === true;
  };

  const getRecommendedChildrenOf = (categories: UserResult["categories"] | undefined, parentId: string | null | undefined) => {
    if (!categories) return [];
    return categories.filter(cat => (cat.parentId ?? null) === parentId);
  };

  const renderRecommendedFolder = (
    cat: RecommendedCategory | undefined,
    userCategories: UserResult["categories"] | undefined,
    depth: number,
    ownerId: string,
    ancestorExpanded: boolean = false
  ) => {
    if (!cat) return null;
    
    const isOpen = (openRecommendedFolderChains[ownerId] ?? []).includes(cat.id);
    const isHighlighted = ancestorExpanded || isOpen;
    const childCollections = getRecommendedChildrenOf(userCategories, cat.id).filter(c => !isRecommendedFolder(c));
    const childFolders = getRecommendedChildrenOf(userCategories, cat.id).filter(c => isRecommendedFolder(c));
    const margin = depth > 0 ? { marginLeft: `${depth * 14}px` } : undefined;
    const folderPinId = `rec-folder:${ownerId}:${cat.id}`;
    const folderPinned = loggedIn && pinnedNames.includes(folderPinId);

    return (
      <div key={`folder-${cat.id}`} className="contents">
        <button
          type="button"
          className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
          style={{ ...margin, color: isHighlighted ? "#b19739" : "#5fa870" }}
          onClick={() => toggleRecommendedFolder(ownerId, cat.id, userCategories)}
          onContextMenu={loggedIn ? e => openCtx(
            e,
            folderPinId,
            cat.name,
            folderPinned ? "pinned" : "grid",
            undefined,
            { kind: "folder", ownerId, folderId: cat.id }
          ) : undefined}
        >
          📁 {cat.name}
        </button>
        
        {isOpen && childCollections.map((childCat) => {
          const childHref = appendHrefOptions(`/test/${encodeURIComponent(childCat.id)}`, childCat.problemsPerTest, childCat.shuffleProblems);
          const pinId = childCat.href ? `href:${hrefToCategoryKey(childCat.href)}` : `rec:${ownerId}:${childCat.id}`;
          const isPinned = loggedIn && pinnedNames.includes(pinId);
          return (
            <a
              key={`rec-${childCat.id}`}
              href={childHref}
              className="book-link bookshelf-btn sub-item"
              style={{ color: "#b19739", marginLeft: `${(depth + 1) * 14}px` }}
              onContextMenu={loggedIn ? e => openCtx(e, pinId, childCat.name, isPinned ? "pinned" : "grid", childHref) : undefined}
            >
              {childCat.name}
            </a>
          );
        })}
        
        {isOpen && childFolders.map((childFolder) =>
          renderRecommendedFolder(childFolder, userCategories, depth + 1, ownerId, isHighlighted)
        )}
      </div>
    );
  };

  const renderRecommendedCategoryRoots = (categories: UserResult["categories"] | undefined) => {
    if (!categories) return [];
    return categories.filter(cat => (cat.parentId ?? null) === null);
  };

  const renderCategoryNode = (node: CategoryNode, key: string, depth: number, path: string[], ancestorExpanded: boolean = false) => {
    const isOpen = !!query || openKeys.has(key);
    const hasSub = !!node.children?.length;
    const hasDrop = !!node.dropdown?.length;
    const isDropOpen = openDropKey === key;
    const color = ancestorExpanded || (hasSub && isOpen) || (hasDrop && isDropOpen) ? FOLDER_COLOR : LEAF_COLOR;
    const btnStyle = { color };
    const pinId = pinIdForNode(node, path);
    const isPinned = loggedIn && pinnedNames.some(p => isPinMatch(p, node, path));
    const itemClass = itemClassForDepth(depth);

    return (
      <div key={key} className="contents">
        <div
          className={hasDrop ? "relative" : undefined}
          onContextMenu={loggedIn ? e => openCtx(e, pinId, node.name, isPinned ? "pinned" : "grid", node.href) : undefined}
        >
          {hasSub ? (
            <button
              type="button"
              className={`${itemClass} ${isOpen ? "active-category" : ""}`.trim()}
              style={btnStyle}
              onClick={() => toggleOpenKey(key, depth)}
            >
              <span className="mr-1">📁</span>{node.name}
            </button>
          ) : hasDrop ? (
            <button
              type="button"
              className={`${itemClass} flex items-center gap-1 ${isDropOpen ? "active-category" : ""}`.trim()}
              style={btnStyle}
              onClick={() => {
                setOpenDropKey(isDropOpen ? null : key);
                if (isDropOpen) setOpenYearKey(null);
              }}
            >
              <span className="mr-1">📁</span>{node.name}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: isDropOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="m6 9 6 6 6-6"/></svg>
            </button>
          ) : (
            <Link href={hrefWithOptions(node)} className={itemClass} style={btnStyle}>
              {node.name}
            </Link>
          )}
          {hasDrop && isDropOpen && (
            <div className={`year-dropdown absolute top-full z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto ${(node.dropdownAlign === "right" || node.name === "數學學測") ? "right-0" : "left-0"}`} style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
              {node.dropdown!.map(opt => (
                <Link
                  key={opt.href + opt.name}
                  href={opt.href}
                  className="block px-4 py-3 text-left"
                  style={{ color: FOLDER_COLOR, fontSize: "inherit" }}
                  onClick={() => { setOpenDropKey(null); setOpenYearKey(null); }}
                >
                  {opt.name}
                </Link>
              ))}
            </div>
          )}
        </div>

        {hasSub && isOpen && node.children!.map((child, idx) => renderCategoryNode(child, `${key}-${idx}`, depth + 1, [...path, child.name], true))}
      </div>
    );
  };

  const profileTabsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveProfileTabs = (tabs: PinnedProfileTab[]) => {
    if (loggedIn) {
      if (profileTabsDebounce.current) clearTimeout(profileTabsDebounce.current);
      profileTabsDebounce.current = setTimeout(() => {
        fetch("/api/user/pins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedProfileTabs: tabs }),
        }).catch(() => {});
      }, 500);
    } else {
      try { localStorage.setItem("pinnedProfileTabs", JSON.stringify(tabs)); } catch {}
    }
  };

  const unpinProfileTab = (name: string, tab: string) => {
    setPinnedProfileTabs(prev => {
      const next = prev.filter(p => !(p.name === name && p.tab === tab));
      saveProfileTabs(next);
      return next;
    });
  };

  const [dragTabIndex, setDragTabIndex] = useState<number | null>(null);
  const [dragOverTabIndex, setDragOverTabIndex] = useState<number | null>(null);

  const reorderProfileTab = (from: number, to: number) => {
    if (from === to) return;
    setPinnedProfileTabs(prev => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveProfileTabs(next);
      return next;
    });
  };

  useEffect(() => {
    try {
      const storedExternal = localStorage.getItem("externalPinnedRefs");
      if (storedExternal) setExternalPinnedRefs(JSON.parse(storedExternal));
    } catch {}
  }, []);

  useEffect(() => {
    if (!loggedIn) {
      try {
        const stored = localStorage.getItem("pinnedCats");
        if (stored) setPinnedNames(JSON.parse(stored));
        const storedInbox = localStorage.getItem("pinnedInboxCats");
        if (storedInbox) setPinnedInboxIds(JSON.parse(storedInbox));
        const storedCols = localStorage.getItem("pinnedCollectionIds");
        if (storedCols) setPinnedCollectionIds(JSON.parse(storedCols));
        const storedLists = localStorage.getItem("pinnedListIds");
        if (storedLists) setPinnedListIds(JSON.parse(storedLists));
        const storedTabs = localStorage.getItem("pinnedProfileTabs");
        if (storedTabs) setPinnedProfileTabs(JSON.parse(storedTabs));
      } catch {}
      return;
    }
    fetch("/api/user/pins")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.pinnedCats)) setPinnedNames(d.pinnedCats);
        if (Array.isArray(d.pinnedInboxCats)) setPinnedInboxIds(d.pinnedInboxCats);
        if (Array.isArray(d.pinnedCollectionIds)) setPinnedCollectionIds(d.pinnedCollectionIds);
        if (Array.isArray(d.pinnedListIds)) setPinnedListIds(d.pinnedListIds);
        if (Array.isArray(d.pinnedProfileTabs)) setPinnedProfileTabs(d.pinnedProfileTabs);
      })
      .catch(() => {});
    // Pre-load profile language so profile page uses the correct language immediately
    fetch("/api/user/profile")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const lang = d?.user?.profileLanguage as string | undefined;
        if (lang) localStorage.setItem("profileLanguage", lang);
      })
      .catch(() => {});
  }, [loggedIn]);

  // Load recommended accounts
  useEffect(() => {
    setRecommendedAccounts([]);
    setRecommendedLoaded(false);
    setOpenRecommendedFolderChains({});
    fetch(`/api/users/recommended?language=${encodeURIComponent(language)}&limit=6`)
      .then(r => {
        if (!r.ok) {
          console.error("API error:", r.status, r.statusText);
          return null;
        }
        return r.json();
      })
      .then(d => {
        if (d && Array.isArray(d.users)) {
          console.log("Recommended accounts loaded:", d.users.length);
          setRecommendedAccounts(d.users.map((u: any) => ({ 
            id: u.id, 
            name: u.name, 
            avatarUrl: u.avatarUrl,
            categories: u.categories || [],
            lists: u.lists || [],
          })));
        } else {
          console.log("No users in response", d);
        }
        setRecommendedLoaded(true);
      })
      .catch(err => {
        console.error("Recommended accounts error:", err);
        setRecommendedLoaded(true);
      });
  }, [language]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const apply = (matches: boolean) => {
      if (matches) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
    apply(mq.matches);
    mq.addEventListener("change", e => apply(e.matches));
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      mq.removeEventListener("change", e => apply(e.matches));
    };
  }, []);

  const savePins = (cats: string[], inboxCatIds: string[], colIds: string[], listIds: string[]) => {
    if (loggedIn) {
      if (pinsDebounce.current) clearTimeout(pinsDebounce.current);
      pinsDebounce.current = setTimeout(() => {
        fetch("/api/user/pins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedCats: cats, pinnedInboxCats: inboxCatIds, pinnedCollectionIds: colIds, pinnedListIds: listIds }),
        }).catch(() => {});
      }, 500);
    } else {
      localStorage.setItem("pinnedCats", JSON.stringify(cats));
      localStorage.setItem("pinnedInboxCats", JSON.stringify(inboxCatIds));
      localStorage.setItem("pinnedCollectionIds", JSON.stringify(colIds));
      localStorage.setItem("pinnedListIds", JSON.stringify(listIds));
    }
  };

  const pin = (name: string, meta?: { name?: string; href?: string; kind?: "folder"; ownerId?: string; folderId?: string }) => {
    if (meta?.href || meta?.kind === "folder") {
      const ref: ExternalPinnedRef = meta?.kind === "folder"
        ? {
            name: meta.name || name,
            kind: "folder",
            ownerId: meta.ownerId,
            folderId: meta.folderId,
          }
        : {
            name: meta?.name || name,
            href: meta?.href,
            kind: "link",
          };
      setExternalPinnedRefs(prev => {
        const next = { ...prev, [name]: ref };
        try { localStorage.setItem("externalPinnedRefs", JSON.stringify(next)); } catch {}
        return next;
      });
    }
    setPinnedNames(prev => {
      if (prev.includes(name)) return prev;
      const next = [...prev, name];
      savePins(next, pinnedInboxIds, pinnedCollectionIds, pinnedListIds);
      return next;
    });
  };

  const unpin = (name: string) => {
    setExternalPinnedRefs(prev => {
      if (!Object.prototype.hasOwnProperty.call(prev, name)) return prev;
      const { [name]: _, ...rest } = prev;
      try { localStorage.setItem("externalPinnedRefs", JSON.stringify(rest)); } catch {}
      return rest;
    });
    setPinnedNames(prev => {
      const next = prev.filter(n => n !== name);
      savePins(next, pinnedInboxIds, pinnedCollectionIds, pinnedListIds);
      return next;
    });
  };

  const pinInbox = (id: string) => {
    setPinnedInboxIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [id, ...prev];
      savePins(pinnedNames, next, pinnedCollectionIds, pinnedListIds);
      return next;
    });
  };

  const unpinInbox = (id: string) => {
    setPinnedInboxIds(prev => {
      const next = prev.filter(n => n !== id);
      savePins(pinnedNames, next, pinnedCollectionIds, pinnedListIds);
      return next;
    });
  };

  const unpinCollection = (id: string) => {
    setPinnedCollectionIds(prev => {
      const next = prev.filter(n => n !== id);
      savePins(pinnedNames, pinnedInboxIds, next, pinnedListIds);
      return next;
    });
  };

  const unpinList = (id: string) => {
    setPinnedListIds(prev => {
      const next = prev.filter(n => n !== id);
      savePins(pinnedNames, pinnedInboxIds, pinnedCollectionIds, next);
      return next;
    });
  };

  useEffect(() => {
    if (!ctxMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ctxMenu]);

  useEffect(() => {
    if (!loggedIn || homeListsLoaded) return;
    fetch("/api/lists")
      .then(r => r.json())
      .then(d => { setHomeLists(d.lists ?? []); setHomeListsLoaded(true); })
      .catch(() => {});
  }, [loggedIn, homeListsLoaded]);

  useEffect(() => {
    if (!loggedIn || inboxLoaded) return;
    fetch("/api/categories/shared")
      .then(r => r.json())
      .then(d => setInboxCats(d.sharedCategories ?? []))
      .catch(() => {})
      .finally(() => setInboxLoaded(true));
  }, [loggedIn, inboxLoaded]);

  useEffect(() => {
    if (!sharePanel || !loggedIn) return;
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => {
        const owned: Group[] = (d.owned ?? []).map((g: Record<string, unknown>) => ({ id: g.id as string, name: g.name as string }));
        const joined: Group[] = (d.joined ?? []).map((g: Record<string, unknown>) => ({ id: g.id as string, name: g.name as string }));
        setShareGroups([...owned, ...joined]);
      })
      .catch(() => {});
  }, [sharePanel, loggedIn]);

  useEffect(() => {
    if (shareDebounce.current) clearTimeout(shareDebounce.current);
    if (!shareInput.trim()) { setShareSearchResults([]); setShareSearchLoading(false); return; }
    setShareSearchLoading(true);
    shareDebounce.current = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(shareInput.trim())}`)
        .then(r => r.json())
        .then(d => setShareSearchResults((d.users ?? []).map((u: Record<string, unknown>) => ({ type: "user" as const, id: u.id as string, name: u.name as string, avatarUrl: u.avatarUrl as string | undefined }))))
        .catch(() => setShareSearchResults([]))
        .finally(() => setShareSearchLoading(false));
    }, 300);
    return () => { if (shareDebounce.current) clearTimeout(shareDebounce.current); };
  }, [shareInput]);

  useEffect(() => {
    if (!loggedIn) return;
    fetch("/api/my-collections")
      .then(r => r.json())
      .then(d => setMyCollections((d.collections ?? []).filter((c: { approvalStatus?: string }) => c.approvalStatus !== "pending")))
      .catch(() => {});
  }, [loggedIn]);

  useEffect(() => {
    const sync = () => {
      const lang = localStorage.getItem("siteLanguage") || "zh-TW";
      setLanguage(lang);
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("site-language-change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("site-language-change", sync);
    };
  }, []);

  useEffect(() => {
    setOpenKeys(new Set());
    setOpenDropKey(null);
    setOpenYearKey(null);
    setQuery("");
    setUserResults([]);
    setOwnerCatResults([]);

    setCategories([]);
    setLoadingLang(false);
  }, [language]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setUserResults([]); setOwnerCatResults([]); setSearchLoading(false); return; }
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

  const openCtx = (
    e: React.MouseEvent,
    id: string,
    name: string,
    from: CtxMenu["from"],
    href?: string,
    meta?: CtxMenu["meta"]
  ) => {
    e.preventDefault();
    setCtxMenu({ id, name, href, x: e.clientX, y: e.clientY, from, meta });
  };

  const hrefToCategoryKey = (href: string): string => {
    const m = href.match(/\/test\/([^?]+)(?:\?.*?levels=([^&]+))?/);
    if (!m) return href;
    return m[2] ? `${m[1]}:${m[2]}` : m[1];
  };

  const addCategoryRef = async (item: CtxMenu) => {
    if (!item.href) return;
    const key = hrefToCategoryKey(item.href);
    const collectionId = key.split(":")[0];
    if (myCollections.some((c) => c.collectionId === collectionId)) return;
    try {
      const res = await fetch("/api/my-collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId, displayName: item.name, language }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("加入個人分類失敗", res.status, d);
      } else {
        setMyCollections((prev) => [
          ...prev,
          {
            id: `tmp-${collectionId}`,
            collectionId,
            displayName: item.name,
            createdAt: new Date().toISOString(),
            approvalStatus: "pending",
          },
        ]);
      }
    } catch (err) {
      console.error("加入個人分類網路錯誤", err);
    }
  };

  const handleShareTo = async (target: { type: "user" | "group"; id: string; name: string }) => {
    if (!sharePanel) return;
    setSharingSending(target.id);
    const body = target.type === "user"
      ? { categoryKey: sharePanel.categoryKey, categoryName: sharePanel.categoryName, targetUserName: target.name }
      : { categoryKey: sharePanel.categoryKey, categoryName: sharePanel.categoryName, groupId: target.id };
    await fetch("/api/categories/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setShareSharedIds(prev => new Set(prev).add(target.id));
    setSharingSending(null);
  };

  const renderPinnedDescendants = (
    node: CategoryNode,
    path: string[],
    depth: number,
    ancestorExpanded: boolean = false,
    parentChain: string[] = []
  ) => {
    const pinId = pinIdForNode(node, path);
    const chain = [...parentChain, pinId];
    const childPinned = pinnedNames.some(p => isPinMatch(p, node, path));
    const itemClass = itemClassForDepth(depth);
    const hasSub = !!node.children?.length;
    const hasDrop = !!node.dropdown?.length;
    const isExpanded = isPinnedKeyOpen(pinId);
    const childColor = ancestorExpanded || isExpanded ? FOLDER_COLOR : LEAF_COLOR;
    const indentStyle = depth > 1 ? { marginLeft: `${(depth - 1) * 14}px` } : undefined;

    return (
      <div key={pinId} className="contents">
        <div onContextMenu={e => openCtx(e, pinId, node.name, childPinned ? "pinned" : "grid", node.href)}>
          {hasSub || hasDrop ? (
            <button
              type="button"
              className={`${itemClass} ${isExpanded ? "active-category" : ""}`.trim()}
              style={{ color: childColor, ...indentStyle }}
              onClick={() => toggleOpenPinnedKey(pinId, chain)}
            >
              <span className="mr-1">📁</span>{node.name}
            </button>
          ) : node.href ? (
            <Link href={hrefWithOptions(node)} className={itemClass} style={{ color: childColor, ...indentStyle }}>
              {node.name}
            </Link>
          ) : (
            <button type="button" className={itemClass} style={{ color: childColor, ...indentStyle }}>
              {node.name}
            </button>
          )}
          {hasDrop && isExpanded && node.dropdown?.map(opt => (
            <Link
              key={opt.href + opt.name}
              href={opt.href}
              className={itemClassForDepth(depth + 1)}
              style={{ color: FOLDER_COLOR, marginLeft: `${depth * 14}px` }}
              onClick={() => toggleOpenPinnedKey(pinId, chain)}
            >
              {opt.name}
            </Link>
          ))}
        </div>
          {hasSub && isExpanded && node.children?.map(child => renderPinnedDescendants(child, [...path, child.name], depth + 1, true, chain))}
      </div>
    );
  };

  const renderPinnedRecommendedDescendants = (
    ownerId: string,
    categories: UserResult["categories"] | undefined,
    parentId: string,
    depth: number,
    ancestorExpanded: boolean = false,
    parentChain: string[] = []
  ): (React.ReactElement | null)[] => {
    if (!categories) return [];
    const children = getRecommendedChildrenOf(categories, parentId);
    if (children.length === 0) return [];

    const results: (React.ReactElement | null)[] = [];

    children.forEach((child) => {
      const isFolder = isRecommendedFolder(child);
      const itemClass = itemClassForDepth(depth);
      const indentStyle = depth > 1 ? { marginLeft: `${(depth - 1) * 14}px` } : undefined;

      if (isFolder) {
        const folderPinId = `rec-folder:${ownerId}:${child.id}`;
        const chain = [...parentChain, folderPinId];
        const folderPinned = loggedIn && pinnedNames.includes(folderPinId);
        const isExpanded = isPinnedKeyOpen(folderPinId);
        const color = ancestorExpanded || isExpanded ? FOLDER_COLOR : LEAF_COLOR;

        results.push(
          <button
            key={folderPinId}
            type="button"
            className={`${itemClass} ${isExpanded ? "active-category" : ""}`.trim()}
            style={{ color, ...indentStyle }}
            onClick={() => toggleOpenPinnedKey(folderPinId, chain)}
            onContextMenu={loggedIn ? e => openCtx(
              e,
              folderPinId,
              child.name,
              folderPinned ? "pinned" : "grid",
              undefined,
              { kind: "folder", ownerId, folderId: child.id }
            ) : undefined}
          >
            <span className="mr-1">📁</span>{child.name}
          </button>
        );

        if (isExpanded) {
          const nestedResults = renderPinnedRecommendedDescendants(ownerId, categories, child.id, depth + 1, true, chain);
          results.push(...nestedResults);
        }
      } else {
        const leafHref = appendHrefOptions(child.href, child.problemsPerTest, child.shuffleProblems);
        const leafPinId = child.href ? `href:${hrefToCategoryKey(child.href)}` : `rec:${ownerId}:${child.id}`;
        const leafPinned = loggedIn && pinnedNames.includes(leafPinId);

        results.push(
          <a
            key={leafPinId}
            href={leafHref}
            className={itemClass}
            style={{ color: FOLDER_COLOR, ...indentStyle }}
            onContextMenu={loggedIn ? e => openCtx(e, leafPinId, child.name, leafPinned ? "pinned" : "grid", leafHref) : undefined}
          >
            {child.name}
          </a>
        );
      }
    });

    return results;
  };

  return (
    <div className="flex min-h-screen items-start justify-start bg-transparent font-sans dark:bg-black">
      {/* profile-tab pin context menu */}
      {profileTabCtxMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setProfileTabCtxMenu(null)} />
          <div
            className="fixed z-50 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: profileTabCtxMenu.x, top: profileTabCtxMenu.y, minWidth: "5rem" }}
          >
            <button
              type="button"
              onMouseDown={e => e.stopPropagation()}
              onClick={() => { unpinProfileTab(profileTabCtxMenu.name, profileTabCtxMenu.tab); setProfileTabCtxMenu(null); }}
              className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}
            >
              從首頁移除
            </button>
          </div>
        </>
      )}
      {/* context menu */}
      {ctxMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setCtxMenu(null)} />
          <div
            className="fixed z-50 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y, minWidth: "5rem" }}
          >
            {ctxMenu.from === "list-pinned" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { unpinList(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                取消釘選
              </button>
            ) : ctxMenu.from === "grid" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { pin(ctxMenu.id, { name: ctxMenu.name, href: ctxMenu.href, kind: ctxMenu.meta?.kind, ownerId: ctxMenu.meta?.ownerId, folderId: ctxMenu.meta?.folderId }); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                釘選
              </button>
            ) : ctxMenu.from === "pinned" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { unpin(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                取消釘選
              </button>
            ) : ctxMenu.from === "inbox" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { pinInbox(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                釘選
              </button>
            ) : ctxMenu.from === "my-collection-pinned" ? (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { unpinCollection(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                取消釘選
              </button>
            ) : (
              <button
                type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { unpinInbox(ctxMenu.id); setCtxMenu(null); }}
                className="w-full text-left px-4 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                取消釘選
              </button>
            )}
          </div>
        </>
      )}

      {/* share panel */}
      {sharePanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSharePanel(null)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 max-h-[70vh] flex flex-col rounded-2xl border shadow-xl"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>分享「{sharePanel.categoryName}」</span>
              <button onClick={() => setSharePanel(null)} className="text-lg opacity-40 hover:opacity-70 leading-none" style={{ color: "var(--zen-ink)" }}>×</button>
            </div>
            <div className="flex flex-col gap-3 px-5 py-4 overflow-y-auto">
              {/* user search */}
              <input
                className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                placeholder="搜尋帳號名稱"
                value={shareInput}
                onChange={e => setShareInput(e.target.value)}
              />
              {shareSearchLoading && <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>}
              {shareSearchResults.length > 0 && (
                <div className="flex flex-col divide-y rounded-xl overflow-hidden border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)" }}>
                  {shareSearchResults.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--zen-bg)" }}>
                      <div className="flex items-center gap-2">
                        <Image src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                        <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                      </div>
                      {shareSharedIds.has(u.id) ? (
                        <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                      ) : (
                        <button
                          onClick={() => handleShareTo(u)}
                          disabled={shareSending === u.id}
                          className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                          style={{ borderColor: "#b19739", color: "#b19739" }}
                        >
                          {shareSending === u.id ? "..." : "分享"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {/* groups */}
              {shareGroups.length > 0 && (
                <>
                  <p className="text-xs opacity-50 mt-1" style={{ color: "var(--zen-ink)" }}>我的群組</p>
                  <div className="flex flex-col divide-y rounded-xl overflow-hidden border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)" }}>
                    {shareGroups.map(g => (
                      <div key={g.id} className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: "var(--zen-bg)" }}>
                        <span className="text-sm" style={{ color: "var(--zen-ink)" }}>{g.name}</span>
                        {shareSharedIds.has(g.id) ? (
                          <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                        ) : (
                          <button
                            onClick={() => handleShareTo({ type: "group", id: g.id, name: g.name })}
                            disabled={shareSending === g.id}
                            className="text-xs px-3 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: "#5fa870", color: "#5fa870" }}
                          >
                            {shareSending === g.id ? "..." : "分享"}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* top-left brand */}
      <div className="fixed top-8 left-6 sm:left-16 flex items-center gap-12 z-30">
        <div className="relative flex flex-col items-center leading-none">
          <h1 className="text-[2.5rem] font-bold zen-title leading-none" style={{ color: "#b19739" }}>Test</h1>
          <span className="text-sm zen-subtle mt-3 whitespace-nowrap" style={{ color: "#5fa870" }}>testtttt.io</span>
          <div className="absolute -top-1 -right-5">
            <LanguageSelector />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="home-search w-[12.5rem] sm:w-[18.75rem] p-2 rounded-full border text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--zen-bg)", color: "#b19739", borderColor: "#b19739" }}
            placeholder={language === "en" ? "Search subjects or users" : "搜尋分類或帳號"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenKeys(new Set()); }}
          />
        </div>
      </div>

      <main className="flex w-full flex-col pt-36 px-4 sm:pl-16 sm:pr-16 min-h-screen sm:pb-10 max-sm:h-dvh max-sm:overflow-hidden">
        <div className="flex flex-row items-start gap-6 w-full flex-1 max-sm:overflow-hidden max-sm:items-stretch max-sm:min-h-0">
          {/* Left panel — categories */}
          <div className="w-full sm:w-[42%] shrink-0 max-sm:flex max-sm:flex-col max-sm:h-full max-sm:overflow-hidden">

            {/* Pinned bar */}
            <div
              className="relative min-h-[5.5rem] px-2 py-2 border-b transition-colors max-sm:shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
            >
              {loggedIn && pinnedNames.length === 0 && pinnedInboxIds.length === 0 && pinnedCollectionIds.length === 0 && pinnedListIds.length === 0 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 select-none" style={{ color: "var(--zen-ink)" }}>
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              )}
              {loggedIn && (pinnedNames.length > 0 || pinnedInboxIds.length > 0 || pinnedCollectionIds.length > 0 || pinnedListIds.length > 0) && (
                <div className="bookshelf-grid home-bookshelf-grid">
                  {pinnedListIds.map((id, idx) => {
                    const list = homeLists.find(l => l.id === id);
                    if (!list) return null;
                    return (
                      <a
                        key={id}
                        href={`/test/list?listId=${list.id}&autostart=1`}
                        className="book-link bookshelf-btn"
                        style={{ color: idx % 2 === 0 ? "#6ea8d8" : "#d87fa0" }}
                        onContextMenu={e => { e.preventDefault(); setCtxMenu({ id: list.id, name: list.title, x: e.clientX, y: e.clientY, from: "list-pinned" }); }}
                      >
                        {list.title}
                      </a>
                    );
                  })}
                  {pinnedCollectionIds.map((id, idx) => {
                    const col = myCollections.find(c => c.id === id);
                    if (!col) return null;
                    return (
                      <a
                        key={id}
                        href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
                        className="book-link bookshelf-btn"
                        style={{ color: LEAF_COLOR }}
                        onContextMenu={e => { e.preventDefault(); setCtxMenu({ id: col.id, name: col.displayName, x: e.clientX, y: e.clientY, from: "my-collection-pinned" }); }}
                      >
                        {col.displayName}
                      </a>
                    );
                  })}
                  {pinnedInboxIds.map((id, idx) => {
                    const cat = inboxCats.find(c => c.id === id);
                    if (!cat) return null;
                    const key = cat.categoryKey;
                    const isList = key.startsWith("list:");
                    const href = isList
                      ? `/test/list?listId=${key.slice(5)}&autostart=1`
                      : key.includes(":")
                        ? `/test/${encodeURIComponent(key.split(":")[0])}?levels=${encodeURIComponent(key.split(":")[1])}&autostart=1`
                        : `/test/${encodeURIComponent(key)}?autostart=1`;
                    const color = isList
                      ? (idx % 2 === 0 ? "#6ea8d8" : "#d87070")
                      : LEAF_COLOR;
                    return (
                      <a
                        key={id}
                        href={href}
                        className="book-link bookshelf-btn"
                        style={{ color }}
                        onContextMenu={e => { e.preventDefault(); openCtx(e, id, cat.categoryName, "inbox-pinned"); }}
                      >
                        {cat.categoryName}{cat.sharedByName ? ` [${cat.sharedByName}]` : ""}
                      </a>
                    );
                  })}
                  {pinnedNames.map((pinValue) => {
                    const found = findPinnedNode(pinValue, subjects);
                    if (!found) {
                      const external = externalPinnedRefs[pinValue];
                      if (external?.kind === "folder") {
                        const ownerCategories = external.ownerId
                          ? recommendedAccounts.find((u) => u.id === external.ownerId)?.categories
                          : undefined;
                        const chain = [pinValue];
                        const isExpanded = isPinnedKeyOpen(pinValue);
                        return (
                          <React.Fragment key={`ext-folder-${pinValue}`}>
                            <button
                              type="button"
                              className={`book-link bookshelf-btn ${isExpanded ? "active-category" : ""}`.trim()}
                              style={{ color: isExpanded ? FOLDER_COLOR : LEAF_COLOR }}
                              onClick={() => toggleOpenPinnedKey(pinValue, chain)}
                              onContextMenu={e => openCtx(e, pinValue, external.name, "pinned")}
                            >
                              <span className="mr-1">📁</span>{external.name}
                            </button>
                            {isExpanded && external.ownerId && external.folderId && renderPinnedRecommendedDescendants(
                              external.ownerId,
                              ownerCategories,
                              external.folderId,
                              1,
                              true,
                              chain
                            )}
                          </React.Fragment>
                        );
                      }
                      const fallbackHref = external?.href ?? keyToHref(pinValue);
                      if (!fallbackHref) return null;
                      return (
                        <a
                          key={`ext-${pinValue}`}
                          href={fallbackHref}
                          className="book-link bookshelf-btn"
                          style={{ color: LEAF_COLOR }}
                          onContextMenu={e => openCtx(e, pinValue, external?.name ?? keyToLabel(pinValue), "pinned", fallbackHref)}
                        >
                          {external?.name ?? keyToLabel(pinValue)}
                        </a>
                      );
                    }
                    const { node: subject, path, pinId } = found;
                    const chain = [pinId];
                    const isExpanded = isPinnedKeyOpen(pinId);
                    const color = isExpanded ? FOLDER_COLOR : LEAF_COLOR;
                    return (
                      <div key={pinId} className="contents">
                        <div
                          className="relative"
                          onContextMenu={e => openCtx(e, pinId, subject.name, "pinned", subject.href)}
                        >
                          {subject.children?.length ? (
                            <button
                              type="button"
                              className={`book-link bookshelf-btn ${isExpanded ? "active-category" : ""}`}
                              style={{ color }}
                              onClick={() => toggleOpenPinnedKey(pinId, chain)}
                            >
                              <span className="mr-1">📁</span>{subject.name}
                            </button>
                          ) : subject.dropdown?.length ? (
                            <button
                              type="button"
                              className={`book-link bookshelf-btn flex items-center gap-1 ${isExpanded ? "active-category" : ""}`}
                              style={{ color }}
                              onClick={() => toggleOpenPinnedKey(pinId, chain)}
                            >
                              <span className="mr-1">📁</span>{subject.name}
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="m6 9 6 6 6-6"/></svg>
                            </button>
                          ) : (
                            <Link href={hrefWithOptions(subject)} className="book-link bookshelf-btn" style={{ color }}>
                              {subject.name}
                            </Link>
                          )}
                          {subject.dropdown?.length && isExpanded && (
                            <div className={`year-dropdown absolute top-full z-50 mt-1 rounded-lg border bg-zen-paper dark:bg-zinc-900 shadow-lg overflow-y-auto ${subject.dropdownAlign === "right" ? "right-0" : "left-0"}`} style={{ maxHeight: "16rem", minWidth: "5rem", borderColor: color, ["--dropdown-color" as any]: color }}>
                              {subject.dropdown.map(opt => (
                                <Link
                                  key={opt.href + opt.name}
                                  href={opt.href}
                                  className="block px-4 py-3 text-left"
                                  style={{ color: FOLDER_COLOR, fontSize: "inherit" }}
                                  onClick={() => toggleOpenPinnedKey(pinId, chain)}
                                >
                                  {opt.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                        {isExpanded && subject.children?.map(child => renderPinnedDescendants(child, [...path, child.name], 1, true, chain))}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* collapse toggle */}
              <button
                type="button"
                className="absolute bottom-2 right-2 opacity-40 hover:opacity-80 transition-opacity"
                onClick={() => setCatOpen(o => !o)}
                aria-label={catOpen ? "收合" : "展開"}
                title={catOpen ? "收合" : "展開"}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: catOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </button>
            </div>

            {catOpen && (
              <>
            {/* Grid container — scrollable, always present */}
            <div className="max-sm:flex-1 max-sm:min-h-0 max-sm:overflow-y-auto">
              <div className="mt-2 overflow-visible max-sm:pb-24">
                {loadingLang ? (
                  <p className="text-sm zen-subtle opacity-50 py-4">載入中...</p>
                ) : (
                  subjects.length > 0 && (
                    <div className="bookshelf-grid home-bookshelf-grid">
                      {subjects.map((subject, i) => renderCategoryNode(subject, `${language}-${i}-${subject.href || subject.name}`, 0, [subject.name]))}
                    </div>
                  )
                )}

                {query && searchLoading && (
                  <p className="text-sm zen-subtle mt-6 opacity-50">搜尋中...</p>
                )}

                {!loadingLang && !searchLoading && subjects.length === 0 && userResults.length === 0 && ownerCatResults.length === 0 && query && (
                  <p className="text-sm zen-subtle mt-6 opacity-50">
                    {language === "en" ? "No matching results" : "沒有符合的結果"}
                  </p>
                )}

                {ownerCatResults.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-zinc-400 mb-3">
                      {language === "en" ? "Creator Categories" : "創作者分類"}
                    </p>
                    <ul className="flex flex-col gap-6">
                      {Array.from(
                        ownerCatResults.reduce((map, cat) => {
                          if (!map.has(cat.ownerId)) map.set(cat.ownerId, { ownerName: cat.ownerName, ownerAvatarUrl: cat.ownerAvatarUrl, cats: [] });
                          map.get(cat.ownerId)!.cats.push(cat);
                          return map;
                        }, new Map<string, { ownerName: string | null; ownerAvatarUrl: string | null; cats: typeof ownerCatResults }>())
                      ).map(([ownerId, { ownerName, ownerAvatarUrl, cats }]) => {
                        // Build RecommendedCategory-compatible list for reuse of folder rendering
                        const recCats = cats.map(c => ({ id: c.id, name: c.name, href: c.href ?? undefined, isFolder: c.isFolder ?? false, parentId: c.parentId, problemsPerTest: c.problemsPerTest, shuffleProblems: c.shuffleProblems }));
                        const roots = recCats.filter(c => (c.parentId ?? null) === null);
                        return (
                          <li key={ownerId}>
                            <Link
                              href={`/${encodeURIComponent(ownerName ?? ownerId)}`}
                              className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
                            >
                              <Image
                                src={ownerAvatarUrl || AVATAR_PLACEHOLDER}
                                alt={ownerName ?? ownerId}
                                width={40}
                                height={40}
                                unoptimized
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                              <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{ownerName ?? ownerId}</span>
                            </Link>
                            <div className="bookshelf-grid">
                              {roots.map(cat => {
                                if (isRecommendedFolder(cat)) {
                                  return renderRecommendedFolder(cat, recCats, 0, ownerId);
                                }
                                const recommendedHref = appendHrefOptions(`/test/${encodeURIComponent(cat.id)}`, cat.problemsPerTest, cat.shuffleProblems);
                                const pinId = cat.href ? `href:${hrefToCategoryKey(cat.href)}` : `rec:${ownerId}:${cat.id}`;
                                const isPinned = loggedIn && pinnedNames.includes(pinId);
                                return (
                                  <a
                                    key={cat.id}
                                    href={recommendedHref}
                                    className="book-link bookshelf-btn"
                                    style={{ color: LEAF_COLOR }}
                                    onContextMenu={loggedIn ? e => openCtx(e, pinId, cat.name, isPinned ? "pinned" : "grid", recommendedHref) : undefined}
                                  >
                                    {cat.name}
                                  </a>
                                );
                              })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {userResults.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-zinc-400 mb-3">
                      {language === "en" ? "Users" : "帳號"}
                    </p>
                    <div className="bookshelf-grid home-bookshelf-grid">
                      {userResults.map(u => (
                        <Link
                          key={u.id}
                          href={`/${encodeURIComponent(u.name)}`}
                          className="book-link bookshelf-btn flex flex-col items-center gap-1.5"
                          style={{ color: "var(--zen-ink)" }}
                        >
                          <Image
                            src={u.avatarUrl || AVATAR_PLACEHOLDER}
                            alt={u.name}
                            width={32}
                            height={32}
                            unoptimized
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <span className="text-sm font-medium text-center leading-tight">{u.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {!query && recommendedLoaded && (
                  <div className="mt-6">
                    <p className="text-xs text-zinc-400 mb-3">
                      {language === "en" ? "Recommended Creators" : "推薦創作者"}
                    </p>
                    {recommendedAccounts.length > 0 ? (
                        <ul className="flex flex-col gap-6">
                        {recommendedAccounts.map(u => (
                            <li key={u.id}>
                            <Link
                              href={`/${encodeURIComponent(u.name)}`}
                              className="flex items-center gap-3 mb-3 hover:opacity-80 transition-opacity"
                            >
                              <Image
                                src={u.avatarUrl || AVATAR_PLACEHOLDER}
                                alt={u.name}
                                width={40}
                                height={40}
                                unoptimized
                                className="w-10 h-10 rounded-full object-cover shrink-0"
                              />
                              <span className="text-sm font-medium" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                            </Link>
                            {((u.categories && u.categories.length > 0) || (u.lists && u.lists.length > 0)) && (
                                <div className="bookshelf-grid">
                                  {(u.categories ?? []).length > 0 && renderRecommendedCategoryRoots(u.categories).map((cat) => {
                                    if (isRecommendedFolder(cat)) {
                                      return renderRecommendedFolder(cat, u.categories, 0, u.id);
                                    }
                                    const recommendedHref = appendHrefOptions(`/test/${encodeURIComponent(cat.id)}`, cat.problemsPerTest, cat.shuffleProblems);
                                    const pinId = cat.href ? `href:${hrefToCategoryKey(cat.href)}` : `rec:${u.id}:${cat.id}`;
                                    const isPinned = loggedIn && pinnedNames.includes(pinId);
                                    return (
                                      <a
                                        key={cat.id}
                                        href={recommendedHref}
                                        className="book-link bookshelf-btn"
                                        style={{ color: "#5fa870" }}
                                        onContextMenu={loggedIn ? e => openCtx(e, pinId, cat.name, isPinned ? "pinned" : "grid", recommendedHref) : undefined}
                                      >
                                        {cat.name}
                                      </a>
                                    );
                                  })}
                                  {(u.lists ?? []).map((list) => (
                                    <a
                                      key={`list-${list.id}`}
                                      href={`/lists/${encodeURIComponent(list.id)}`}
                                      className="book-link bookshelf-btn"
                                      style={{ color: "#6ea8d8" }}
                                    >
                                      {list.title}
                                    </a>
                                  ))}
                                </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm zen-subtle opacity-50">
                        {language === "en" ? "No creators found" : "暫無創作者"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* pinned profile tabs — mobile only */}
            {loggedIn && visiblePinnedProfileTabs.length > 0 && (
              <div className="sm:hidden">
                {visiblePinnedProfileTabs.map((p, idx) => (
                  <div
                    key={`mobile-${p.name}-${p.tab}`}
                    draggable
                    onDragStart={e => { setDragTabIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverTabIndex !== idx) setDragOverTabIndex(idx); }}
                    onDragLeave={() => { if (dragOverTabIndex === idx) setDragOverTabIndex(null); }}
                    onDrop={e => { e.preventDefault(); if (dragTabIndex !== null) reorderProfileTab(dragTabIndex, idx); setDragTabIndex(null); setDragOverTabIndex(null); }}
                    onDragEnd={() => { setDragTabIndex(null); setDragOverTabIndex(null); }}
                    className={`transition-opacity ${dragTabIndex === idx ? "opacity-40" : ""} ${dragOverTabIndex === idx && dragTabIndex !== idx ? "border-t-2 border-dashed" : ""}`}
                    style={{ borderColor: dragOverTabIndex === idx && dragTabIndex !== idx ? "#5fa870" : "transparent" }}
                  >
                    <PinnedProfileTabSection
                      name={p.name}
                      tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked" | "shared"}
                      label={p.label}
                      onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                    />
                  </div>
                ))}
              </div>
            )}
              </>
            )}
          </div>

          {/* Right panel — pinned profile tabs (desktop) */}
          {loggedIn && visiblePinnedProfileTabs.length > 0 && (
            <div className="hidden sm:block flex-1 pt-2 px-2">
              {visiblePinnedProfileTabs.map((p, idx) => (
                <div
                  key={`desktop-${p.name}-${p.tab}`}
                  draggable
                  onDragStart={e => { setDragTabIndex(idx); e.dataTransfer.effectAllowed = "move"; }}
                  onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverTabIndex !== idx) setDragOverTabIndex(idx); }}
                  onDragLeave={() => { if (dragOverTabIndex === idx) setDragOverTabIndex(null); }}
                  onDrop={e => { e.preventDefault(); if (dragTabIndex !== null) reorderProfileTab(dragTabIndex, idx); setDragTabIndex(null); setDragOverTabIndex(null); }}
                  onDragEnd={() => { setDragTabIndex(null); setDragOverTabIndex(null); }}
                  className={`transition-opacity ${dragTabIndex === idx ? "opacity-40" : ""} ${dragOverTabIndex === idx && dragTabIndex !== idx ? "border-t-2 border-dashed" : ""}`}
                  style={{ borderColor: dragOverTabIndex === idx && dragTabIndex !== idx ? "#5fa870" : "transparent" }}
                >
                  <PinnedProfileTabSection
                    name={p.name}
                    tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked" | "shared"}
                    label={p.label}
                    onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Footer language={language} />
      </main>

      <Link
        href="/feedback"
        aria-label="意見回饋"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center justify-center w-11 h-11 rounded-full transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m2 7 10 7 10-7"/>
        </svg>
      </Link>
    </div>
  );
}
