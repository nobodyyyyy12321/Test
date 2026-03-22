"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import ShareIcon from "../../../components/ShareIcon";

type Props = {
  articleId: string;
  articleNumber: number;
  title: string;
};

export default function AddToListButton({ articleId, articleNumber, title }: Props) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const fetchLists = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/lists", { credentials: "include" });
      if (res.status === 401) {
        alert("請先登入以使用清單功能");
        router.push("/auth/login");
        return;
      }
      const j = await res.json();
      if (!res.ok) {
        console.error("Failed fetching lists:", res.status, j);
        alert(j.error || "取清單失敗");
        return;
      }
      if (j?.ok) setLists(j.lists || []);
    } catch (e) {
      console.error(e);
    } finally { setLoading(false); }
  };

  const toggle = async () => {
    if (!open && lists === null) await fetchLists();
    setOpen((v) => !v);
  };

  const ensureAddToList = async (listId: string) => {
    try {
      const getRes = await fetch(`/api/user/lists/${listId}`);
      if (!getRes.ok) { alert("取清單失敗"); return; }
      const j = await getRes.json();
      if (!j?.ok) { alert(j.error || "取清單失敗"); return; }
      const items = Array.isArray(j.list.items) ? j.list.items : [];
      const key = articleId || String(articleNumber);
      if (items.includes(key)) {
        setMsg("此文章已在清單中");
        setTimeout(() => setMsg(null), 2000);
        return;
      }

      const updated = [...items, key];
      const patchRes = await fetch(`/api/user/lists/${listId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: updated }),
      });
      const pj = await patchRes.json();
      if (!pj?.ok) { alert(pj.error || "加入失敗"); return; }
      setMsg("已加入清單");
      setTimeout(() => setMsg(null), 2000);
      setOpen(false);
    } catch (e) { console.error(e); alert("加入失敗"); }
  };

  const createAndAdd = async () => {
    const titleInput = prompt("請輸入新清單名稱：");
    if (!titleInput) return;
    try {
      const res = await fetch("/api/user/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleInput.trim(), items: [] }),
      });
      const j = await res.json();
      if (!j?.ok) { alert(j.error || "建立失敗"); return; }
      // insert new list into the dropdown immediately
      setLists((prev) => [j.list, ...(prev || [])]);
      // add item to the new list
      await ensureAddToList(j.list.id);
      // ensure dropdown reflects change
      // (ensureAddToList will close the menu on success)
      // show success toast
      setMsg("已建立並加入清單");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) { console.error(e); alert("建立失敗"); }
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={toggle}
        className="ml-4 px-3 py-1 border rounded text-sm bookshelf-btn"
        data-title={title}
        data-href={typeof articleId === "string" ? `/article/${articleId}` : `/article/${articleNumber}`}
      >
        加入清單
      </button>
      {open && (
        <div className="absolute mt-2 right-0 w-56 bg-white dark:bg-gray-900 border rounded shadow z-30 p-2">
          {loading ? <div className="p-2">載入中…</div> : (
            <div>
              {lists && lists.length === 0 && <div className="p-2 text-sm">尚無清單</div>}
              {lists?.map((l) => (
                <div key={l.id} className="flex items-center justify-between">
                  <button onClick={() => ensureAddToList(l.id)} className="block w-full text-left px-2 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm">{l.title}</button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`確定要刪除清單「${l.title}」嗎？`)) return;
                      try {
                        const del = await fetch(`/api/user/lists/${l.id}`, { method: "DELETE" });
                        const dj = await del.json();
                        if (dj?.ok) {
                          setLists((prev) => (prev || []).filter((x) => x.id !== l.id));
                        } else {
                          alert(dj.error || "刪除失敗");
                        }
                      } catch (err) {
                        console.error(err);
                        alert("刪除失敗");
                      }
                    }}
                    className="ml-2 px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                    title="刪除清單"
                  >
                    刪除
                  </button>
                </div>
              ))}
              <div className="border-t mt-2 pt-2">
                <button onClick={createAndAdd} className="w-full text-left px-2 py-1 text-sm">＋ 新增清單</button>
              </div>
            </div>
          )}
          {msg && <div className="mt-2 text-xs text-green-600">{msg}</div>}
          {/* Floating toast */}
          {msg && (
            <div className="fixed bottom-6 right-6 z-50">
              <div className="bg-green-600 text-white px-4 py-2 rounded shadow">{msg}</div>
            </div>
          )}
        </div>
      )}

      {/* 右下角白框分享按鈕 */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 40 }}>
        <button
          type="button"
          className="share-btn bookshelf-btn"
          aria-label="分享"
          data-title={title}
          data-href={typeof articleId === "string" ? `/article/${articleId}` : `/article/${articleNumber}`}
        >
          <ShareIcon size={32} />
        </button>
        <style jsx>{`
          .share-btn {
            background: #fff;
            border: 2px solid #fff;
            border-radius: 50%;
            padding: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            cursor: pointer;
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .share-btn:active {
            transform: scale(0.92);
            box-shadow: 0 4px 16px rgba(0,0,0,0.16);
          }
        `}</style>
      </div>
    </div>
  );
}
