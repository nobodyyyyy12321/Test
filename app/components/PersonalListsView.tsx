"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import type { QuestionList } from "../../lib/lists-supabase";
import NextImage from "next/image";
import { AVATAR_PLACEHOLDER } from "../../app/lib/asset-version";
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

type DragKind = "list" | "collection" | "folder";
type DragData = { kind: DragKind; id: string; name: string };

function DraggableItem({ kind, id, name, children }: { kind: DragKind; id: string; name: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${kind}:${id}`,
    data: { kind, id, name } satisfies DragData,
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

function DroppableArea({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{
        outline: isOver ? "2px dashed var(--zen-accent)" : "2px dashed transparent",
        outlineOffset: 2,
        borderRadius: 8,
        transition: "outline-color 0.12s ease",
      }}
    >
      {children}
    </div>
  );
}

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
  isPublic?: boolean;
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
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
  );

  // ── assignment creation ──
  type AssignUser = { id: string; name: string; avatarUrl?: string };
  type AssignGroup = { id: string; name: string; memberCount?: number };
  const [assignModal, setAssignModal] = useState<{ sourceResourceId: string; sourceResourceType: "qset" | "list"; displayName: string } | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignSearchResults, setAssignSearchResults] = useState<AssignUser[]>([]);
  const [assignSearchLoading, setAssignSearchLoading] = useState(false);
  const [assignSearchTimer, setAssignSearchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [selectedAssignees, setSelectedAssignees] = useState<AssignUser[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<AssignGroup[]>([]);
  const [availableGroups, setAvailableGroups] = useState<AssignGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [assignStart, setAssignStart] = useState("");
  const [assignEnd, setAssignEnd] = useState("");
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignResultMsg, setAssignResultMsg] = useState<string | null>(null);
  const [collectionParentOverride, setCollectionParentOverride] = useState<Record<string, string | null>>({});
  const [listParentOverride, setListParentOverride] = useState<Record<string, string | null>>({});

  const visibleLists = lists;
  const visibleCollections = myCollections.filter((c) => c.approvalStatus !== "pending");

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

  const isDescendantFolder = (folderId: string, candidateAncestorId: string): boolean => {
    let cur: string | null = folderId;
    const seen = new Set<string>();
    while (cur) {
      if (cur === candidateAncestorId) return true;
      if (seen.has(cur)) return false;
      seen.add(cur);
      cur = folders.find((f) => f.id === cur)?.parentId ?? null;
    }
    return false;
  };

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current as DragData | undefined;
    if (data) setActiveDrag(data);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDrag(null);
    const data = e.active.data.current as DragData | undefined;
    const overId = e.over?.id;
    if (!data || overId == null) return;
    const target = String(overId);
    const targetFolderId: string | null = target === "root" ? null : target.startsWith("folder:") ? target.slice("folder:".length) : null;
    if (target !== "root" && targetFolderId === null) return;

    // dropping onto the same parent → no-op
    if (data.kind === "list") {
      const cur = listParent(visibleLists.find((l) => l.id === data.id) as DisplayList) ?? null;
      if (cur === targetFolderId) return;
      void moveList(data.id, targetFolderId);
    } else if (data.kind === "collection") {
      const c = visibleCollections.find((x) => x.id === data.id);
      if (!c) return;
      const cur = collectionParent(c) ?? null;
      if (cur === targetFolderId) return;
      void moveCollection(data.id, targetFolderId);
    } else if (data.kind === "folder") {
      if (targetFolderId === data.id) return;
      if (targetFolderId && isDescendantFolder(targetFolderId, data.id)) return; // cycle
      const cur = folders.find((f) => f.id === data.id)?.parentId ?? null;
      if (cur === targetFolderId) return;
      void moveFolder(data.id, targetFolderId);
    }
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

  const appendHrefOptions = (href?: string | null, problemsPerTest?: number | null, shuffleProblems?: boolean | null): string => {
    const base = href || "#";
    if (base === "#") return base;
    const extra: string[] = [];
    if (problemsPerTest != null) extra.push(`count=${encodeURIComponent(problemsPerTest)}`);
    if (shuffleProblems === false) extra.push("ordered=true");
    if (extra.length === 0) return base;
    return base + (base.includes("?") ? "&" : "?") + extra.join("&");
  };

  const renderListItem = (list: DisplayList, inChain: boolean = false): React.ReactNode => {
    const inner = (
      <a
        href={`/test/list?listId=${list.id}&autostart=1`}
        className="book-link bookshelf-btn"
        style={{ color: inChain ? "#b19739" : "var(--zen-ink)" }}
        draggable={false}
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
    );
    return (
    <div key={list.id} className="relative">
      {isOwner ? <DraggableItem kind="list" id={list.id} name={list.title}>{inner}</DraggableItem> : inner}
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
            {!list.isPublic && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setListCtxMenuId(null);
                  const now = new Date();
                  const startLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  const endLocal = new Date(now.getTime() + 3600000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setAssignSearch("");
                  setAssignSearchResults([]);
                  setSelectedAssignees([]);
                  setSelectedGroups([]);
                  setAssignStart(startLocal);
                  setAssignEnd(endLocal);
                  setAssignError(null);
                  setAssignResultMsg(null);
                  setAssignModal({ sourceResourceId: list.id, sourceResourceType: "list", displayName: list.title });
                  setGroupsLoading(true);
                  fetch("/api/groups")
                    .then(r => r.ok ? r.json() : { owned: [], joined: [] })
                    .then((data: { owned?: AssignGroup[]; joined?: AssignGroup[] }) => {
                      const all = [...(data.owned ?? []), ...(data.joined ?? [])];
                      const seen = new Set<string>();
                      const deduped = all.filter(g => !seen.has(g.id) && seen.add(g.id));
                      setAvailableGroups(deduped);
                    })
                    .catch(() => setAvailableGroups([]))
                    .finally(() => setGroupsLoading(false));
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                指派
              </button>
            )}
          </div>
        </>
      )}
    </div>
    );
  };

  const renderCollectionItem = (col: MyCollection, inChain: boolean = false): React.ReactNode => {
    const inner = (
      <a
        href={appendHrefOptions(`/test/${encodeURIComponent(col.collectionId)}?autostart=1`, col.problemsPerTest, col.shuffleProblems)}
        className="book-link bookshelf-btn"
        style={{ color: inChain ? "#b19739" : "var(--zen-ink)" }}
        draggable={false}
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
    );
    return (
    <div key={`my-${col.id}`} className="relative">
      {isOwner ? <DraggableItem kind="collection" id={col.id} name={col.displayName}>{inner}</DraggableItem> : inner}
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
            {!col.isPublic && (
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setColCtxMenuId(null);
                  const now = new Date();
                  const startLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  const endLocal = new Date(now.getTime() + 3600000 - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setAssignSearch("");
                  setAssignSearchResults([]);
                  setSelectedAssignees([]);
                  setSelectedGroups([]);
                  setAssignStart(startLocal);
                  setAssignEnd(endLocal);
                  setAssignError(null);
                  setAssignResultMsg(null);
                  setAssignModal({ sourceResourceId: col.collectionId, sourceResourceType: "qset", displayName: col.displayName });
                  // Lazy-load groups for the picker
                  setGroupsLoading(true);
                  fetch("/api/groups")
                    .then(r => r.ok ? r.json() : { owned: [], joined: [] })
                    .then((data: { owned?: AssignGroup[]; joined?: AssignGroup[] }) => {
                      const all = [...(data.owned ?? []), ...(data.joined ?? [])];
                      const seen = new Set<string>();
                      const deduped = all.filter(g => !seen.has(g.id) && seen.add(g.id));
                      setAvailableGroups(deduped);
                    })
                    .catch(() => setAvailableGroups([]))
                    .finally(() => setGroupsLoading(false));
                }}
                className="w-full text-left px-3 py-2 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: "var(--zen-ink)" }}
              >
                指派
              </button>
            )}
          </div>
        </>
      )}
    </div>
    );
  };

  const renderFolder = (folder: UserFolder, ancestorExpanded: boolean = false): React.ReactNode => {
    const isOpen = openFolderIds.has(folder.id);
    const isHighlighted = ancestorExpanded || isOpen;
    const isEditing = editingFolderId === folder.id;
    const childFolders = foldersUnder(folder.id);
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
            {(() => {
              const btn = (
                <button
                  type="button"
                  className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
                  style={{ color: isHighlighted ? "#b19739" : "var(--zen-ink)" }}
                  onClick={() => toggleFolderOpen(folder.id)}
                  draggable={false}
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
              );
              if (!isOwner) return btn;
              return (
                <DroppableArea id={`folder:${folder.id}`}>
                  <DraggableItem kind="folder" id={folder.id} name={folder.name}>{btn}</DraggableItem>
                </DroppableArea>
              );
            })()}
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

  const topFolders = foldersUnder(null);
  const topLists = listsUnder(null);
  const topCollections = collectionsUnder(null);

  const isEmpty = visibleLists.length === 0 && topCollections.length === 0 && topFolders.length === 0;

  if (!isOwner && isEmpty && !loading) {
    return <p className="text-sm zen-subtle opacity-50">尚無公開試卷</p>;
  }

  const RootDropWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: "root" });
    return (
      <div
        ref={setNodeRef}
        className="bookshelf-grid"
        style={{
          outline: isOver && activeDrag ? "2px dashed var(--zen-accent)" : "2px dashed transparent",
          outlineOffset: 4,
          borderRadius: 8,
          transition: "outline-color 0.12s ease",
        }}
      >
        {children}
      </div>
    );
  };

  const gridContent = (
    <>
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

      {/* ── assignment creation modal ── */}
      {assignModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onMouseDown={() => setAssignModal(null)} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl border shadow-xl p-6 flex flex-col gap-5"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold" style={{ color: "var(--zen-ink)" }}>建立指派</h3>
              <button onClick={() => setAssignModal(null)} className="w-7 h-7 flex items-center justify-center rounded-full opacity-40 hover:opacity-70 text-sm" style={{ color: "var(--zen-ink)" }}>✕</button>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold" style={{ color: "#b19739" }}>{assignModal.displayName}</p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>指派對象</label>

              {/* selected lines (one per row) */}
              {(selectedAssignees.length > 0 || selectedGroups.length > 0) && (
                <div className="flex flex-col gap-1">
                  {selectedAssignees.map(u => (
                    <div key={`u:${u.id}`} className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={24} height={24} unoptimized className="w-6 h-6 rounded-full object-cover shrink-0" />
                        <span className="text-sm truncate" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                      </div>
                      <button type="button" onClick={() => setSelectedAssignees(prev => prev.filter(p => p.id !== u.id))} className="text-xs opacity-40 hover:opacity-70 shrink-0" style={{ color: "var(--zen-ink)" }} aria-label="移除">移除</button>
                    </div>
                  ))}
                  {selectedGroups.map(g => (
                    <div key={`g:${g.id}`} className="flex items-center justify-between px-3 py-2 rounded-xl border" style={{ borderColor: "color-mix(in srgb, #b19739 50%, transparent)" }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span aria-hidden className="w-6 h-6 flex items-center justify-center rounded-full text-xs shrink-0" style={{ backgroundColor: "color-mix(in srgb, #b19739 20%, transparent)", color: "#b19739" }}>👥</span>
                        <span className="text-sm truncate" style={{ color: "#b19739" }}>
                          {g.name}{g.memberCount != null && ` (${g.memberCount} 人)`}
                        </span>
                      </div>
                      <button type="button" onClick={() => setSelectedGroups(prev => prev.filter(p => p.id !== g.id))} className="text-xs opacity-60 hover:opacity-100 shrink-0" style={{ color: "#b19739" }} aria-label="移除">移除</button>
                    </div>
                  ))}
                </div>
              )}

              {/* combined search: users (remote) + groups (local filter) */}
              <div className="flex flex-col gap-1">
                <input
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  placeholder="輸入帳號或群組名稱"
                  value={assignSearch}
                  onChange={e => {
                    const q = e.target.value;
                    setAssignSearch(q);
                    if (assignSearchTimer) clearTimeout(assignSearchTimer);
                    if (!q.trim()) { setAssignSearchResults([]); return; }
                    const timer = setTimeout(async () => {
                      setAssignSearchLoading(true);
                      try {
                        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q.trim())}`);
                        const d = await r.json();
                        setAssignSearchResults(d.users ?? []);
                      } finally {
                        setAssignSearchLoading(false);
                      }
                    }, 300);
                    setAssignSearchTimer(timer);
                  }}
                />
                {(() => {
                  const q = assignSearch.trim().toLowerCase();
                  const matchingGroups = q
                    ? availableGroups.filter(g => g.name.toLowerCase().includes(q))
                    : [];
                  const hasAny = assignSearchResults.length > 0 || matchingGroups.length > 0;
                  if (!q) return null;
                  if (assignSearchLoading && !hasAny) {
                    return <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>搜尋中...</p>;
                  }
                  if (!hasAny && !assignSearchLoading) {
                    return (
                      <p className="text-xs opacity-40 px-1" style={{ color: "var(--zen-ink)" }}>
                        找不到{groupsLoading ? "使用者" : "使用者或群組"}
                      </p>
                    );
                  }
                  return (
                    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800 rounded-xl overflow-hidden border max-h-56 overflow-y-auto" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 12%, transparent)" }}>
                      {matchingGroups.map(g => {
                        const already = selectedGroups.some(s => s.id === g.id);
                        return (
                          <button
                            key={`g:${g.id}`}
                            type="button"
                            disabled={already}
                            className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            onClick={() => {
                              setSelectedGroups(prev => [...prev, g]);
                              setAssignSearch("");
                              setAssignSearchResults([]);
                            }}
                          >
                            <span aria-hidden className="w-7 h-7 flex items-center justify-center rounded-full text-xs shrink-0" style={{ backgroundColor: "color-mix(in srgb, #b19739 20%, transparent)", color: "#b19739" }}>👥</span>
                            <span className="text-sm flex-1" style={{ color: "#b19739" }}>{g.name}</span>
                            {g.memberCount != null && (
                              <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>{g.memberCount} 人</span>
                            )}
                            {already && <span className="text-xs opacity-50 ml-2" style={{ color: "var(--zen-ink)" }}>已加入</span>}
                          </button>
                        );
                      })}
                      {assignSearchResults.map(u => {
                        const already = selectedAssignees.some(s => s.id === u.id);
                        return (
                          <button
                            key={`u:${u.id}`}
                            type="button"
                            disabled={already}
                            className="flex items-center gap-2 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            onClick={() => {
                              setSelectedAssignees(prev => [...prev, { id: u.id, name: u.name, avatarUrl: u.avatarUrl }]);
                              setAssignSearch("");
                              setAssignSearchResults([]);
                            }}
                          >
                            <NextImage src={u.avatarUrl || AVATAR_PLACEHOLDER} alt={u.name} width={28} height={28} unoptimized className="w-7 h-7 rounded-full object-cover shrink-0" />
                            <span className="text-sm flex-1" style={{ color: "var(--zen-ink)" }}>{u.name}</span>
                            {already && <span className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>已加入</span>}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>開始時間</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  value={assignStart}
                  onChange={e => setAssignStart(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs opacity-50" style={{ color: "var(--zen-ink)" }}>結束時間</label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 rounded-xl border text-sm outline-none"
                  style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                  value={assignEnd}
                  onChange={e => setAssignEnd(e.target.value)}
                />
              </div>
            </div>

            {assignError && <p className="text-xs text-red-500">{assignError}</p>}
            {assignResultMsg && <p className="text-xs" style={{ color: "#b19739" }}>{assignResultMsg}</p>}

            <button
              disabled={
                assignSubmitting ||
                (selectedAssignees.length === 0 && selectedGroups.length === 0) ||
                !assignStart ||
                !assignEnd
              }
              onClick={async () => {
                setAssignSubmitting(true);
                setAssignError(null);
                setAssignResultMsg(null);
                try {
                  const r = await fetch("/api/assignments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      sourceResourceId: assignModal.sourceResourceId,
                      sourceResourceType: assignModal.sourceResourceType,
                      assigneeIds: selectedAssignees.map(u => u.id),
                      groupIds: selectedGroups.map(g => g.id),
                      title: assignModal.displayName.trim(),
                      startAt: new Date(assignStart).toISOString(),
                      endAt: new Date(assignEnd).toISOString(),
                    }),
                  });
                  const d = await r.json();
                  if (!r.ok) {
                    setAssignError(d.error ?? "建立失敗");
                    return;
                  }
                  const created = d.created ?? 0;
                  const skipped = (d.skipped ?? []) as Array<{ reason: string }>;
                  if (created === 0) {
                    setAssignError(`未建立任何指派${skipped.length > 0 ? `（略過 ${skipped.length} 人）` : ""}`);
                    return;
                  }
                  if (skipped.length > 0) {
                    setAssignResultMsg(`已建立 ${created} 個指派，略過 ${skipped.length} 人`);
                    setTimeout(() => setAssignModal(null), 1500);
                  } else {
                    setAssignModal(null);
                  }
                } finally {
                  setAssignSubmitting(false);
                }
              }}
              className="w-full py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ backgroundColor: "#b19739", color: "#fff" }}
            >
              {assignSubmitting ? "建立中..." : "建立指派"}
            </button>
          </div>
        </>
      )}
    </>
  );

  if (!isOwner) {
    return <div className="bookshelf-grid">{gridContent}</div>;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDrag(null)}>
      <RootDropWrapper>{gridContent}</RootDropWrapper>
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            className="book-link bookshelf-btn"
            style={{ color: "var(--zen-ink)", backgroundColor: "var(--zen-paper)", boxShadow: "0 8px 24px rgba(0,0,0,0.18)", cursor: "grabbing" }}
          >
            {activeDrag.kind === "folder" ? `📁 ${activeDrag.name}` : activeDrag.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
