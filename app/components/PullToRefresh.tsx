"use client";

import { useEffect, useRef, useState } from "react";

const THRESHOLD = 72;
const MAX_PULL = 100;

export default function PullToRefresh() {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const pullingRef = useRef(false);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      if (window.scrollY > 0) { startYRef.current = null; return; }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) return;
      pullingRef.current = true;
      e.preventDefault();
      setPullY(Math.min(dy, MAX_PULL));
    };

    const onTouchEnd = () => {
      if (!pullingRef.current) return;
      if (pullY >= THRESHOLD) {
        setRefreshing(true);
        setTimeout(() => window.location.reload(), 300);
      } else {
        setPullY(0);
      }
      startYRef.current = null;
      pullingRef.current = false;
    };

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY]);

  if (pullY === 0 && !refreshing) return null;

  const progress = Math.min(pullY / THRESHOLD, 1);
  const ready = pullY >= THRESHOLD;
  const barWidth = refreshing ? 100 : Math.round(progress * 100);

  return (
    <div className="sm:hidden fixed top-0 left-0 right-0 z-[90] pointer-events-none" style={{ height: 3 }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: `${barWidth}%`,
          height: "3px",
          backgroundColor: ready || refreshing ? "#5fa870" : `color-mix(in srgb, #5fa870 ${Math.round(progress * 100)}%, transparent)`,
          transition: refreshing ? "width 0.6s linear infinite" : "width 0.1s ease-out",
          animation: refreshing ? "loadingBarPulse 1.5s ease-in-out infinite" : undefined,
        }}
      />
    </div>
  );
}
