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
  language: string;
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
  activeLanguage?: string;
};

export function PersonalListsView({
  isOwner,
  loading,
  lists,
  myCollections,
  folders: publicFolders = [],
  activeLanguage = "zh-TW",
}: Props) {
  const { status: sessionStatus } = useSession();
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());
  const [folderError, setFolderError] = useState<string | null>(null);

  const [addingTopFolder, setAddingTopFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingFolderPublic, setEditingFolderPublic] = useState(false);

  const [listCtxMenuId, setListCtxMenuId] = useState<string | null>(null);
  const [listCtxMenuPos, setListCtxMenuPos] = useState({ x: 0, y: 0 });
  const [colCtxMenuId, setColCtxMenuId] = useState<string | null>(null);
  const [colCtxMenuPos, setColCtxMenuPos] = useState({ x: 0, y: 0 });
  const [folderCtxMenuId, setFolderCtxMenuId] = useState<string | null>(null);
  const [folderCtxMenuPos, setFolderCtxMenuPos] = useState({ x: 0, y: 0 });
  const [movePicker, setMovePicker] = useState<{ kind: "collection" | "folder" | "list"; id: string; name: string; x: number; y: number } | null>(null);
  const [collectionParentOverride, setCollectionParentOverride] = useState<Record<string, string | null>>({});
  const [listParentOverride, setListParentOverride] = useState<Record<string, string | null>>({});

  const contentLang = activeLanguage === "zh-CN" ? "zh-TW" : activeLanguage;
  const visibleLists = lists;
  const visibleCollections = myCollections.filter(
    (c) => c.approvalStatus !== "pending" && (c.language || "zh-TW") === contentLang
  );

  const applyFoldersResponse = (data: { folders?: unknown }) => {
    setFolders(Array.isArray(data.folders) ? (data.folders as UserFolder[]) : []);
  };

  const loadFolders = useCallback(async () => {
    setFolderError(null);
    try {
      const res = await fetch("/api/my-folders", { cache: "no-store" });
      const data: { folders?: unknown; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFolderError(data.error ?? `無法載入資料夾 (${res.status})`);
        setFolders([]);
        return;
      }
      applyFoldersResponse(data);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "無法載入資料夾");
      setFolders([]);
    } finally {
      setFoldersLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isOwner || publicFolders.length === 0) return;
    setFolders(publicFolders);
    setFoldersLoaded(true);
  }, [isOwner, publicFolders]);

  useEffect(() => {
    if (!isOwner || foldersLoaded || sessionStatus !== "authenticated" || publicFolders.length > 0) return;
    void loadFolders();
  }, [isOwner, foldersLoaded, sessionStatus, loadFolders, publicFolders.length]);

  useEffect(() => {
    if (isOwner) return;
    setFolders(publicFolders);
    setFolderError(null);
  }, [isOwner, publicFolders]);

  const patchFolder = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/my-folders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: { folders?: unknown; error?: string } = await res.json().catch(() => ({}));
    if (!res.ok) {
      setFolderError(data.error ?? `操作失敗 (${res.status})`);
      return false;
    }
    setFolderError(null);
    if (Array.isArray(data.folders)) applyFoldersResponse(data);
    else await loadFolders();
    return true;
  };

  const addFolder = async (name: string, parentId: string | null = null) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setAddingTopFolder(false);
      setNewFolderName("");
      return;
    }
    const ok = await patchFolder({ op: "addFolder", name: trimmed, parentId });
    if (ok) {
      setNewFolderName("");
      setAddingTopFolder(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    await patchFolder({ op: "deleteFolder", folderId });
  };

  const moveCollection = async (categoryId: string, folderId: string | null) => {
    const ok = await patchFolder({ op: "moveCollection", categoryId, folderId });
    if (ok) setCollectionParentOverride((prev) => ({ ...prev, [categoryId]: folderId }));
  };

  const moveList = async (listId: string, folderId: string | null) => {
    const ok = await patchFolder({ op: "moveList", listId, folderId });
    if (ok) setListParentOverride((prev) => ({ ...prev, [listId]: folderId }));
  };

  const saveFolderEdits = async (folderId: string, name: string, isPublic: boolean) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = folders.find((f) => f.id === folderId);
    if (existing && trimmed !== existing.name) {
      const ok = await patchFolder({ op: "renameFolder", folderId, name: trimmed });
      if (!ok) return;
    }
    if (existing && isPublic !== existing.isPublic) {
      const ok = await patchFolder({ op: "updateFolderPublic", folderId, isPublic });
      if (!ok) return;
    }
    setEditingFolderId(null);
    setEditingFolderName("");
    setEditingFolderPublic(false);
  };

  const moveFolder = async (folderId: string, parentId: string | null) => {
    await patchFolder({ op: "moveFolder", folderId, parentId });
  };

  const toggleFolderOpen = (id: string) => {
    const pathToFolder = (folderId: string): string[] => {
      const path: string[] = [];
      const seen = new Set<string>();
      let cur: string | null = folderId;
      while (cur) {
        if (seen.has(cur)) break;
        seen.add(cur);
        path.unshift(cur);
        cur = folders.find((f) => f.id === cur)?.parentId ?? null;
      }
      return path;
    };

    setOpenFolderIds((prev) => {
      const path = pathToFolder(id);
      if (path.length === 0) return new Set();
      if (prev.has(id)) return new Set(path.slice(0, -1));
      return new Set(path);
    });
  };

  const collectionParent = (c: MyCollection): string | null => {
    return Object.prototype.hasOwnProperty.call(collectionParentOverride, c.id)
      ? collectionParentOverride[c.id]
      : (c.parentId ?? null);
  };
  const listParent = (l: DisplayList): string | null => {
    return Object.prototype.hasOwnProperty.call(listParentOverride, l.id)
      ? listParentOverride[l.id]
      : (l.parentId ?? null);
  };

  const collectionsUnder = (folderId: string | null) =>
    visibleCollections.filter((c) => collectionParent(c) === folderId);
  const foldersUnder = (folderId: string | null) =>
    folders.filter((f) => (f.parentId ?? null) === folderId);
  const listsUnder = (folderId: string | null) =>
    visibleLists.filter((l) => listParent(l) === folderId);

  const folderHasVisibleContent = (folderId: string | null): boolean => {
    if (collectionsUnder(folderId).length > 0) return true;
    return foldersUnder(folderId).some((f) => folderHasVisibleContent(f.id));
  };

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

  const renderListItem = (list: DisplayList, inChain: boolean = false): React.ReactNode => (
    <div key={list.id} className="relative">
      <a
        href={`/test/list?listId=${list.id}&autostart=1`}
        className="book-link bookshelf-btn"
        style={{ color: "#D1D5DB" }}
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
            className="fixed z-50 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg overflow-hidden"
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
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                setListCtxMenuId(null);
                setMovePicker({ kind: "list", id: list.id, name: list.title, x: e.clientX, y: e.clientY });
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
  );

  const renderCollectionItem = (col: MyCollection, inChain: boolean = false): React.ReactNode => (
    <div key={`my-${col.id}`} className="relative">
      <a
        href={appendHrefOptions(`/test/${encodeURIComponent(col.collectionId)}?autostart=1`, col.problemsPerTest, col.shuffleProblems)}
        className="book-link bookshelf-btn"
        style={{ color: "#D1D5DB" }}
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
  );

  const renderFolder = (folder: UserFolder, ancestorExpanded: boolean = false): React.ReactNode => {
    const isOpen = openFolderIds.has(folder.id);
    const isHighlighted = ancestorExpanded || isOpen;
    const isEditing = editingFolderId === folder.id;
    const childFolders = foldersUnder(folder.id).filter((f) => folderHasVisibleContent(f.id));
    const childCollections = collectionsUnder(folder.id);
    const childLists = listsUnder(folder.id);

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
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${editingFolderPublic
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
                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${!editingFolderPublic
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
              style={{ color: "#D1D5DB" }}
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

        {isOpen && childCollections.map((col) => renderCollectionItem(col, true))}
        {isOpen && childLists.map((list) => renderListItem(list, true))}
        {isOpen && childFolders.map((child) => renderFolder(child, true))}
      </div>
    );
  };

  const topFolders = foldersUnder(null).filter((f) => folderHasVisibleContent(f.id));
  const topLists = listsUnder(null);
  const topCollections = collectionsUnder(null);

  const isEmpty = visibleLists.length === 0 && visibleCollections.length === 0 && topFolders.length === 0;

  if (!isOwner && isEmpty && !loading) {
    return <p className="text-sm zen-subtle opacity-50">尚無公開試卷</p>;
  }

  return (
    <div className="bookshelf-grid">
      {loading && (
        <p className="text-sm zen-subtle col-span-full">載入中...</p>
      )}
      {!loading && isEmpty && isOwner && (
        <p className="text-sm zen-subtle opacity-50 col-span-full">
          尚無試卷，在題目頁按 + 新增，或先建立資料夾
        </p>
      )}
      {folderError && (
        <p className="text-sm text-red-600 dark:text-red-400 col-span-full">{folderError}</p>
      )}

      {topLists.map((list) => renderListItem(list))}
      {topCollections.map((col) => renderCollectionItem(col))}
      {topFolders.map((folder) => renderFolder(folder))}

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
                  } else if (movePicker.kind === "list") {
                    await moveList(movePicker.id, opt.id);
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
