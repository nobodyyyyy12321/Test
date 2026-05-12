"use client";

import React, { useEffect, useState } from "react";
import type { QuestionList } from "../../lib/lists-supabase";

export type MyCollection = {
  id: string;
  collectionId: string;
  displayName: string;
  createdAt: string;
  fromGrid?: boolean;
  parentId?: string | null;
  approvalStatus?: string;
};

type UserFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

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
};

export function PersonalListsView({
  isOwner,
  loading,
  lists,
  myCollections,
}: Props) {
  const [folders, setFolders] = useState<UserFolder[]>([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [addingTopFolder, setAddingTopFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(new Set());

  const visibleCollections = myCollections.filter((c) => c.approvalStatus !== "pending");

  const loadFolders = async () => {
    if (!isOwner) return;
    try {
      const res = await fetch("/api/my-categories", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setFolders(Array.isArray(data.folders) ? data.folders : []);
    } catch {
      setFolders([]);
    } finally {
      setFoldersLoaded(true);
    }
  };

  useEffect(() => {
    if (!isOwner || foldersLoaded) return;
    void loadFolders();
  }, [isOwner, foldersLoaded]);

  const addFolder = async (name: string, parentId: string | null = null) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/my-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "addFolder", name: trimmed, parentId }),
    });
    if (res.ok) {
      setNewFolderName("");
      setAddingTopFolder(false);
      await loadFolders();
    }
  };

  const renameFolder = async (folderId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const res = await fetch("/api/my-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "renameFolder", folderId, name: trimmed }),
    });
    if (res.ok) {
      setRenamingFolderId(null);
      await loadFolders();
    }
  };

  const deleteFolder = async (folderId: string) => {
    const res = await fetch("/api/my-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "deleteFolder", folderId }),
    });
    if (res.ok) {
      await loadFolders();
    }
  };

  const toggleFolderOpen = (id: string) => {
    setOpenFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collectionsUnder = (folderId: string | null) =>
    visibleCollections.filter((c) => (c.parentId ?? null) === folderId);

  const foldersUnder = (folderId: string | null) =>
    folders.filter((f) => (f.parentId ?? null) === folderId);

  const renderFolder = (folder: UserFolder, depth: number): React.ReactNode => {
    const isOpen = openFolderIds.has(folder.id);
    const margin = depth > 0 ? { marginLeft: `${depth * 14}px` } : undefined;
    const childFolders = foldersUnder(folder.id);
    const childCollections = collectionsUnder(folder.id);

    return (
      <div key={folder.id} className="contents">
        {renamingFolderId === folder.id ? (
          <input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => void renameFolder(folder.id, renameDraft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void renameFolder(folder.id, renameDraft);
              }
              if (e.key === "Escape") setRenamingFolderId(null);
            }}
            className="book-link bookshelf-btn px-2 py-0.5 outline-none border border-zinc-300 dark:border-zinc-600"
            style={{ ...margin, backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
          />
        ) : (
          <button
            type="button"
            className={`book-link bookshelf-btn ${isOpen ? "active-category" : ""}`.trim()}
            style={{ ...margin, color: "#b19739" }}
            onClick={() => toggleFolderOpen(folder.id)}
            onContextMenu={(e) => {
              if (!isOwner) return;
              e.preventDefault();
              const action = window.prompt("資料夾操作：r=改名, d=刪除", "r");
              if (action === "r") {
                setRenamingFolderId(folder.id);
                setRenameDraft(folder.name);
              } else if (action === "d") {
                void deleteFolder(folder.id);
              }
            }}
          >
            📁 {folder.name}
          </button>
        )}

        {isOpen && childCollections.map((col) => (
          <a
            key={`my-${col.id}`}
            href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
            className="book-link bookshelf-btn sub-item"
            style={{ color: "#20b2aa", marginLeft: `${(depth + 1) * 14}px` }}
          >
            {col.displayName}
          </a>
        ))}

        {isOpen && childFolders.map((child) => renderFolder(child, depth + 1))}
      </div>
    );
  };

  if (loading) return <p className="text-sm zen-subtle">載入中...</p>;

  const topFolders = foldersUnder(null);
  const topCollections = collectionsUnder(null);

  if (lists.length === 0 && topCollections.length === 0 && topFolders.length === 0) {
    return (
      <p className="text-sm zen-subtle opacity-50">
        {isOwner ? "尚無試卷，在題目頁按 + 新增" : "尚無公開試卷"}
      </p>
    );
  }

  return (
    <div className="bookshelf-grid">
      {lists.map((list) => (
        <a
          key={list.id}
          href={`/test/list?listId=${list.id}&autostart=1`}
          className="book-link bookshelf-btn"
          style={{ color: "#6ea8d8" }}
        >
          {list.title}
        </a>
      ))}

      {topCollections.map((col) => (
        <a
          key={`my-${col.id}`}
          href={`/test/${encodeURIComponent(col.collectionId)}?autostart=1`}
          className="book-link bookshelf-btn"
          style={{ color: "#20b2aa" }}
        >
          {col.displayName}
        </a>
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
    </div>
  );
}
