"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEdgeSwipeNav } from "../lib/useEdgeSwipeNav";
import { useFilteredCategories } from "./useFilteredCategories";
import { Footer } from "./Footer";
import LanguageSelector from "./LanguageSelector";
import type { CategoryNode } from "./CategoryNode";
import type { MyCollection } from "./PersonalListsView";
import { PinnedProfileTabSection } from "./PinnedProfileTabSection";
import type { QuestionList } from "../../lib/lists-supabase";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

type PinDragFrom = "grid" | "pinned" | "list-pinned" | "my-collection-pinned" | "profile-tab-pinned";
type PinDragData = { pinId: string; name: string; href?: string; from: PinDragFrom };

function PinDraggable({
  pinId,
  name,
  href,
  from,
  children,
}: PinDragData & { children: React.ReactNode }) {
  const id = `${from}:${pinId}`;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { pinId, name, href, from } satisfies PinDragData,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        opacity: isDragging ? 0.4 : 1,
        touchAction: "none",
        cursor: "grab",
      }}
    >
      {children}
    </div>
  );
}

function PinnedBarDroppable({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const { setNodeRef, isOver } = useDroppable({ id: "pinned-bar" });
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        ...style,
        outline: isOver ? "2px dashed var(--zen-accent)" : style?.outline,
        outlineOffset: 4,
      }}
    >
      {children}
    </div>
  );
}

type PopularQset = {
  kind: "qset";
  id: string;
  name: string;
  ownerId: string;
  problemsPerTest: number | null;
  shuffleProblems: boolean | null;
  visitCount: number;
};
type PopularList = {
  kind: "list";
  id: string;
  title: string;
  ownerId: string;
  visitCount: number;
};
type PopularFolder = {
  kind: "folder";
  id: string;
  name: string;
  ownerId: string;
  visitCount: number;
  children: PopularItem[];
};
type PopularItem = PopularQset | PopularList | PopularFolder;
type ExternalPinnedRef = {
  name: string;
  href?: string;
};
export function HomeContent() {
    // Unified pinned folder rendering (same as recommended creator area)
    function renderPinnedFolder(
      node: CategoryNode,
      pinId: string,
      path: string[],
      depth: number,
      chain: string[]
    ): React.ReactNode {
      const isExpanded = isPinnedKeyOpen(pinId);
      return (
        <div key={pinId} className="contents">
          <PinDraggable pinId={pinId} name={node.name} href={node.href} from="pinned">
            <button
              type="button"
              className={`book-link bookshelf-btn ${isExpanded ? "active-category" : ""}`.trim()}
              style={{ color: FOLDER_COLOR }}
              title="資料夾"
              draggable={false}
              onClick={() => toggleOpenPinnedKey(pinId, chain)}
            >
              📁 {node.name}
            </button>
          </PinDraggable>
          {isExpanded && node.children?.map(child => {
            const childPath = [...path, child.name];
            const childPinId = pinIdForNode(child, childPath);
            if (child.children?.length) {
              return renderPinnedFolder(child, childPinId, childPath, depth + 1, [...chain, childPinId]);
            }
            return (
              <PinDraggable key={childPinId} pinId={childPinId} name={child.name} href={child.href} from="pinned">
                <Link
                  href={hrefWithOptions(child)}
                  className="book-link bookshelf-btn"
                  style={{ color: "var(--zen-ink)" }}
                  draggable={false}
                >
                  {child.name}
                </Link>
              </PinDraggable>
            );
          })}
        </div>
      );
    }
  
    // Other existing code...
  const [language, setLanguage] = useState("zh-TW");
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loadingLang, setLoadingLang] = useState(false);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(true);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [externalPinnedRefs, setExternalPinnedRefs] = useState<Record<string, ExternalPinnedRef>>({});
  const [openPinnedKeyChain, setOpenPinnedKeyChain] = useState<string[]>([]);
  const [pinnedCollectionIds, setPinnedCollectionIds] = useState<string[]>([]);
  const [pinnedListIds, setPinnedListIds] = useState<string[]>([]);
  type PinnedProfileTab = { name: string; tab: string; label: string };
  const [pinnedProfileTabs, setPinnedProfileTabs] = useState<PinnedProfileTab[]>([]);
  const [profileTabCtxMenu, setProfileTabCtxMenu] = useState<{ name: string; tab: string; label: string; x: number; y: number } | null>(null);
  const [homeLists, setHomeLists] = useState<QuestionList[]>([]);
  const [homeListsLoaded, setHomeListsLoaded] = useState(false);
  const [myCollections, setMyCollections] = useState<MyCollection[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [popularLoaded, setPopularLoaded] = useState(false);
  const [popularCollapsed, setPopularCollapsed] = useState(true);
  const [popularOffset, setPopularOffset] = useState(0);
  const [popularHasMore, setPopularHasMore] = useState(false);
  const [loadingMorePopular, setLoadingMorePopular] = useState(false);
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [pinnedRecOpenChain, setPinnedRecOpenChain] = useState<string[]>([]);
  const popularSentinelRef = useRef<HTMLDivElement | null>(null);
  const POPULAR_PAGE_SIZE = 20;
  const pinsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const router = useRouter();
  useEdgeSwipeNav({
    direction: "right",
    onSwipe: () => {
      const userName = (session?.user as { name?: string } | undefined)?.name;
      router.push(userName ? `/${encodeURIComponent(userName)}` : "/auth/login");
    },
  });
  const visiblePinnedProfileTabs = pinnedProfileTabs;
  const [activeDrag, setActiveDrag] = useState<PinDragData | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const subjects = useFilteredCategories(categories, "");

  const FOLDER_COLOR = "#b19739"; // gold — nodes with children or dropdown
  const LEAF_COLOR = "#D1D5DB";   // off-white — leaf items (link directly to a test)
  const colorOf = (n: CategoryNode): string =>
    (n.children?.length || n.dropdown?.length) ? FOLDER_COLOR : LEAF_COLOR;

  const handleDndStart = (e: DragStartEvent) => {
    const data = e.active.data.current as PinDragData | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDndEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const data = e.active.data.current as PinDragData | undefined;
    if (!data) return;
    const overId = e.over?.id != null ? String(e.over.id) : null;
    if (data.from === "grid") {
      if (overId === "pinned-bar") {
        pin(data.pinId, { name: data.name, href: data.href });
      }
      return;
    }
    // pinned variants: dropping outside pinned-bar = unpin
    if (overId === "pinned-bar") return;
    if (data.from === "pinned") unpin(data.pinId);
    else if (data.from === "list-pinned") unpinList(data.pinId);
    else if (data.from === "my-collection-pinned") unpinCollection(data.pinId);
    else if (data.from === "profile-tab-pinned") {
      const parts = data.pinId.split("\t");
      if (parts.length === 2) unpinProfileTab(parts[0], parts[1]);
    }
  };

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

  const renderCategoryNode = (node: CategoryNode, key: string, depth: number, path: string[], ancestorExpanded: boolean = false) => {
    const isOpen = openKeys.has(key);
    const hasSub = !!node.children?.length;
    const hasDrop = !!node.dropdown?.length;
    const isDropOpen = openDropKey === key;
    const color = LEAF_COLOR;
    const btnStyle = { color };
    const pinId = pinIdForNode(node, path);
    const isPinned = loggedIn && pinnedNames.some(p => isPinMatch(p, node, path));
    const itemClass = itemClassForDepth(depth);

    return (
      <div key={key} className="contents">
        <div
          className={hasDrop ? "relative" : undefined}
        >
          {hasSub ? (
            <PinDraggable pinId={pinId} name={node.name} href={node.href} from="grid">
              <button
                type="button"
                className={`${itemClass} ${isOpen ? "active-category" : ""}`.trim()}
                style={btnStyle}
                onClick={() => toggleOpenKey(key, depth)}
                draggable={false}
              >
                <span className="mr-1">📁</span>{node.name}
              </button>
            </PinDraggable>
          ) : hasDrop ? (
            <PinDraggable pinId={pinId} name={node.name} href={node.href} from="grid">
              <button
                type="button"
                className={`${itemClass} flex items-center gap-1 ${isDropOpen ? "active-category" : ""}`.trim()}
                style={btnStyle}
                onClick={() => {
                  setOpenDropKey(isDropOpen ? null : key);
                  if (isDropOpen) setOpenYearKey(null);
                }}
                draggable={false}
              >
                <span className="mr-1">📁</span>{node.name}
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: isDropOpen ? "rotate(180deg)" : "rotate(0deg)" }}><path d="m6 9 6 6 6-6"/></svg>
              </button>
            </PinDraggable>
          ) : (
            <PinDraggable pinId={pinId} name={node.name} href={node.href} from="grid">
              <Link href={hrefWithOptions(node)} className={itemClass} style={btnStyle} draggable={false}>
                {node.name}
              </Link>
            </PinDraggable>
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

  // Load popular tests (first page)
  useEffect(() => {
    setPopularItems([]);
    setPopularOffset(0);
    setPopularHasMore(false);
    setPopularLoaded(false);
    setOpenFolderIds(new Set());
    fetch(`/api/popular?language=${encodeURIComponent(language)}&limit=${POPULAR_PAGE_SIZE}&offset=0`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && Array.isArray(d.items)) {
          setPopularItems(d.items as PopularItem[]);
          setPopularHasMore(!!d.hasMore);
          setPopularOffset(d.items.length);
        }
        setPopularLoaded(true);
      })
      .catch(err => {
        console.error("Popular items error:", err);
        setPopularLoaded(true);
      });
  }, [language]);

  const loadMorePopular = () => {
    if (loadingMorePopular || !popularHasMore) return;
    setLoadingMorePopular(true);
    fetch(`/api/popular?language=${encodeURIComponent(language)}&limit=${POPULAR_PAGE_SIZE}&offset=${popularOffset}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (d && Array.isArray(d.items)) {
          setPopularItems(prev => [...prev, ...(d.items as PopularItem[])]);
          setPopularHasMore(!!d.hasMore);
          setPopularOffset(o => o + d.items.length);
        }
      })
      .catch(err => console.error("Popular load-more error:", err))
      .finally(() => setLoadingMorePopular(false));
  };

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (popularCollapsed || !popularHasMore) return;
    const sentinel = popularSentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) loadMorePopular();
      },
      { rootMargin: "200px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [popularCollapsed, popularHasMore, popularOffset, loadingMorePopular]);

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

  const savePins = (cats: string[], colIds: string[], listIds: string[]) => {
    if (loggedIn) {
      if (pinsDebounce.current) clearTimeout(pinsDebounce.current);
      pinsDebounce.current = setTimeout(() => {
        fetch("/api/user/pins", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedCats: cats, pinnedCollectionIds: colIds, pinnedListIds: listIds }),
        }).catch(() => {});
      }, 500);
    } else {
      localStorage.setItem("pinnedCats", JSON.stringify(cats));
      localStorage.setItem("pinnedCollectionIds", JSON.stringify(colIds));
      localStorage.setItem("pinnedListIds", JSON.stringify(listIds));
    }
  };

  const pin = (name: string, meta?: { name?: string; href?: string }) => {
    if (meta?.href || meta?.name) {
      const ref: ExternalPinnedRef = {
        name: meta?.name || name,
        href: meta?.href,
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
      savePins(next, pinnedCollectionIds, pinnedListIds);
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
      savePins(next, pinnedCollectionIds, pinnedListIds);
      return next;
    });
  };

  const unpinCollection = (id: string) => {
    setPinnedCollectionIds(prev => {
      const next = prev.filter(n => n !== id);
      savePins(pinnedNames, next, pinnedListIds);
      return next;
    });
  };

  const unpinList = (id: string) => {
    setPinnedListIds(prev => {
      const next = prev.filter(n => n !== id);
      savePins(pinnedNames, pinnedCollectionIds, next);
      return next;
    });
  };

  useEffect(() => {
    if (!loggedIn || homeListsLoaded) return;
    fetch("/api/lists")
      .then(r => r.json())
      .then(d => { setHomeLists(d.lists ?? []); setHomeListsLoaded(true); })
      .catch(() => {});
  }, [loggedIn, homeListsLoaded]);

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

    setCategories([]);
    setLoadingLang(false);
  }, [language]);

  const hrefToCategoryKey = (href: string): string => {
    const m = href.match(/\/test\/([^?]+)(?:\?.*?levels=([^&]+))?/);
    if (!m) return href;
    return m[2] ? `${m[1]}:${m[2]}` : m[1];
  };

  const addCategoryRef = async (item: { id: string; name: string; href?: string }) => {
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
    const childColor = ancestorExpanded || isExpanded ? FOLDER_COLOR : "var(--zen-ink)";
    const indentStyle = depth > 1 ? { marginLeft: `${(depth - 1) * 14}px` } : undefined;

    return (
      <div key={pinId} className="contents">
        <div>
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

  const popularFolderById = useMemo(() => {
    const map = new Map<string, PopularFolder>();
    const walk = (items: PopularItem[]) => {
      for (const item of items) {
        if (item.kind === "folder") {
          map.set(item.id, item);
          walk(item.children);
        }
      }
    };
    walk(popularItems);
    return map;
  }, [popularItems]);

  const popularFolderParentMap = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (items: PopularItem[], parentId: string | null) => {
      for (const item of items) {
        if (item.kind === "folder") {
          if (parentId) map.set(item.id, parentId);
          walk(item.children, item.id);
        }
      }
    };
    walk(popularItems, null);
    return map;
  }, [popularItems]);

  const togglePopularFolder = (folderId: string) => {
    setOpenFolderIds(prev => {
      if (prev.has(folderId)) return new Set();
      const chain = new Set<string>([folderId]);
      let cur: string | undefined = popularFolderParentMap.get(folderId);
      while (cur) {
        chain.add(cur);
        cur = popularFolderParentMap.get(cur);
      }
      return chain;
    });
  };

  const renderPopularQset = (q: PopularQset, inFolder: boolean = false): React.ReactNode => {
    const href = appendHrefOptions(`/test/${encodeURIComponent(q.id)}`, q.problemsPerTest, q.shuffleProblems);
    const pinId = `rec:${q.ownerId}:${q.id}`;
    return (
      <PinDraggable key={`pop-q-${q.id}`} pinId={pinId} name={q.name} href={href} from="grid">
        <a
          href={href}
          className="book-link bookshelf-btn"
          style={{ color: inFolder ? FOLDER_COLOR : "var(--zen-ink)" }}
          draggable={false}
        >
          {q.name}
        </a>
      </PinDraggable>
    );
  };

  const renderPopularList = (l: PopularList, inFolder: boolean = false): React.ReactNode => {
    const href = `/test/list?listId=${encodeURIComponent(l.id)}&autostart=1`;
    return (
      <PinDraggable key={`pop-l-${l.id}`} pinId={`rec-list:${l.id}`} name={l.title} href={href} from="grid">
        <a
          href={href}
          className="book-link bookshelf-btn"
          style={{ color: inFolder ? FOLDER_COLOR : "var(--zen-ink)" }}
          draggable={false}
        >
          {l.title}
        </a>
      </PinDraggable>
    );
  };

  const renderPopularFolder = (folder: PopularFolder, ancestorExpanded: boolean = false): React.ReactNode => {
    const isOpen = openFolderIds.has(folder.id);
    const isHighlighted = ancestorExpanded || isOpen;
    return (
      <div key={`pop-f-${folder.id}`} className="contents">
        <PinDraggable pinId={`rec-folder:${folder.ownerId}:${folder.id}`} name={folder.name} from="grid">
          <button
            type="button"
            className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
            style={{ color: isHighlighted ? FOLDER_COLOR : "var(--zen-ink)" }}
            title="公開資料夾"
            draggable={false}
            onClick={() => togglePopularFolder(folder.id)}
          >
            📁 {folder.name}
          </button>
        </PinDraggable>
        {isOpen && folder.children.map(child => {
          if (child.kind === "qset") return renderPopularQset(child, true);
          if (child.kind === "list") return renderPopularList(child, true);
          return renderPopularFolder(child, true);
        })}
      </div>
    );
  };

  const togglePinnedRecFolder = (key: string, chain: string[]) => {
    setPinnedRecOpenChain((prev) => {
      const idx = prev.indexOf(key);
      if (idx >= 0) return prev.slice(0, idx);
      return chain;
    });
  };

  const renderPinnedPopularChild = (item: PopularItem, chain: string[]): React.ReactNode => {
    if (item.kind === "qset") {
      const href = appendHrefOptions(`/test/${encodeURIComponent(item.id)}`, item.problemsPerTest, item.shuffleProblems);
      return (
        <PinDraggable key={`pinned-pop-q-${item.id}`} pinId={`rec:${item.ownerId}:${item.id}`} name={item.name} href={href} from="grid">
          <a href={href} className="book-link bookshelf-btn" style={{ color: FOLDER_COLOR }} draggable={false}>
            {item.name}
          </a>
        </PinDraggable>
      );
    }
    if (item.kind === "list") {
      const href = `/test/list?listId=${encodeURIComponent(item.id)}&autostart=1`;
      return (
        <PinDraggable key={`pinned-pop-l-${item.id}`} pinId={`rec-list:${item.id}`} name={item.title} from="pinned">
          <a href={href} className="book-link bookshelf-btn" style={{ color: FOLDER_COLOR }} draggable={false}>
            {item.title}
          </a>
        </PinDraggable>
      );
    }
    return renderPinnedPopularFolder(item, undefined, [...chain, item.id], true);
  };

  const renderPinnedPopularFolder = (
    folder: PopularFolder,
    pinValue: string | undefined,
    chain: string[],
    ancestorExpanded: boolean = false
  ): React.ReactNode => {
    const isOpen = pinnedRecOpenChain.includes(folder.id);
    const isHighlighted = ancestorExpanded || isOpen;
    const ctxId = pinValue ?? `rec-folder:${folder.ownerId}:${folder.id}`;
    return (
      <div key={`pinned-pop-f-${folder.id}`} className="contents">
        <PinDraggable pinId={ctxId} name={folder.name} from={pinValue ? "pinned" : "grid"}>
          <button
            type="button"
            className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
            style={{ color: isHighlighted ? FOLDER_COLOR : "var(--zen-ink)" }}
            title="公開資料夾"
            draggable={false}
            onClick={() => togglePinnedRecFolder(folder.id, chain)}
          >
            📁 {folder.name}
          </button>
        </PinDraggable>
        {isOpen && folder.children.map(child => renderPinnedPopularChild(child, chain))}
      </div>
    );
  };

  return (
    <DndContext sensors={dndSensors} onDragStart={handleDndStart} onDragEnd={handleDndEnd} onDragCancel={() => setActiveDrag(null)}>
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
      {/* top-left brand */}
      <div className="fixed top-8 left-6 sm:left-16 flex items-center gap-12 z-30">
        <div className="relative flex flex-col items-center leading-none">
          <h1 className="text-[2.5rem] font-bold zen-title leading-none" style={{ color: "#b19739" }}>Exam</h1>
          <span className="text-sm zen-subtle mt-3 whitespace-nowrap" style={{ color: "var(--zen-ink)" }}>exam.farm</span>
          <div className="absolute -top-1 -right-5">
            <LanguageSelector />
          </div>
        </div>
      </div>

      <main className="flex w-full flex-col pt-36 px-4 sm:pl-16 sm:pr-16 min-h-screen sm:pb-10 max-sm:h-dvh max-sm:overflow-hidden">
        <div className="flex flex-row items-start gap-6 w-full flex-1 max-sm:overflow-hidden max-sm:items-stretch max-sm:min-h-0">
          {/* Left panel — categories */}
          <div className="w-full sm:w-1/2 shrink-0 max-sm:flex max-sm:flex-col max-sm:h-full max-sm:overflow-hidden">

            {/* Pinned bar */}
            <PinnedBarDroppable
              className="relative min-h-[5.5rem] px-2 py-2 border-b transition-colors max-sm:shrink-0"
              style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
            >
              {loggedIn && pinnedNames.length === 0 && pinnedCollectionIds.length === 0 && pinnedListIds.length === 0 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 select-none" style={{ color: "var(--zen-ink)" }}>
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              )}
              {(pinnedNames.length > 0 || pinnedCollectionIds.length > 0 || pinnedListIds.length > 0) && (
                <div className="bookshelf-grid home-bookshelf-grid">
                  {pinnedListIds.map((id) => {
                    const list = homeLists.find(l => l.id === id);
                    if (!list) return null;
                    return (
                      <PinDraggable key={id} pinId={list.id} name={list.title} from="list-pinned">
                        <a
                          href={`/test/list?listId=${list.id}&autostart=1`}
                          className="book-link bookshelf-btn"
                          style={{ color: "var(--zen-ink)" }}
                          draggable={false}
                        >
                          {list.title}
                        </a>
                      </PinDraggable>
                    );
                  })}
                  {pinnedCollectionIds.map((id) => {
                    const col = myCollections.find(c => c.id === id);
                    if (!col) return null;
                    return (
                      <PinDraggable key={id} pinId={col.id} name={col.displayName} from="my-collection-pinned">
                        <a
                          href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
                          className="book-link bookshelf-btn"
                          style={{ color: "var(--zen-ink)" }}
                          draggable={false}
                        >
                          {col.displayName}
                        </a>
                      </PinDraggable>
                    );
                  })}
                  {pinnedNames.map((pinValue) => {
                    if (pinValue.startsWith("rec-folder:")) {
                      const parts = pinValue.split(":");
                      const folderId = parts[2];
                      const folder = popularFolderById.get(folderId);
                      if (folder) {
                        return renderPinnedPopularFolder(folder, pinValue, [folder.id]);
                      }
                      const external = externalPinnedRefs[pinValue];
                      const displayName = external?.name ?? "資料夾";
                      return (
                        <PinDraggable key={pinValue} pinId={pinValue} name={displayName} from="pinned">
                          <button
                            type="button"
                            className="book-link bookshelf-btn"
                            style={{ color: FOLDER_COLOR }}
                            title="公開資料夾"
                            draggable={false}
                          >
                            📁 {displayName}
                          </button>
                        </PinDraggable>
                      );
                    }
                    const found = findPinnedNode(pinValue, subjects);
                    if (!found) {
                      const external = externalPinnedRefs[pinValue];
                      const fallbackHref = external?.href ?? keyToHref(pinValue);
                      if (!fallbackHref) return null;
                      const label = external?.name ?? keyToLabel(pinValue);
                      return (
                        <PinDraggable key={`ext-${pinValue}`} pinId={pinValue} name={label} href={fallbackHref} from="pinned">
                          <a
                            href={fallbackHref}
                            className="book-link bookshelf-btn"
                            style={{ color: "var(--zen-ink)" }}
                            draggable={false}
                          >
                            {label}
                          </a>
                        </PinDraggable>
                      );
                    }
                    const { node: subject, path, pinId } = found;
                    if (subject.children?.length) {
                      return renderPinnedFolder(subject, pinId, path, 0, [pinId]);
                    }
                    return (
                      <PinDraggable key={pinId} pinId={pinId} name={subject.name} href={subject.href} from="pinned">
                        <Link
                          href={hrefWithOptions(subject)}
                          className="book-link bookshelf-btn"
                          style={{ color: "var(--zen-ink)" }}
                          draggable={false}
                        >
                          {subject.name}
                        </Link>
                      </PinDraggable>
                    );
                  })}
                </div>
              )}
            </PinnedBarDroppable>

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

                {popularLoaded && (
                  <div className="mt-6">
                    <button
                      type="button"
                      onClick={() => setPopularCollapsed(o => !o)}
                      aria-label={popularCollapsed ? "展開" : "收合"}
                      title={popularCollapsed ? "展開" : "收合"}
                      className="flex items-center gap-1 mb-3 text-xs transition-colors"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      <span>{language === "en" ? "Popular" : "熱門"}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        style={{ transform: popularCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.2s" }}
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </button>
                    {!popularCollapsed && (
                      popularItems.length > 0 ? (
                        <>
                          <div className="bookshelf-grid">
                            {popularItems.map(item => {
                              if (item.kind === "qset") return renderPopularQset(item);
                              if (item.kind === "list") return renderPopularList(item);
                              return renderPopularFolder(item);
                            })}
                          </div>
                          {popularHasMore && (
                            <div ref={popularSentinelRef} className="h-8 flex items-center justify-center text-xs zen-subtle opacity-50">
                              {loadingMorePopular ? (language === "en" ? "Loading…" : "載入中…") : ""}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-sm zen-subtle opacity-50">
                          {language === "en" ? "No tests yet" : "暫無測驗"}
                        </p>
                      ))}
                  </div>
                )}

                {/* pinned profile tabs — mobile only */}
                {loggedIn && visiblePinnedProfileTabs.length > 0 && (
                  <div className="sm:hidden mt-6">
                    {visiblePinnedProfileTabs.map((p) => {
                      const section = (
                        <PinnedProfileTabSection
                          name={p.name}
                          tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked"}
                          label={p.label}
                          onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                        />
                      );
                      if (p.tab === "lists") {
                        return <div key={`mobile-${p.name}-${p.tab}`}>{section}</div>;
                      }
                      return (
                        <PinDraggable
                          key={`mobile-${p.name}-${p.tab}`}
                          pinId={`${p.name}\t${p.tab}`}
                          name={p.label}
                          from="profile-tab-pinned"
                        >
                          {section}
                        </PinDraggable>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            </>
            )}
          </div>

          {/* Right panel — pinned profile tabs (desktop) */}
          {loggedIn && visiblePinnedProfileTabs.length > 0 && (
            <div className="hidden sm:block flex-1 pt-2 px-2">
              {visiblePinnedProfileTabs.map((p) => {
                const section = (
                  <PinnedProfileTabSection
                    name={p.name}
                    tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked"}
                    label={p.label}
                    onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                  />
                );
                if (p.tab === "lists") {
                  return <div key={`desktop-${p.name}-${p.tab}`}>{section}</div>;
                }
                return (
                  <PinDraggable
                    key={`desktop-${p.name}-${p.tab}`}
                    pinId={`${p.name}\t${p.tab}`}
                    name={p.label}
                    from="profile-tab-pinned"
                  >
                    {section}
                  </PinDraggable>
                );
              })}
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
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="m2 7 10 7 10-7"/>
        </svg>
      </Link>
    </div>
    <DragOverlay dropAnimation={null}>
      {activeDrag ? (
        <div
          className="book-link bookshelf-btn"
          style={{ color: "var(--zen-ink)", backgroundColor: "var(--zen-paper)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", cursor: "grabbing" }}
        >
          {activeDrag.name}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}
