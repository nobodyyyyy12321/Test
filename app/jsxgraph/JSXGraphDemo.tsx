"use client";

import { useEffect } from "react";

export default function JSXGraphDemo() {
  useEffect(() => {
    let cancelled = false;
    let jxgLib: any = null;
    let board: any = null;

    (async () => {
      const mod = await import("jsxgraph");
      if (cancelled) return;
      jxgLib = mod.default;

      board = jxgLib.JSXGraph.initBoard("jxg-demo-board", {
        boundingbox: [-6, 6, 6, -6],
        axis: true,
        grid: true,
        showNavigation: false,
        showCopyright: false,
        keepaspectratio: false,
        pan: {
          enabled: true,
        },
        zoom: {
          wheel: true,
        },
      });

      const p1 = board.create("point", [-3, -1], {
        name: "A",
        color: "#5fa870",
        size: 3,
      });
      const p2 = board.create("point", [2, 3], {
        name: "B",
        color: "#b19739",
        size: 3,
      });

      board.create("line", [p1, p2], {
        strokeColor: "#5fa870",
        strokeWidth: 2,
        straightFirst: true,
        straightLast: true,
      });

      board.create("functiongraph", [(x: number) => 0.25 * x * x - 2], {
        strokeColor: "#b19739",
        strokeWidth: 2,
      });
    })().catch(() => {});

    return () => {
      cancelled = true;
      if (jxgLib && board) {
        jxgLib.JSXGraph.freeBoard(board);
      }
    };
  }, []);

  return (
    <div
      id="jxg-demo-board"
      className="jxgbox"
      style={{
        position: "relative",
        overflow: "hidden",
        touchAction: "none",
        width: "min(900px, 100%)",
        height: "500px",
        border: "1px solid color-mix(in srgb, var(--zen-ink) 15%, transparent)",
        borderRadius: "12px",
        backgroundColor: "var(--zen-bg)",
      }}
    />
  );
}
