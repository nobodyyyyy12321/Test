"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { QuestionList } from "../../lib/lists-supabase";

export type MyCollection = {
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
};

export type UserFolder = {
  id: string;
  name: string;
  parentId: string | null;
  isPublic: boolean;
};

type DisplayList = QuestionList & { parentId?: string | null };

type Props = {
  isOwner: boolean;
  loading: boolean;
  lists: DisplayList[];
  setLists: React.Dispatch<React.SetStateAction<QuestionList[]>>;
  myCollections: MyCollection[];
  folders?: UserFolder[];
  pinnedListIds: string[];
  setPinnedListIds: React.Dispatch<React.SetStateAction<string[]>>;
  pinnedCollectionIds: string[];
  setPinnedCollectionIds: React.Dispatch<React.SetStateAction<string[]>>;
};

export function PersonalListsView({
  isOwner,
  loading,
  lists,
  myCollections,
  folders: publicFolders = [],
}: Props) {
  const { status: sessionStatus } = useSession();
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [addingTopFolder, setAddingTopFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFolderPublic, setEditingFolderPublic] = useState(false);
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [listCtxMenuId, setListCtxMenuId] = useState<string | null>(null);
  const [listCtxMenuPos, setListCtxMenuPos] = useState({ x: 0, y: 0 });
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });
  const [folderCtxMenuId, setFolderCtxMenuId] = useState<string | null>(null);
  const [folderCtxMenuPos, setFolderCtxMenuPos] = useState({ x: 0, y: 0 });
  const [movePicker, setMovePicker] = useState<{ kind: "collection" | "folder"; id: string; name: string; x: number; y: number } | null>(null);
  const [collectionParentOverride, setCollectionParentOverride] = useState<Record<string, string | null>>({});
  const [folderError, setFolderError] = useState<string | null>(null);

  const visibleLists = lists;
  const visibleCollections = myCollections.filter((c) => c.approvalStatus !== "pending");

  const applyFoldersResponse = (data: { folders?: unknown }) => {
    setFolders(Array.isArray(data.folders) ? (data.folders as UserFolder[]) : []);
  };

  const loadFolders = useCallback(async () => {
    if (!isOwner) return;
    try {
      const res = await fetch("/api/my-collections?foldersOnly=1", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as {
        folders?: unknown;
        error?: string;
        warning?: string;
        storageReady?: boolean;
      };
      if (!res.ok) {
        setFolderError(data.error ?? `無法載入資料夾 (${res.status})`);
        setFolders([]);
        return;
      }
      if (data.storageReady === false && data.warning) {
        setFolderError(data.warning);
      } else {
        setFolderError(null);
      }
      applyFoldersResponse(data);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "無法載入資料夾");
      setFolders([]);
    } finally {
      setFoldersLoaded(true);
    }
  }, [isOwner]);

  useEffect(() => {
    if (!isOwner || foldersLoaded || sessionStatus === "loading") return;
    if (sessionStatus === "unauthenticated") {
      setFoldersLoaded(true);
      return;
    }
    void loadFolders();
  }, [isOwner, foldersLoaded, sessionStatus, loadFolders]);

  useEffect(() => {
    if (isOwner) return;
    setFolders(publicFolders);
    setFolderError(null);
    setFoldersLoaded(true);
  }, [isOwner, publicFolders]);

  const addFolder = async (name: string, parentId: string | null = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/my-collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "addFolder", name: trimmed, parentId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setFolderError(null);
      setNewFolderName("");
      setAddingTopFolder(false);
      if (Array.isArray(data.folders)) {
        applyFoldersResponse(data);
      } else {
        await loadFolders();
      }
    } else {
      setFolderError(typeof data.error === "string" ? data.error : "無法建立資料夾");
    }
  };

  const deleteFolder = async (folderId: string) => {
    const res = await fetch("/api/my-collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "deleteFolder", folderId }),
    });
    if (res.ok) {
      await loadFolders();
    }
  };

  const moveCollection = async (categoryId: string, folderId: string | null) => {
    const res = await fetch("/api/my-collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "moveCollection", categoryId, folderId }),
    });
    if (res.ok) {
      setCollectionParentOverride((prev) => ({ ...prev, [categoryId]: folderId }));
    }
  };

  const saveFolderEdits = async (folderId: string, name: string, isPublic: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    
    // Update name if changed
    if (trimmed !== (folders.find(f => f.id === folderId)?.name ?? "")) {
      const res = await fetch("/api/my-collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "renameFolder", folderId, name: trimmed }),
      });
      if (!res.ok) return;
    }

    // Update public status if changed
    const folder = folders.find(f => f.id === folderId);
    if (folder && isPublic !== folder.isPublic) {
      const res = await fetch("/api/my-collections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "updateFolderPublic", folderId, isPublic }),
      });
      if (!res.ok) return;
    }

    setEditingFolderId(null);
    await loadFolders();
  };

  const moveFolder = async (folderId: string, parentId: string | null) => {
    const res = await fetch("/api/my-collections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "moveFolder", folderId, parentId }),
    });
    if (res.ok) {
      await loadFolders();
    }
  };

  const toggleFolderOpen = (id: string) => {
    const getPathToFolder = (folderId: string): string[] => {
      const path: string[] = [];
      const visited = new Set<string>();
      let currentId: string | null = folderId;
      while (currentId) {
        if (visited.has(currentId)) break;
        visited.add(currentId);
        path.unshift(currentId);
        const current = folders.find((f) => f.id === currentId);
        currentId = current?.parentId ?? null;
      }
      return path;
    };

    setOpenFolderIds((prev) => {
      const path = getPathToFolder(id);
      if (path.length === 0) return new Set();
      if (prev.has(id)) {
        return new Set(path.slice(0, -1));
      }
      return new Set(path);
    });
  };

  const collectionsUnder = (folderId: string | null) =>
    visibleCollections.filter((c) => {
      const currentParent = Object.prototype.hasOwnProperty.call(collectionParentOverride, c.id)
        ? collectionParentOverride[c.id]
        : (c.parentId ?? null);
      return currentParent === folderId;
    });

  const foldersUnder = (folderId: string | null) =>
    folders.filter((f) => (f.parentId ?? null) === folderId);

  const listsUnder = (folderId: string | null) =>
    visibleLists.filter((list) => (list.parentId ?? null) === folderId);

  const appendHrefOptions = (href?: string | null, problemsPerTest?: number | null, shuffleProblems?: boolean | null): string => {
    const base = href || "#";
    if (base === "#") return base;
    const extra: string[] = [];
    if (problemsPerTest != null) extra.push(`count=${encodeURIComponent(problemsPerTest)}`);
    if (shuffleProblems === false) extra.push("ordered=true");
    if (extra.length === 0) return base;
    return base + (base.includes("?") ? "&" : "?") + extra.join("&");
  };

  const pickableFolders = (excludeFolderId?: string): { id: string | null; label: string }[] => {
    const exclude = new Set<string>();
    if (excludeFolderId) {
      const collect = (fid: string) => {
        exclude.add(fid);
        for (const f of folders) {
          if (f.parentId === fid && !exclude.has(f.id)) collect(f.id);
        }
      };
      collect(excludeFolderId);
    }

    const labelOf = (id: string): string => {
      const f = folders.find((x) => x.id === id);
      if (!f) return "";
      return f.parentId ? `${labelOf(f.parentId)} / ${f.name}` : f.name;
    };

    return [
      { id: null, label: "根目錄" },
      ...folders
        .filter((f) => !exclude.has(f.id))
        .map((f) => ({ id: f.id, label: labelOf(f.id) })),
    ];
  };

  const renderListItem = (list: DisplayList, depth: number = 0): React.ReactNode => {
    return (
      <div key={list.id} className="relative">
        <a
          href={`/test/list?listId=${list.id}&autostart=1`}
          className={`book-link bookshelf-btn ${depth > 0 ? "sub-item" : ""}`.trim()}
          style={{ color: "#6ea8d8" }}
          onContextMenu={(e) => {
            if (!isOwner) return;
            e.preventDefault();
            setListCtxMenuId(list.id);
            setListCtxMenuPos({ x: e.clientX, y: e.clientY });
            setColCtxMenuId(null);
            setFolderCtxMenuId(null);
          }}
        >
          {list.title}
        </a>
        {isOwner && listCtxMenuId === list.id && (
          <>
            <div className="fixed inset-0 z-40" onMouseDown={() => setListCtxMenuId(null)} />
            <div
              className="fixed z-50 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
              style={{ left: listCtxMenuPos.x, top: listCtxMenuPos.y }}
            >
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setListCtxMenuId(null);
                  window.location.href = `/lists/${list.id}/edit`;
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                蝺刻摩
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderFolder = (folder: UserFolder, depth: number, ancestorExpanded: boolean = false): React.ReactNode => {
    const isOpen = openFolderIds.has(folder.id);
    const isHighlighted = ancestorExpanded || isOpen;
    const childFolders = foldersUnder(folder.id);
    const childCollections = collectionsUnder(folder.id);
    const childLists = listsUnder(folder.id);
    const isEditing = editingFolderId === folder.id;
    return (
      <div key={folder.id} className="contents">
        {isEditing ? (
          <div
            className="relative px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600"
            style={{ backgroundColor: "var(--zen-bg)" }}
          >
            <input
              autoFocus
              value={editingFolderName}
              onChange={(e) => setEditingFolderName(e.target.value)}
              placeholder="資料夾名稱"
              className="w-full px-2 py-1 mb-2 text-sm outline-none border border-zinc-300 dark:border-zinc-600 rounded"
              style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveFolderEdits(folder.id, editingFolderName, editingFolderPublic);
                }
                if (e.key === "Escape") {
                  setEditingFolderId(null);
                  setEditingFolderName("");
                  setEditingFolderPublic(false);
                }
              }}
            />
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setEditingFolderPublic(true)}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  editingFolderPublic
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
                style={editingFolderPublic ? {} : { color: "var(--zen-ink)" }}
              >
                設為公開
              </button>
              <button
                type="button"
                onClick={() => setEditingFolderPublic(false)}
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${
                  !editingFolderPublic
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
                style={!editingFolderPublic ? {} : { color: "var(--zen-ink)" }}
              >
                設為私人
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveFolderEdits(folder.id, editingFolderName, editingFolderPublic)}
                className="flex-1 px-2 py-1 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", border: "1px solid var(--zen-border)" }}
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingFolderId(null);
                  setEditingFolderName("");
                  setEditingFolderPublic(false);
                }}
                className="flex-1 px-2 py-1 text-xs rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", border: "1px solid var(--zen-border)" }}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <button
              type="button"
              className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
              style={{ color: isHighlighted ? "#b19739" : "#5fa870" }}
              onClick={() => toggleFolderOpen(folder.id)}
              onContextMenu={(e) => {
                if (!isOwner) return;
                e.preventDefault();
                setFolderCtxMenuId(folder.id);
                setFolderCtxMenuPos({ x: e.clientX, y: e.clientY });
                setColCtxMenuId(null);
                setListCtxMenuId(null);
              }}
            >
              📁 {folder.name}
            </button>
            {isOwner && folderCtxMenuId === folder.id && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setFolderCtxMenuId(null)} />
                <div
                  className="fixed z-50 w-44 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                  style={{ left: folderCtxMenuPos.x, top: folderCtxMenuPos.y }}
                >
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setEditingFolderName(folder.name);
                      setEditingFolderPublic(folder.isPublic);
                      setEditingFolderId(folder.id);
                      setFolderCtxMenuId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      setFolderCtxMenuId(null);
                      setMovePicker({ kind: "folder", id: folder.id, name: folder.name, x: e.clientX, y: e.clientY });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    移到資料夾
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      void deleteFolder(folder.id);
                      setFolderCtxMenuId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    刪除（保留內容）
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {isOpen && childCollections.map((col) => (
          <div key={`my-${col.id}`} className="relative">
            <a
              href={appendHrefOptions(`/test/${encodeURIComponent(col.collectionId)}?autostart=1`, col.problemsPerTest, col.shuffleProblems)}
              className="book-link bookshelf-btn sub-item"
              style={{ color: "#b19739" }}
              onContextMenu={(e) => {
                if (!isOwner) return;
                e.preventDefault();
                setColCtxMenuId(col.id);
                setColCtxMenuPos({ x: e.clientX, y: e.clientY });
                setFolderCtxMenuId(null);
                setListCtxMenuId(null);
              }}
            >
              {col.displayName}
            </a>
            {isOwner && colCtxMenuId === col.id && (
              <>
                <div className="fixed inset-0 z-40" onMouseDown={() => setColCtxMenuId(null)} />
                <div
                  className="fixed z-50 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                  style={{ left: colCtxMenuPos.x, top: colCtxMenuPos.y }}
                >
                  {!col.fromGrid && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => {
                        setColCtxMenuId(null);
                        window.location.href = `/collections/${encodeURIComponent(col.collectionId)}/edit`;
                      }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                      style={{ color: "var(--zen-ink)" }}
                    >
                      編輯
                    </button>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      setColCtxMenuId(null);
                      setMovePicker({ kind: "collection", id: col.id, name: col.displayName, x: e.clientX, y: e.clientY });
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    移到資料夾
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {isOpen && childLists.map((list) => renderListItem(list, depth + 1))}

        {isOpen && childFolders.map((child) => renderFolder(child, depth + 1, isHighlighted))}
      </div>
    );
  };

  if (loading) return <p className="text-sm zen-subtle">載入中...</p>;

  const topFolders = foldersUnder(null);
  const topLists = listsUnder(null);
  const topCollections = collectionsUnder(null);

  const isEmpty = visibleLists.length === 0 && topCollections.length === 0 && topFolders.length === 0;

  if (!isOwner && isEmpty) {
    return <p className="text-sm zen-subtle opacity-50">尚無公開試卷</p>;
  }

  return (
    <div className="bookshelf-grid">
      {isEmpty && isOwner && (
        <p className="text-sm zen-subtle opacity-50 col-span-full">
          尚無試卷，在題目頁按 + 新增，或先建立資料夾
        </p>
      )}
      {folderError && (
        <p className="text-sm text-red-600 dark:text-red-400 col-span-full">{folderError}</p>
      )}
      {topLists.map((list) => (
        <div key={list.id} className="relative">
          <a
            href={`/test/list?listId=${list.id}&autostart=1`}
            className="book-link bookshelf-btn"
            style={{ color: "#6ea8d8" }}
            onContextMenu={(e) => {
              if (!isOwner) return;
              e.preventDefault();
              setListCtxMenuId(list.id);
              setListCtxMenuPos({ x: e.clientX, y: e.clientY });
              setColCtxMenuId(null);
              setFolderCtxMenuId(null);
            }}
          >
            {list.title}
          </a>
          {isOwner && listCtxMenuId === list.id && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setListCtxMenuId(null)} />
              <div
                className="fixed z-50 w-36 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{ left: listCtxMenuPos.x, top: listCtxMenuPos.y }}
              >
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setListCtxMenuId(null);
                    window.location.href = `/lists/${list.id}/edit`;
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}
                >
                  編輯
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {topCollections.map((col) => (
        <div key={`my-${col.id}`} className="relative">
          <a
            href={appendHrefOptions(`/test/${encodeURIComponent(col.collectionId)}?autostart=1`, col.problemsPerTest, col.shuffleProblems)}
            className="book-link bookshelf-btn"
            style={{ color: "#5fa870" }}
            onContextMenu={(e) => {
              if (!isOwner) return;
              e.preventDefault();
              setColCtxMenuId(col.id);
              setColCtxMenuPos({ x: e.clientX, y: e.clientY });
              setFolderCtxMenuId(null);
              setListCtxMenuId(null);
            }}
          >
            {col.displayName}
          </a>
          {isOwner && colCtxMenuId === col.id && (
            <>
              <div className="fixed inset-0 z-40" onMouseDown={() => setColCtxMenuId(null)} />
              <div
                className="fixed z-50 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
                style={{ left: colCtxMenuPos.x, top: colCtxMenuPos.y }}
              >
                {!col.fromGrid && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      setColCtxMenuId(null);
                      window.location.href = `/collections/${encodeURIComponent(col.collectionId)}/edit`;
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    編輯
                  </button>
                )}
                <button
                  type="button"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    setColCtxMenuId(null);
                    setMovePicker({ kind: "collection", id: col.id, name: col.displayName, x: e.clientX, y: e.clientY });
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  style={{ color: "var(--zen-ink)" }}
                >
                  移到資料夾
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {topFolders.map((folder) => renderFolder(folder, 0))}

      {isOwner && !addingTopFolder && (
        <button
          type="button"
          onClick={() => setAddingTopFolder(true)}
          className="book-link bookshelf-btn text-xs opacity-60 hover:opacity-90"
          style={{ color: "var(--zen-ink)" }}
        >
          + 新增資料夾
        </button>
      )}

      {isOwner && addingTopFolder && (
        <input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="資料夾名稱"
          onBlur={() => void addFolder(newFolderName, null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void addFolder(newFolderName, null);
            }
            if (e.key === "Escape") {
              setAddingTopFolder(false);
              setNewFolderName("");
            }
          }}
          className="book-link bookshelf-btn px-2 py-0.5 outline-none border border-zinc-300 dark:border-zinc-600"
          style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
        />
      )}

      {movePicker && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setMovePicker(null)} />
          <div
            className="fixed z-50 max-w-xs max-h-[60vh] overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
            style={{ left: movePicker.x, top: movePicker.y, minWidth: "10rem" }}
          >
            <div className="px-3 py-2 text-xs opacity-50 border-b border-zinc-100 dark:border-zinc-800" style={{ color: "var(--zen-ink)" }}>
              移動「{movePicker.name}」到…
            </div>
            {pickableFolders(movePicker.kind === "folder" ? movePicker.id : undefined).map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async () => {
                  if (movePicker.kind === "collection") {
                    await moveCollection(movePicker.id, opt.id);
                  } else {
                    await moveFolder(movePicker.id, opt.id);
                  }
                  setMovePicker(null);
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
