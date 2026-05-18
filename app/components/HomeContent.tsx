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

type UserResult = {
  id: string;
  name: string;
  avatarUrl?: string;
  categories?: Array<{
    id: string;
    name: string;
    href?: string;
    parentId?: string | null;
    problemsPerTest?: number | null;
    shuffleProblems?: boolean | null;
  }>;
  lists?: Array<{
    id: string;
    title: string;
    parentId?: string | null;
  }>;
  folders?: Array<{
    id: string;
    name: string;
    parentId: string | null;
  }>;
};
type ExternalPinnedRef = {
  name: string;
  href?: string;
};
type CtxMenu = {
  id: string;
  name: string;
  href?: string;
  x: number;
  y: number;
  from: "pinned" | "grid" | "list-pinned" | "my-collection-pinned";
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
              onContextMenu={e => openCtx(e, pinId, node.name, "pinned", node.href)}
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
                  style={{ color: LEAF_COLOR }}
                  draggable={false}
                  onContextMenu={e => openCtx(e, childPinId, child.name, "pinned", child.href)}
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
  const [query, setQuery] = useState("");
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [openDropKey, setOpenDropKey] = useState<string | null>(null);
  const [openYearKey, setOpenYearKey] = useState<string | null>(null);
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [ownerCatResults, setOwnerCatResults] = useState<Array<{ id: string; name: string; href: string | null; ownerId: string; ownerName: string | null; ownerAvatarUrl: string | null; problemsPerTest: number | null; shuffleProblems: boolean | null }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [catOpen, setCatOpen] = useState(true);
  const [pinnedNames, setPinnedNames] = useState<string[]>([]);
  const [externalPinnedRefs, setExternalPinnedRefs] = useState<Record<string, ExternalPinnedRef>>({});
  const [openPinnedKeyChain, setOpenPinnedKeyChain] = useState<string[]>([]);
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null);
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
  const [recommendedOpenFolderKeys, setRecommendedOpenFolderKeys] = useState<Set<string>>(new Set());
  const [pinnedRecOpenChain, setPinnedRecOpenChain] = useState<string[]>([]);
  const pinsDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: session } = useSession();
  const loggedIn = !!session?.user;
  const visiblePinnedProfileTabs = pinnedProfileTabs;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeDrag, setActiveDrag] = useState<PinDragData | null>(null);
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );
  const subjects = useFilteredCategories(categories, query);

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
    const isOpen = !!query || openKeys.has(key);
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
          onContextMenu={loggedIn ? e => openCtx(e, pinId, node.name, isPinned ? "pinned" : "grid", node.href) : undefined}
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

  // Load recommended accounts
  useEffect(() => {
    setRecommendedAccounts([]);
    setRecommendedLoaded(false);
    setRecommendedOpenFolderKeys(new Set());
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
            folders: u.folders || [],
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
    href?: string
  ) => {
    e.preventDefault();
    setCtxMenu({ id, name, href, x: e.clientX, y: e.clientY, from });
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

  const recommendedFolderKey = (ownerId: string, folderId: string): string => `${ownerId}:${folderId}`;

  const toggleRecommendedFolder = (user: UserResult, folderId: string) => {
    const key = recommendedFolderKey(user.id, folderId);
    setRecommendedOpenFolderKeys((prev) => {
      if (prev.has(key)) return new Set();
      const path: string[] = [];
      let cur: string | null = folderId;
      while (cur) {
        path.unshift(recommendedFolderKey(user.id, cur));
        const f = user.folders?.find((f) => f.id === cur);
        cur = f?.parentId ?? null;
      }
      return new Set(path);
    });
  };

  const recommendedCategoriesUnder = (user: UserResult, folderId: string | null) =>
    (user.categories ?? []).filter((cat) => (cat.parentId ?? null) === folderId);

  const recommendedFoldersUnder = (user: UserResult, folderId: string | null) =>
    (user.folders ?? []).filter((folder) => (folder.parentId ?? null) === folderId);

  const recommendedListsUnder = (user: UserResult, folderId: string | null) =>
    (user.lists ?? []).filter((list) => (list.parentId ?? null) === folderId);

  const recommendedFolderHasContent = (user: UserResult, folderId: string | null): boolean => {
    if (recommendedCategoriesUnder(user, folderId).length > 0) return true;
    return recommendedFoldersUnder(user, folderId).some((f) => recommendedFolderHasContent(user, f.id));
  };

  const renderRecommendedCategory = (
    user: UserResult,
    cat: NonNullable<UserResult["categories"]>[number],
    inChain: boolean = false
  ) => {
    const recommendedHref = appendHrefOptions(`/test/${encodeURIComponent(cat.id)}`, cat.problemsPerTest, cat.shuffleProblems);
    const pinId = cat.href ? `href:${hrefToCategoryKey(cat.href)}` : `rec:${user.id}:${cat.id}`;
    const isPinned = loggedIn && pinnedNames.includes(pinId);
    return (
      <PinDraggable key={`cat-${cat.id}`} pinId={pinId} name={cat.name} href={recommendedHref} from="grid">
        <a
          href={recommendedHref}
          className="book-link bookshelf-btn"
          style={{ color: inChain ? FOLDER_COLOR : LEAF_COLOR }}
          draggable={false}
          onContextMenu={loggedIn ? e => openCtx(e, pinId, cat.name, isPinned ? "pinned" : "grid", recommendedHref) : undefined}
        >
          {cat.name}
        </a>
      </PinDraggable>
    );
  };

  const renderRecommendedList = (
    list: NonNullable<UserResult["lists"]>[number],
    inChain: boolean = false
  ) => (
    <a
      key={`list-${list.id}`}
      href={`/test/list?listId=${encodeURIComponent(list.id)}&autostart=1`}
      className="book-link bookshelf-btn"
      style={{ color: inChain ? FOLDER_COLOR : LEAF_COLOR }}
    >
      {list.title}
    </a>
  );

  const renderRecommendedFolder = (
    user: UserResult,
    folder: NonNullable<UserResult["folders"]>[number],
    ancestorExpanded: boolean = false
  ): React.ReactNode => {
    const key = recommendedFolderKey(user.id, folder.id);
    const isOpen = recommendedOpenFolderKeys.has(key);
    const isHighlighted = ancestorExpanded || isOpen;
    return (
      <div key={`folder-${folder.id}`} className="contents">
        <PinDraggable pinId={`rec-folder:${user.id}:${folder.id}`} name={folder.name} from="grid">
          <button
            type="button"
            className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
            style={{ color: isHighlighted ? FOLDER_COLOR : LEAF_COLOR }}
            title="公開資料夾"
            draggable={false}
            onClick={() => toggleRecommendedFolder(user, folder.id)}
            onContextMenu={loggedIn ? e => openCtx(e, `rec-folder:${user.id}:${folder.id}`, folder.name, "grid") : undefined}
          >
            📁 {folder.name}
          </button>
        </PinDraggable>
        {isOpen && recommendedCategoriesUnder(user, folder.id).map((cat) => renderRecommendedCategory(user, cat, true))}
        {isOpen && recommendedFoldersUnder(user, folder.id).filter((f) => recommendedFolderHasContent(user, f.id)).map((child) => renderRecommendedFolder(user, child, true))}
        {isOpen && recommendedListsUnder(user, folder.id).map((list) => renderRecommendedList(list, true))}
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

  const renderPinnedRecCategory = (
    user: UserResult,
    cat: NonNullable<UserResult["categories"]>[number]
  ): React.ReactNode => {
    const recommendedHref = appendHrefOptions(`/test/${encodeURIComponent(cat.id)}`, cat.problemsPerTest, cat.shuffleProblems);
    const pinId = cat.href ? `href:${hrefToCategoryKey(cat.href)}` : `rec:${user.id}:${cat.id}`;
    const isPinned = loggedIn && pinnedNames.includes(pinId);
    return (
      <PinDraggable
        key={`pinned-cat-${cat.id}`}
        pinId={pinId}
        name={cat.name}
        href={recommendedHref}
        from={isPinned ? "pinned" : "grid"}
      >
        <a
          href={recommendedHref}
          className="book-link bookshelf-btn"
          style={{ color: FOLDER_COLOR }}
          draggable={false}
          onContextMenu={loggedIn ? e => openCtx(e, pinId, cat.name, isPinned ? "pinned" : "grid", recommendedHref) : undefined}
        >
          {cat.name}
        </a>
      </PinDraggable>
    );
  };

  const renderPinnedRecList = (
    list: NonNullable<UserResult["lists"]>[number]
  ): React.ReactNode => (
    <PinDraggable
      key={`pinned-list-${list.id}`}
      pinId={`rec-list:${list.id}`}
      name={list.title}
      from="pinned"
    >
      <a
        href={`/test/list?listId=${encodeURIComponent(list.id)}&autostart=1`}
        className="book-link bookshelf-btn"
        style={{ color: FOLDER_COLOR }}
        draggable={false}
      >
        {list.title}
      </a>
    </PinDraggable>
  );

  const renderPinnedRecFolder = (
    user: UserResult,
    folder: NonNullable<UserResult["folders"]>[number],
    pinValue: string | undefined,
    chain: string[],
    ancestorExpanded: boolean = false
  ): React.ReactNode => {
    const key = recommendedFolderKey(user.id, folder.id);
    const isOpen = pinnedRecOpenChain.includes(key);
    const isHighlighted = ancestorExpanded || isOpen;
    const ctxId = pinValue ?? `rec-folder:${user.id}:${folder.id}`;
    const ctxFrom: CtxMenu["from"] = pinValue ? "pinned" : "grid";
    return (
      <div key={`pinned-folder-${user.id}-${folder.id}`} className="contents">
        <PinDraggable pinId={ctxId} name={folder.name} from={pinValue ? "pinned" : "grid"}>
          <button
            type="button"
            className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
            style={{ color: isHighlighted ? FOLDER_COLOR : LEAF_COLOR }}
            title="公開資料夾"
            draggable={false}
            onClick={() => togglePinnedRecFolder(key, chain)}
            onContextMenu={loggedIn ? e => openCtx(e, ctxId, folder.name, ctxFrom) : undefined}
          >
            📁 {folder.name}
          </button>
        </PinDraggable>
        {isOpen && recommendedCategoriesUnder(user, folder.id).map((cat) => renderPinnedRecCategory(user, cat))}
        {isOpen && recommendedFoldersUnder(user, folder.id).filter((f) => recommendedFolderHasContent(user, f.id)).map((child) => renderPinnedRecFolder(user, child, undefined, [...chain, recommendedFolderKey(user.id, child.id)], true))}
        {isOpen && recommendedListsUnder(user, folder.id).map((list) => renderPinnedRecList(list))}
      </div>
    );
  };

  const renderRecommendedCreatorItems = (user: UserResult) => (
    <>
      {recommendedCategoriesUnder(user, null).map((cat) => renderRecommendedCategory(user, cat))}
      {recommendedFoldersUnder(user, null).filter((f) => recommendedFolderHasContent(user, f.id)).map((folder) => renderRecommendedFolder(user, folder))}
      {recommendedListsUnder(user, null).map((list) => renderRecommendedList(list))}
    </>
  );

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
                onClick={() => { pin(ctxMenu.id, { name: ctxMenu.name, href: ctxMenu.href }); setCtxMenu(null); }}
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
            ) : null}
          </div>
        </>
      )}

      {/* top-left brand */}
      <div className="fixed top-8 left-6 sm:left-16 flex items-center gap-12 z-30">
        <div className="relative flex flex-col items-center leading-none">
          <h1 className="text-[2.5rem] font-bold zen-title leading-none" style={{ color: "#b19739" }}>Exam</h1>
          <span className="text-sm zen-subtle mt-3 whitespace-nowrap" style={{ color: "#D1D5DB" }}>exam.farm</span>
          <div className="absolute -top-1 -right-5">
            <LanguageSelector />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="home-search w-[12.5rem] sm:w-[18.75rem] p-2 rounded-full border text-sm outline-none transition-all"
            style={{ backgroundColor: "#1a1a1a", color: "#d1d5db", borderColor: "#3a3a3a" }}
            placeholder={language === "en" ? "Search subjects or users" : "搜尋分類或帳號"}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpenKeys(new Set()); }}
          />
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
              {loggedIn && !session?.user?.name && pinnedNames.length === 0 && pinnedCollectionIds.length === 0 && pinnedListIds.length === 0 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20 select-none" style={{ color: "var(--zen-ink)" }}>
                  <line x1="12" y1="17" x2="12" y2="22"/>
                  <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
                </svg>
              )}
              {loggedIn && (!!session?.user?.name || pinnedNames.length > 0 || pinnedCollectionIds.length > 0 || pinnedListIds.length > 0) && (
                <div className="bookshelf-grid home-bookshelf-grid">
                  {pinnedListIds.map((id) => {
                    const list = homeLists.find(l => l.id === id);
                    if (!list) return null;
                    return (
                      <PinDraggable key={id} pinId={list.id} name={list.title} from="list-pinned">
                        <a
                          href={`/test/list?listId=${list.id}&autostart=1`}
                          className="book-link bookshelf-btn"
                          style={{ color: "#D1D5DB" }}
                          draggable={false}
                          onContextMenu={e => { e.preventDefault(); setCtxMenu({ id: list.id, name: list.title, x: e.clientX, y: e.clientY, from: "list-pinned" }); }}
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
                          style={{ color: LEAF_COLOR }}
                          draggable={false}
                          onContextMenu={e => { e.preventDefault(); setCtxMenu({ id: col.id, name: col.displayName, x: e.clientX, y: e.clientY, from: "my-collection-pinned" }); }}
                        >
                          {col.displayName}
                        </a>
                      </PinDraggable>
                    );
                  })}
                  {pinnedNames.map((pinValue) => {
                    if (pinValue.startsWith("rec-folder:")) {
                      const parts = pinValue.split(":");
                      const ownerId = parts[1];
                      const folderId = parts[2];
                      const allUsers = [...recommendedAccounts, ...userResults];
                      const user = allUsers.find(u => u.id === ownerId);
                      const folder = user?.folders?.find(f => f.id === folderId);
                      if (user && folder) {
                        const topKey = recommendedFolderKey(user.id, folder.id);
                        return renderPinnedRecFolder(user, folder, pinValue, [topKey]);
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
                            onContextMenu={e => openCtx(e, pinValue, displayName, "pinned")}
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
                            style={{ color: LEAF_COLOR }}
                            draggable={false}
                            onContextMenu={e => openCtx(e, pinValue, label, "pinned", fallbackHref)}
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
                          style={{ color: LEAF_COLOR }}
                          draggable={false}
                          onContextMenu={e => openCtx(e, pinId, subject.name, "pinned", subject.href)}
                        >
                          {subject.name}
                        </Link>
                      </PinDraggable>
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
                      ).map(([ownerId, { ownerName, ownerAvatarUrl, cats }]) => (
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
                              {cats.map(cat => {
                                const recommendedHref = appendHrefOptions(`/test/${encodeURIComponent(cat.id)}`, cat.problemsPerTest, cat.shuffleProblems);
                                const pinId = cat.href ? `href:${hrefToCategoryKey(cat.href)}` : `rec:${ownerId}:${cat.id}`;
                                const isPinned = loggedIn && pinnedNames.includes(pinId);
                                return (
                                  <PinDraggable key={cat.id} pinId={pinId} name={cat.name} href={recommendedHref} from="grid">
                                    <a
                                      href={recommendedHref}
                                      className="book-link bookshelf-btn"
                                      style={{ color: LEAF_COLOR }}
                                      draggable={false}
                                      onContextMenu={loggedIn ? e => openCtx(e, pinId, cat.name, isPinned ? "pinned" : "grid", recommendedHref) : undefined}
                                    >
                                      {cat.name}
                                    </a>
                                  </PinDraggable>
                                );
                              })}
                          </div>
                        </li>
                      ))}
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
                          <span className="text-sm font-medium text-center leading-tight" style={{ color: "#b19739" }}>{u.name}</span>
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
                              className="inline-block mb-3 hover:opacity-80 transition-opacity"
                            >
                              <span className="text-base font-medium" style={{ color: "#b19739" }}>{u.name}</span>
                            </Link>
                            {((u.categories && u.categories.length > 0) || (u.folders && u.folders.length > 0) || (u.lists && u.lists.length > 0)) && (
                                <div className="bookshelf-grid">
                                  {renderRecommendedCreatorItems(u)}
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

                {/* pinned profile tabs — mobile only */}
                {loggedIn && visiblePinnedProfileTabs.length > 0 && (
                  <div className="sm:hidden mt-6">
                    {visiblePinnedProfileTabs.map((p) => (
                      <PinDraggable
                        key={`mobile-${p.name}-${p.tab}`}
                        pinId={`${p.name}\t${p.tab}`}
                        name={p.label}
                        from="profile-tab-pinned"
                      >
                        <PinnedProfileTabSection
                          name={p.name}
                          tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked"}
                          label={p.label}
                          onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                        />
                      </PinDraggable>
                    ))}
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
              {visiblePinnedProfileTabs.map((p) => (
                <PinDraggable
                  key={`desktop-${p.name}-${p.tab}`}
                  pinId={`${p.name}\t${p.tab}`}
                  name={p.label}
                  from="profile-tab-pinned"
                >
                  <PinnedProfileTabSection
                    name={p.name}
                    tab={p.tab as "profile" | "lists" | "record" | "followers" | "following" | "groups" | "blocked"}
                    label={p.label}
                    onContextMenu={e => { e.preventDefault(); setProfileTabCtxMenu({ name: p.name, tab: p.tab, label: p.label, x: e.clientX, y: e.clientY }); }}
                  />
                </PinDraggable>
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
