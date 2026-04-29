"use client";

import React, { useEffect, useRef, useState } from "react";
import type { QuestionList, ListQuestion } from "../../lib/lists-supabase";
import type { PersonalTree, ItemKind } from "../../lib/personal-tree";
import { getCollectionLabel } from "./collectionLabels";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";

export type MyCollection = { id: string; collectionId: string; displayName: string; createdAt: string; fromGrid?: boolean };

type Group = { id: string; name: string; memberCount?: number };
type ShareResult = { type: "user" | "group"; id: string; name: string; avatarUrl?: string; memberCount?: number };

type Props = {
  isOwner: boolean;
  loading: boolean;
  lists: QuestionList[];
  setLists: React.Dispatch<React.SetStateAction<QuestionList[]>>;
  myCollections: MyCollection[];
  pinnedListIds: string[];
  setPinnedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  pinnedCollectionIds: string[];
  setPinnedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>;
  tree?: PersonalTree;
  setTree?: React.Dispatch<React.SetStateAction<PersonalTree>>;
};

export function PersonalListsView({
  isOwner,
  loading,
  lists,
  setLists,
  myCollections,
  pinnedListIds,
  setPinnedListIds,
  pinnedCollectionIds,
  setPinnedCollectionIds,
  tree,
  setTree,
}: Props) {
  const [refCtxMenuId, setRefCtxMenuId] = useState<string | null>(null);
  const [refCtxMenuPos, setRefCtxMenuPos] = useState({ x: 0, y: 0 });
  const [folderCtxMenuId, setFolderCtxMenuId] = useState<string | null>(null);
  const [folderCtxMenuPos, setFolderCtxMenuPos] = useState({ x: 0, y: 0 });
  const [movePicker, setMovePicker] = useState<{ kind: ItemKind; id: string; name: string; x: number; y: number } | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [addingUnderFolderId, setAddingUnderFolderId] = useState<string | null | undefined>(undefined);
  const [newFolderName, setNewFolderName] = useState("");
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const toggleFolderOpen = (id: string) => setOpenFolderIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });
  const [shareOpenId, setShareOpenId] = useState<string | null>(null);
  const [shareInput, setShareInput] = useState("");
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSearchResults, setShareSearchResults] = useState<ShareResult[]>([]);
  const [shareSearchLoading, setShareSearchLoading] = useState(false);
  const [shareSharedGroupIds, setShareSharedGroupIds] = useState<Set<string>>(new Set());
  const [ownedGroups, setOwnedGroups] = useState<Group[]>([]);
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const shareSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // collection share panel
  const [colShareId, setColShareId] = useState<string | null>(null);
  const [colShareSentIds, setColShareSentIds] = useState<Set<string>>(new Set());
  const [colShareSending, setColShareSending] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner || groupsLoaded) return;
    if (!shareOpenId && !colShareId) return;
    fetch("/api/groups")
      .then(r => r.json())
      .then(d => { setOwnedGroups(d.owned ?? []); setJoinedGroups(d.joined ?? []); setGroupsLoaded(true); })
      .catch(() => {});
  }, [shareOpenId, colShareId, isOwner, groupsLoaded]);

  useEffect(() => {
    if (!contextMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [contextMenuId]);

  useEffect(() => {
    if (!colCtxMenuId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setColCtxMenuId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [colCtxMenuId]);

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

  const shareCollectionTo = async (col: MyCollection, target: { type: "user" | "group"; id: string; name: string }) => {
    setColShareSending(target.id);
    try {
      const body = target.type === "user"
        ? { categoryKey: col.collectionId, categoryName: col.displayName, targetUserName: target.name }
        : { categoryKey: col.collectionId, categoryName: col.displayName, groupId: target.id };
      const res = await fetch("/api/categories/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) setColShareSentIds(prev => new Set(prev).add(target.id));
    } finally {
      setColShareSending(null);
    }
  };

  // ── tree mutations ────────────────────────────────────────────────────────
  const patchTree = async (body: Record<string, unknown>) => {
    if (!setTree) return;
    try {
      const res = await fetch("/api/user/personal-tree", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (d?.tree) setTree(d.tree as PersonalTree);
    } catch {}
  };

  const moveItemToFolder = async (kind: ItemKind, id: string, folderId: string | null) => {
    if (kind === "ref" && tree) {
      setTree?.(prev => ({
        ...prev,
        categoryRefs: prev.categoryRefs.map(r => r.id === id ? { ...r, folderId } : r),
      }));
    } else if (kind === "folder" && tree) {
      setTree?.(prev => ({
        ...prev,
        folders: prev.folders.map(f => f.id === id ? { ...f, parentId: folderId } : f),
      }));
    } else if ((kind === "list" || kind === "collection") && tree) {
      setTree?.(prev => ({
        ...prev,
        leafPlacement: {
          ...prev.leafPlacement,
          [kind]: { ...prev.leafPlacement[kind], [id]: { folderId, sort: prev.leafPlacement[kind][id]?.sort ?? 0 } },
        },
      }));
    }
    await patchTree({ op: "setItemFolder", kind, id, folderId });
  };

  const createFolder = async (name: string, parentId: string | null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await patchTree({ op: "addFolder", name: trimmed, parentId });
  };

  const renameFolderById = async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (tree) {
      setTree?.(prev => ({
        ...prev,
        folders: prev.folders.map(f => f.id === id ? { ...f, name: trimmed } : f),
      }));
    }
    await patchTree({ op: "renameFolder", id, name: trimmed });
  };

  const deleteFolderById = async (id: string) => {
    await patchTree({ op: "deleteFolder", id });
  };

  const removeRefById = async (id: string) => {
    if (tree) {
      setTree?.(prev => ({ ...prev, categoryRefs: prev.categoryRefs.filter(r => r.id !== id) }));
    }
    await patchTree({ op: "removeCategoryRef", id });
  };

  // helper to get an item's current folder id for state lookups
  const getListFolder = (id: string) => tree?.leafPlacement.list[id]?.folderId ?? null;
  const getCollectionFolder = (id: string) => tree?.leafPlacement.collection[id]?.folderId ?? null;

  if (loading) {
    return <p className="text-sm zen-subtle">載入中...</p>;
  }

  const treeRefs = tree?.categoryRefs ?? [];
  if (lists.length === 0 && myCollections.length === 0 && treeRefs.length === 0) {
    return (
      <p className="text-sm zen-subtle opacity-50">
        {isOwner ? "尚無試卷，在題目頁按 + 新增" : "尚無公開試卷"}
      </p>
    );
  }

  // Build folder pickable list (excluding self & descendants when moving a folder).
  const pickableFolders = (excludeFolderId?: string): { id: string | null; label: string }[] => {
    const all = tree?.folders ?? [];
    const exclude = new Set<string>();
    if (excludeFolderId) {
      const collect = (fid: string) => {
        exclude.add(fid);
        for (const f of all) if (f.parentId === fid) collect(f.id);
      };
      collect(excludeFolderId);
    }
    const labelOf = (id: string): string => {
      const f = all.find(x => x.id === id);
      if (!f) return "";
      return f.parentId ? `${labelOf(f.parentId)} / ${f.name}` : f.name;
    };
    return [
      { id: null, label: "根目錄" },
      ...all.filter(f => !exclude.has(f.id)).map(f => ({ id: f.id, label: labelOf(f.id) })),
    ];
  };

  const openMovePicker = (e: React.MouseEvent, kind: ItemKind, id: string, name: string) => {
    setMovePicker({ kind, id, name, x: e.clientX, y: e.clientY });
  };

  const renderListTile = (list: QuestionList, li: number, asSubItem = false) => (
    <div key={list.id} className="relative"
      onContextMenu={isOwner ? e => {
        e.preventDefault();
        setContextMenuId(list.id);
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      } : undefined}
    >
      <a href={`/test/list?listId=${list.id}&autostart=1`}
        className={`book-link bookshelf-btn${asSubItem ? " sub-item" : ""}`}
        style={{ color: li % 2 === 0 ? "#6ea8d8" : "#d87fa0" }}>
        <span>{list.title}</span>
      </a>
      {isOwner && contextMenuId === list.id && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setContextMenuId(null)} />
          <div className="fixed z-50 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: contextMenuPos.x, top: contextMenuPos.y }}>
            <button type="button" onMouseDown={e => e.stopPropagation()}
              onClick={() => { setContextMenuId(null); window.location.href = `/lists/${list.id}/edit`; }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}>編輯</button>
            <button type="button" onMouseDown={e => e.stopPropagation()}
              onClick={() => { setShareOpenId(shareOpenId === list.id ? null : list.id); setShareInput(""); setShareError(null); setShareSearchResults([]); setShareSharedGroupIds(new Set()); setExpandedId(null); setContextMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}>分享</button>
            <button type="button" onMouseDown={e => e.stopPropagation()}
              onClick={() => { toggleListPin(list.id); setContextMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}>{pinnedListIds.includes(list.id) ? "取消釘選" : "釘選"}</button>
            {setTree && tree && (
              <button type="button" onMouseDown={e => e.stopPropagation()}
                onClick={(e) => { setContextMenuId(null); openMovePicker(e, "list", list.id, list.title); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}>移到資料夾</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderColTile = (col: MyCollection, ci: number, asSubItem = false) => (
    <div key={`my-${col.id}`} className="relative"
      onContextMenu={isOwner ? e => {
        e.preventDefault();
        setColCtxMenuId(col.id);
        setColCtxMenuPos({ x: e.clientX, y: e.clientY });
      } : undefined}
    >
      <a href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
        className={`book-link bookshelf-btn${asSubItem ? " sub-item" : ""}`}
        style={{ color: ci % 2 === 0 ? "#b19739" : "#5fa870" }}>
        {col.displayName}
      </a>
      {isOwner && colCtxMenuId === col.id && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setColCtxMenuId(null)} />
          <div className="fixed z-50 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: colCtxMenuPos.x, top: colCtxMenuPos.y }}>
            {!col.fromGrid && (
              <button type="button" onMouseDown={e => e.stopPropagation()}
                onClick={() => { setColCtxMenuId(null); window.location.href = `/collections/${encodeURIComponent(col.collectionId)}/edit`; }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}>編輯</button>
            )}
            <button type="button" onMouseDown={e => e.stopPropagation()}
              onClick={() => { setColShareId(colShareId === col.id ? null : col.id); setShareInput(""); setShareError(null); setShareSearchResults([]); setColShareSentIds(new Set()); setColCtxMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}>分享</button>
            <button type="button" onMouseDown={e => e.stopPropagation()}
              onClick={() => { toggleCollectionPin(col.id); setColCtxMenuId(null); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: "var(--zen-ink)" }}>{pinnedCollectionIds.includes(col.id) ? "取消釘選" : "釘選"}</button>
            {setTree && tree && (
              <button type="button" onMouseDown={e => e.stopPropagation()}
                onClick={(e) => { setColCtxMenuId(null); openMovePicker(e, "collection", col.id, col.displayName); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}>移到資料夾</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  const renderRefTile = (ref: { id: string; key: string; name: string }, ri: number, asSubItem = false) => {
    const href = ref.key.includes(":")
      ? `/test/${encodeURIComponent(ref.key.split(":")[0])}?levels=${encodeURIComponent(ref.key.split(":")[1])}&autostart=1`
      : `/test/${encodeURIComponent(ref.key)}?autostart=1`;
    return (
      <div key={`ref-${ref.id}`} className="relative"
        onContextMenu={isOwner ? e => {
          e.preventDefault();
          setRefCtxMenuId(ref.id);
          setRefCtxMenuPos({ x: e.clientX, y: e.clientY });
        } : undefined}
      >
        <a href={href}
          className={`book-link bookshelf-btn${asSubItem ? " sub-item" : ""}`}
          style={{ color: ri % 2 === 0 ? "#b19739" : "#5fa870" }}>
          {ref.name}
        </a>
        {isOwner && refCtxMenuId === ref.id && (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setRefCtxMenuId(null)} />
            <div className="fixed z-50 w-28 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
              style={{ left: refCtxMenuPos.x, top: refCtxMenuPos.y }}>
              {setTree && tree && (
                <button type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={(e) => { setRefCtxMenuId(null); openMovePicker(e, "ref", ref.id, ref.name); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>移到資料夾</button>
              )}
              <button type="button" onMouseDown={e => e.stopPropagation()}
                onClick={() => { removeRefById(ref.id); setRefCtxMenuId(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}>移除</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderFolderTile = (
    folder: { id: string; name: string; parentId: string | null },
    fi: number,
    asSubItem: boolean
  ): React.ReactNode => {
    const isExpanded = openFolderIds.has(folder.id);
    const isRenaming = renamingFolderId === folder.id;
    const color = fi % 2 === 0 ? "#9b7dd4" : "#c4825a";
    return (
      <div key={`folder-${folder.id}`} className="contents">
        <div className="relative"
          onContextMenu={isOwner && setTree ? e => {
            e.preventDefault();
            setFolderCtxMenuId(folder.id);
            setFolderCtxMenuPos({ x: e.clientX, y: e.clientY });
          } : undefined}
        >
          {isRenaming ? (
            <div className={`book-link bookshelf-btn${asSubItem ? " sub-item" : ""}`} style={{ color }}>
              <input autoFocus value={renameDraft}
                onChange={e => setRenameDraft(e.target.value)}
                onBlur={() => { renameFolderById(folder.id, renameDraft); setRenamingFolderId(null); }}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); renameFolderById(folder.id, renameDraft); setRenamingFolderId(null); }
                  if (e.key === "Escape") setRenamingFolderId(null);
                }}
                onClick={e => e.stopPropagation()}
                className="px-2 py-0.5 rounded border border-zinc-300 dark:border-zinc-600 outline-none text-sm"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              />
            </div>
          ) : (
            <button type="button"
              className={`book-link bookshelf-btn${asSubItem ? " sub-item" : ""}${isExpanded ? " active-category" : ""}`}
              style={{ color }}
              onClick={() => toggleFolderOpen(folder.id)}
            >
              📁 {folder.name}
            </button>
          )}
          {isOwner && setTree && folderCtxMenuId === folder.id && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setFolderCtxMenuId(null)} />
              <div className="fixed z-50 w-32 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{ left: folderCtxMenuPos.x, top: folderCtxMenuPos.y }}>
                <button type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={() => { setRenameDraft(folder.name); setRenamingFolderId(folder.id); setFolderCtxMenuId(null); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>改名</button>
                <button type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={(e) => { setFolderCtxMenuId(null); openMovePicker(e, "folder", folder.id, folder.name); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>移到資料夾</button>
                <button type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={() => { setAddingUnderFolderId(folder.id); setNewFolderName(""); setFolderCtxMenuId(null); setOpenFolderIds(prev => new Set(prev).add(folder.id)); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>新增子資料夾</button>
                <button type="button" onMouseDown={e => e.stopPropagation()}
                  onClick={() => { deleteFolderById(folder.id); setFolderCtxMenuId(null); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  刪除（保留內容）</button>
              </div>
            </>
          )}
        </div>
        {isExpanded && renderInlineChildren(folder.id)}
      </div>
    );
  };

  // Renders the children of a folder as flat siblings in the parent grid.
  // Caller should already be wrapped in a bookshelf-grid (or contents) container.
  const renderInlineChildren = (folderId: string | null): React.ReactNode => {
    const childLists = lists.filter(l => getListFolder(l.id) === folderId);
    const childCols = myCollections.filter(c => getCollectionFolder(c.id) === folderId);
    const childRefs = treeRefs.filter(r => (r.folderId ?? null) === folderId);
    const childFolders = (tree?.folders ?? [])
      .filter(f => (f.parentId ?? null) === folderId)
      .sort((a, b) => a.sort - b.sort);

    const isAddingChild = folderId !== null && addingUnderFolderId === folderId;

    return (
      <>
        {childLists.map((l, i) => renderListTile(l, i, true))}
        {childCols.map((c, i) => renderColTile(c, i, true))}
        {isOwner && childRefs.map((r, i) => renderRefTile(r, i, true))}
        {childFolders.map((f, i) => renderFolderTile(f, i, true))}
        {isAddingChild && (
          <input autoFocus value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="子資料夾名稱"
            onBlur={() => { createFolder(newFolderName, folderId); setAddingUnderFolderId(undefined); setNewFolderName(""); }}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); createFolder(newFolderName, folderId); setAddingUnderFolderId(undefined); setNewFolderName(""); }
              if (e.key === "Escape") { setAddingUnderFolderId(undefined); setNewFolderName(""); }
            }}
            className="book-link bookshelf-btn sub-item px-2 py-0.5 outline-none border border-zinc-300 dark:border-zinc-600"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
          />
        )}
      </>
    );
  };

  const renderTopLevel = (): React.ReactNode => {
    const topLists = lists.filter(l => getListFolder(l.id) === null);
    const topCols = myCollections.filter(c => getCollectionFolder(c.id) === null);
    const topRefs = treeRefs.filter(r => (r.folderId ?? null) === null);
    const topFolders = (tree?.folders ?? [])
      .filter(f => (f.parentId ?? null) === null)
      .sort((a, b) => a.sort - b.sort);
    const isAddingTop = addingUnderFolderId === null;

    return (
      <div className="bookshelf-grid">
        {topLists.map((l, i) => renderListTile(l, i))}
        {topCols.map((c, i) => renderColTile(c, i))}
        {isOwner && topRefs.map((r, i) => renderRefTile(r, i))}
        {topFolders.map((f, i) => renderFolderTile(f, i, false))}
        {isAddingTop && (
          <input autoFocus value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="資料夾名稱"
            onBlur={() => { createFolder(newFolderName, null); setAddingUnderFolderId(undefined); setNewFolderName(""); }}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); createFolder(newFolderName, null); setAddingUnderFolderId(undefined); setNewFolderName(""); }
              if (e.key === "Escape") { setAddingUnderFolderId(undefined); setNewFolderName(""); }
            }}
            className="book-link bookshelf-btn px-2 py-0.5 outline-none border border-zinc-300 dark:border-zinc-600"
            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
          />
        )}
        {isOwner && setTree && tree && addingUnderFolderId === undefined && (
          <button type="button"
            onClick={() => { setAddingUnderFolderId(null); setNewFolderName(""); }}
            className="book-link bookshelf-btn text-xs opacity-50 hover:opacity-80 transition-opacity"
            style={{ color: "var(--zen-ink)" }}
          >
            + 新增資料夾
          </button>
        )}
      </div>
    );
  };

  return (
    <>
      {renderTopLevel()}
      {movePicker && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setMovePicker(null)} />
          <div className="fixed z-50 max-w-xs max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: movePicker.x, top: movePicker.y, minWidth: "10rem" }}>
            <div className="px-3 py-2 text-xs opacity-50 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "var(--zen-ink)" }}>
              移動「{movePicker.name}」到…
            </div>
            {pickableFolders(movePicker.kind === "folder" ? movePicker.id : undefined).map(opt => (
              <button key={String(opt.id)} type="button"
                onMouseDown={e => e.stopPropagation()}
                onClick={() => { moveItemToFolder(movePicker.kind, movePicker.id, opt.id); setMovePicker(null); }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* questions panel */}
      {expandedId && (() => {
        const list = lists.find(l => l.id === expandedId);
        if (!list) return null;
        return (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-sm" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
              {list.questions.length > 0 && (
                <a href={`/test/list?listId=${list.id}&autostart=1`}
                  className="text-xs px-3 py-1 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}>
                  作答
                </a>
              )}
            </div>
            {list.questions.length === 0 ? (
              <p className="px-4 py-3 text-xs text-zinc-400">清單是空的</p>
            ) : (
              <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {list.questions.map((q: ListQuestion, i: number) => (
                  <li key={`${q.questionId}-${i}`} className="flex items-center gap-3 px-4 py-2">
                    <span className="text-xs text-zinc-400 w-6 shrink-0 text-right">{q.number}</span>
                    <span className="flex-1 text-sm" style={{ color: "var(--zen-ink)" }}>{q.title}</span>
                    <span className="text-xs text-zinc-400">{getCollectionLabel(q.collectionId, q.level)}</span>
                    {isOwner && (
                      <button type="button"
                        onClick={() => removeQuestion(list.id, q.questionId, q.collectionId)}
                        className="text-xs text-red-400 hover:text-red-500 transition-colors">
                        移除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* share panel */}
      {shareOpenId && (() => {
        const list = lists.find(l => l.id === shareOpenId);
        if (!list) return null;
        return (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-sm" style={{ color: "var(--zen-ink)" }}>{list.title}</span>
              <button type="button"
                onClick={() => { setShareOpenId(null); setShareInput(""); setShareError(null); setShareSearchResults([]); setShareSharedGroupIds(new Set()); }}
                className="text-xs opacity-40 hover:opacity-70" style={{ color: "var(--zen-ink)" }}>✕</button>
            </div>
            <div className="px-4 py-3">
              <input
                value={shareInput}
                onChange={e => handleShareSearch(e.target.value)}
                placeholder="搜尋帳號或群組名稱"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 outline-none mb-2"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              />
              {shareSearchLoading && <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>}
              {!shareSearchLoading && shareInput.trim() && shareSearchResults.length === 0 && (
                <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>找不到帳號或群組</p>
              )}
              {shareSearchResults.length > 0 && (
                <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-2">
                  {shareSearchResults.map(r => {
                    const alreadyShared = r.type === "user" && (list.sharedWith ?? []).includes(r.name);
                    const groupShared = r.type === "group" && shareSharedGroupIds.has(r.id);
                    return (
                      <div key={`${r.type}-${r.id}`} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                        <div className="flex items-center gap-2">
                          {r.type === "user" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatarUrl || AVATAR_PLACEHOLDER} className="w-6 h-6 rounded-full object-cover shrink-0" alt={r.name} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                          )}
                          <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{r.name}</span>
                          {r.type === "group" && r.memberCount != null && (
                            <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{r.memberCount} 人</span>
                          )}
                        </div>
                        {alreadyShared || groupShared ? (
                          <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                        ) : r.type === "user" ? (
                          <button
                            type="button"
                            onClick={async () => {
                              setShareLoading(true); setShareError(null);
                              const res = await fetch(`/api/lists/${list.id}/share`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ targetName: r.name }),
                              });
                              const j = await res.json();
                              if (res.ok) setLists(prev => prev.map(l => l.id === list.id ? { ...l, sharedWith: [...(l.sharedWith ?? []), r.name] } : l));
                              else setShareError(j.error ?? "失敗");
                              setShareLoading(false);
                            }}
                            disabled={shareLoading}
                            className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: "#5fa870", color: "#5fa870" }}
                          >分享</button>
                        ) : (
                          <button
                            type="button"
                            onClick={async () => {
                              const res = await fetch(`/api/groups/${r.id}/share-list`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ listId: list.id }),
                              });
                              const d = await res.json();
                              if (d.ok) setShareSharedGroupIds(prev => new Set(prev).add(r.id));
                              else setShareError(d.error ?? "分享失敗");
                            }}
                            className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80"
                            style={{ borderColor: "#b19739", color: "#b19739" }}
                          >分享</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* 我的群組 — 直接列出，不需搜尋 */}
              {(() => {
                const allGroups = [...ownedGroups, ...joinedGroups];
                if (allGroups.length === 0) return null;
                return (
                  <div className="mb-2">
                    <p className="text-xs opacity-50 mb-1.5" style={{ color: "var(--zen-ink)" }}>我的群組</p>
                    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      {allGroups.map(g => (
                        <div key={g.id} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                            <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{g.name}</span>
                            {g.memberCount != null && (
                              <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{g.memberCount} 人</span>
                            )}
                          </div>
                          {shareSharedGroupIds.has(g.id) ? (
                            <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                const res = await fetch(`/api/groups/${g.id}/share-list`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ listId: list.id }),
                                });
                                const d = await res.json();
                                if (d.ok) setShareSharedGroupIds(prev => new Set(prev).add(g.id));
                                else setShareError(d.error ?? "分享失敗");
                              }}
                              className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80"
                              style={{ borderColor: "#b19739", color: "#b19739" }}
                            >分享</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              {shareError && <p className="text-xs text-red-500 mb-2">{shareError}</p>}
              {(list.sharedWith ?? []).length > 0 && (
                <ul className="flex flex-col gap-2 mt-1">
                  {(list.sharedWith ?? []).map(n => {
                    const results = (list.sharedResults ?? {})[n] ?? [];
                    return (
                      <li key={n} className="text-xs" style={{ color: "var(--zen-ink)" }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{n}</span>
                          <button type="button" onClick={() => removeShare(list.id, n)}
                            className="text-red-400 hover:text-red-500 transition-colors">移除</button>
                        </div>
                        {results.length > 0 ? (
                          <ul className="mt-1 flex flex-col gap-0.5 pl-2 border-l border-zinc-200 dark:border-zinc-700">
                            {results.map((r: { correct: number; answered: number; timestamp: string }, i: number) => (
                              <li key={i} className="flex items-center gap-2 text-zinc-400">
                                <span>{r.correct}/{r.answered}</span>
                                <span>{new Date(r.timestamp).toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" })}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 pl-2 text-zinc-400">尚未作答</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        );
      })()}

      {/* collection share panel */}
      {colShareId && (() => {
        const col = myCollections.find(c => c.id === colShareId);
        if (!col) return null;
        const allGroups = [...ownedGroups, ...joinedGroups];
        return (
          <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="font-medium text-sm" style={{ color: "var(--zen-ink)" }}>分享「{col.displayName}」</span>
              <button type="button"
                onClick={() => { setColShareId(null); setShareInput(""); setShareSearchResults([]); setColShareSentIds(new Set()); }}
                className="text-xs opacity-40 hover:opacity-70" style={{ color: "var(--zen-ink)" }}>✕</button>
            </div>
            <div className="px-4 py-3">
              <input
                value={shareInput}
                onChange={e => handleShareSearch(e.target.value)}
                placeholder="搜尋帳號或群組名稱"
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-zinc-600 outline-none mb-2"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              />
              {shareSearchLoading && <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>}
              {!shareSearchLoading && shareInput.trim() && shareSearchResults.length === 0 && (
                <p className="text-xs opacity-40 mb-2" style={{ color: "var(--zen-ink)" }}>找不到帳號或群組</p>
              )}
              {shareSearchResults.length > 0 && (
                <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700 mb-2">
                  {shareSearchResults.map(r => {
                    const sent = colShareSentIds.has(r.id);
                    return (
                      <div key={`${r.type}-${r.id}`} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                        <div className="flex items-center gap-2">
                          {r.type === "user" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.avatarUrl || AVATAR_PLACEHOLDER} className="w-6 h-6 rounded-full object-cover shrink-0" alt={r.name} />
                          ) : (
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                          )}
                          <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{r.name}</span>
                          {r.type === "group" && r.memberCount != null && (
                            <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{r.memberCount} 人</span>
                          )}
                        </div>
                        {sent ? (
                          <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => shareCollectionTo(col, { type: r.type, id: r.id, name: r.name })}
                            disabled={colShareSending === r.id}
                            className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                            style={{ borderColor: r.type === "user" ? "#5fa870" : "#b19739", color: r.type === "user" ? "#5fa870" : "#b19739" }}
                          >
                            {colShareSending === r.id ? "..." : "分享"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {allGroups.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs opacity-50 mb-1.5" style={{ color: "var(--zen-ink)" }}>我的群組</p>
                  <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                    {allGroups.map(g => {
                      const sent = colShareSentIds.has(g.id);
                      return (
                        <div key={g.id} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs" style={{ backgroundColor: "color-mix(in srgb, #b19739 15%, transparent)", color: "#b19739" }}>群</div>
                            <span className="text-xs" style={{ color: "var(--zen-ink)" }}>{g.name}</span>
                            {g.memberCount != null && (
                              <span className="text-xs opacity-40" style={{ color: "var(--zen-ink)" }}>{g.memberCount} 人</span>
                            )}
                          </div>
                          {sent ? (
                            <span className="text-xs" style={{ color: "#5fa870" }}>已分享</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => shareCollectionTo(col, { type: "group", id: g.id, name: g.name })}
                              disabled={colShareSending === g.id}
                              className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80 disabled:opacity-30"
                              style={{ borderColor: "#b19739", color: "#b19739" }}
                            >
                              {colShareSending === g.id ? "..." : "分享"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}
