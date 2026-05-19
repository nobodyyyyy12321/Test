"use client";

import { useEffect, useRef } from "react";

type Options = {
  direction: "right" | "left";
  onSwipe: () => void;
  enabled?: boolean;
  edgeThreshold?: number;
  minDistance?: number;
  maxVertical?: number;
  maxWidth?: number;
  maxDuration?: number;
};

export function useEdgeSwipeNav({
  direction,
  onSwipe,
  enabled = true,
  edgeThreshold = 24,
  minDistance = 60,
  maxVertical = 60,
  maxWidth = 640,
  maxDuration = 800,
}: Options) {
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    if (!enabled) return;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let valid = false;

    const onStart = (e: TouchEvent) => {
      valid = false;
      if (window.innerWidth >= maxWidth) return;
      if (e.touches.length !== 1) return;
      const target = e.target as Element | null;
      if (target?.closest("a, button, input, textarea, select, label, [role='button'], [role='link'], [contenteditable='true']")) return;
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTime = Date.now();
      const w = window.innerWidth;
      valid = direction === "right"
        ? startX <= edgeThreshold
        : startX >= w - edgeThreshold;
    };

    const onEnd = (e: TouchEvent) => {
      if (!valid) return;
      valid = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Date.now() - startTime > maxDuration) return;
      if (Math.abs(dy) > maxVertical) return;
      const matched = direction === "right" ? dx >= minDistance : dx <= -minDistance;
      if (matched) onSwipeRef.current();
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [direction, enabled, edgeThreshold, minDistance, maxVertical, maxWidth, maxDuration]);
}
