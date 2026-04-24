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
  const SEARCH_BOTTOM = 88; // fixed header bottom edge on mobile
  const offsetY = refreshing ? SEARCH_BOTTOM + 8 : SEARCH_BOTTOM - 32 + Math.min(pullY * 0.6, 40);

  return (
    <div className="sm:hidden fixed top-0 left-0 right-0 z-[90] flex justify-center pointer-events-none" style={{ height: SEARCH_BOTTOM + 64 }}>
      <div
        style={{
          position: "absolute",
          top: offsetY,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--zen-bg)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          border: "2px solid",
          borderColor: ready || refreshing ? "#5fa870" : `color-mix(in srgb, #5fa870 ${Math.round(progress * 100)}%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: refreshing ? "top 0.2s" : undefined,
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={ready || refreshing ? "#5fa870" : `color-mix(in srgb, #5fa870 ${Math.round(progress * 100)}%, transparent)`}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{
            transform: `rotate(${refreshing ? 720 : progress * 180}deg)`,
            transition: refreshing ? "transform 0.6s" : undefined,
          }}
        >
          <polyline points="1 4 1 10 7 10"/>
          <path d="M3.51 15a9 9 0 1 0 .49-4.9"/>
        </svg>
      </div>
    </div>
  );
}
