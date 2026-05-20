"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";

type Selection = { r1: number; c1: number; r2: number; c2: number };

export function useExcelSelection({ resetKey }: { resetKey?: unknown } = {}) {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const [sel, setSel] = useState<Selection | null>(null);
  const draggingRef = useRef(false);

  const cellAt = (target: EventTarget | null): { r: number; c: number } | null => {
    const el = target as HTMLElement | null;
    if (!el) return null;
    const cell = el.closest("td, th") as HTMLElement | null;
    if (!cell || !tableRef.current?.contains(cell)) return null;
    const r = Number(cell.dataset.row);
    const c = Number(cell.dataset.col);
    if (!Number.isFinite(r) || !Number.isFinite(c)) return null;
    return { r, c };
  };

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLTableElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button")) return;
    const pos = cellAt(e.target);
    if (!pos) return;
    setSel({ r1: pos.r, c1: pos.c, r2: pos.r, c2: pos.c });
    draggingRef.current = true;
    e.preventDefault();
  }, []);

  const onMouseOver = useCallback((e: React.MouseEvent<HTMLTableElement>) => {
    if (!draggingRef.current) return;
    const pos = cellAt(e.target);
    if (!pos) return;
    setSel(s => s ? { r1: s.r1, c1: s.c1, r2: pos.r, c2: pos.c } : null);
  }, []);

  useEffect(() => {
    const onUp = () => { draggingRef.current = false; };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (!tableRef.current) return;
      if (tableRef.current.contains(e.target as Node)) return;
      // Elements with data-keep-selection (and their descendants) don't clear the selection
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-keep-selection]")) return;
      setSel(null);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    setSel(null);
  }, [resetKey]);

  useEffect(() => {
    const onCopy = (e: ClipboardEvent) => {
      if (!sel || !tableRef.current) return;
      const rMin = Math.min(sel.r1, sel.r2);
      const rMax = Math.max(sel.r1, sel.r2);
      const cMin = Math.min(sel.c1, sel.c2);
      const cMax = Math.max(sel.c1, sel.c2);
      const lines: string[] = [];
      for (let r = rMin; r <= rMax; r++) {
        const cols: string[] = [];
        for (let c = cMin; c <= cMax; c++) {
          const cell = tableRef.current!.querySelector<HTMLElement>(
            `[data-row="${r}"][data-col="${c}"]`
          );
          const raw = cell?.dataset.copyText ?? cell?.innerText ?? "";
          cols.push(raw.replace(/[\t\r\n]+/g, " ").trim());
        }
        lines.push(cols.join("\t"));
      }
      e.preventDefault();
      e.clipboardData?.setData("text/plain", lines.join("\n"));
    };
    document.addEventListener("copy", onCopy);
    return () => document.removeEventListener("copy", onCopy);
  }, [sel]);

  const getSelectionAsTable = useCallback((): string[][] | null => {
    if (!sel || !tableRef.current) return null;
    const rMin = Math.min(sel.r1, sel.r2);
    const rMax = Math.max(sel.r1, sel.r2);
    const cMin = Math.min(sel.c1, sel.c2);
    const cMax = Math.max(sel.c1, sel.c2);
    const rows: string[][] = [];
    for (let r = rMin; r <= rMax; r++) {
      const cols: string[] = [];
      for (let c = cMin; c <= cMax; c++) {
        const cell = tableRef.current.querySelector<HTMLElement>(
          `[data-row="${r}"][data-col="${c}"]`
        );
        const raw = cell?.dataset.copyText ?? cell?.innerText ?? "";
        cols.push(raw.replace(/[\r\n]+/g, " ").trim());
      }
      rows.push(cols);
    }
    return rows;
  }, [sel]);

  const hasSelection = sel !== null;

  const isSelected = useCallback((r: number, c: number) => {
    if (!sel) return false;
    const rMin = Math.min(sel.r1, sel.r2);
    const rMax = Math.max(sel.r1, sel.r2);
    const cMin = Math.min(sel.c1, sel.c2);
    const cMax = Math.max(sel.c1, sel.c2);
    return r >= rMin && r <= rMax && c >= cMin && c <= cMax;
  }, [sel]);

  const isAnchor = useCallback((r: number, c: number) => {
    return !!sel && sel.r1 === r && sel.c1 === c;
  }, [sel]);

  const cellBg = (r: number, c: number): string => {
    if (isAnchor(r, c)) return "bg-blue-200 dark:bg-blue-800/60";
    if (isSelected(r, c)) return "bg-blue-100 dark:bg-blue-900/40";
    return "";
  };

  return { tableRef, onMouseDown, onMouseOver, isSelected, isAnchor, cellBg, getSelectionAsTable, hasSelection };
}
