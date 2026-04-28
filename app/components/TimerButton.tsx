"use client";

import { useState } from "react";
import { useTimer } from "../providers/TimerContext";

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function ToggleSwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={on ? "關閉計時器" : "開啟計時器"}
      style={{
        position: "relative",
        width: 64,
        height: 30,
        borderRadius: 999,
        background: "linear-gradient(160deg, #1c1c1c 0%, #2e2e2e 100%)",
        border: "2px solid",
        borderColor: "color-mix(in srgb, silver 55%, transparent)",
        boxShadow: "inset 0 2px 5px rgba(0,0,0,0.7), inset 0 -1px 2px rgba(255,255,255,0.06), 0 1px 3px rgba(0,0,0,0.5)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "box-shadow 0.2s",
      }}
    >
      {/* Label text */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: on ? 9 : undefined,
          right: on ? undefined : 9,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: on ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.25)",
          userSelect: "none",
          transition: "left 0.25s, right 0.25s",
          pointerEvents: "none",
        }}
      >
        {on ? "ON" : "OFF"}
      </span>
      {/* Knob */}
      <span
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          left: on ? "calc(100% - 26px)" : 2,
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: "radial-gradient(circle at 38% 32%, #ffffff 0%, #d8d8d8 55%, #b0b0b0 100%)",
          boxShadow: "0 2px 5px rgba(0,0,0,0.55), inset 0 1px 2px rgba(255,255,255,0.9)",
          transition: "left 0.25s cubic-bezier(.4,0,.2,1)",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

export default function TimerButton({ placement = "top" }: { placement?: "right" | "top" | "bottom-right" }) {
  const {
    enabled, setEnabled,
    mode, setMode,
    running, seconds, countdownTotal, setCountdownTotal, finished,
    start, pause, stop, reset,
  } = useTimer();

  const [open, setOpen] = useState(false);
  const [mins, setMins] = useState(String(Math.floor(countdownTotal / 60)));

  const isActive = enabled && (running || seconds > 0 || finished);

  const panelPos = placement === "right"
    ? "left-full ml-3 top-1/2 -translate-y-1/2"
    : placement === "bottom-right"
      ? "top-full mt-3 right-0"
      : "fixed bottom-[72px] left-0 right-0 mx-0";

  const handleToggle = () => {
    if (enabled) {
      reset();
      setEnabled(false);
    } else {
      if (mode === "down") {
        const parsed = Math.max(1, parseInt(mins) || 30);
        setCountdownTotal(parsed * 60);
        setMins(String(parsed));
      }
      setEnabled(true);
      reset();
    }
  };

  return (
    <div className="relative flex items-center justify-center">
      {open && (
        <div
          className={placement === "top"
            ? `fixed ${panelPos} w-screen rounded-none border-t shadow-lg px-6 py-4 z-50 text-sm`
            : `absolute ${panelPos} w-48 rounded-xl border shadow-lg p-3 z-50 text-sm`
          }
          style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
        >
          {/* Toggle row */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium" style={{ color: "var(--zen-ink)" }}>計時器</span>
            <ToggleSwitch on={enabled} onToggle={handleToggle} />
          </div>

          {/* Config (only when OFF) */}
          {!enabled && (
            <>
              <div className="flex gap-1.5 mb-2">
                {(["up", "down"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className="flex-1 py-1 rounded-full text-xs border transition-colors"
                    style={{
                      borderColor: mode === m ? "#b19739" : "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
                      color: mode === m ? "#b19739" : "var(--zen-ink)",
                    }}
                  >
                    {m === "up" ? "計時" : "倒數"}
                  </button>
                ))}
              </div>
              {mode === "down" && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number" min="1" max="999"
                    value={mins}
                    onChange={e => setMins(e.target.value)}
                    className="w-14 px-2 py-1 text-center text-sm border rounded outline-none"
                    style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)" }}
                  />
                  <span className="text-xs" style={{ color: "var(--zen-ink)" }}>分鐘</span>
                </div>
              )}
            </>
          )}

          {/* Status (only when ON) */}
          {enabled && (
            <>
              <div
                className="text-center font-mono mb-2"
                style={{ fontSize: finished ? "0.85rem" : "1.15rem", color: finished ? "rgb(239,68,68)" : "#b19739" }}
              >
                {finished ? "時間到！" : fmt(seconds)}
              </div>
              {!running && !finished && seconds === 0 && (
                <p className="text-center text-xs mb-2 opacity-55" style={{ color: "var(--zen-ink)" }}>
                  進入題目後自動開始
                </p>
              )}
              {(running || (!finished && seconds > 0)) && (
                <div className="flex gap-1.5">
                  {running ? (
                    <button
                      onClick={pause}
                      className="flex-1 py-1 rounded-full text-xs border"
                      style={{ borderColor: "#b19739", color: "#b19739" }}
                    >
                      暫停
                    </button>
                  ) : (
                    <button
                      onClick={start}
                      className="flex-1 py-1 rounded-full text-xs text-white"
                      style={{ backgroundColor: "#5fa870" }}
                    >
                      繼續
                    </button>
                  )}
                  <button
                    onClick={() => { reset(); }}
                    className="flex-1 py-1 rounded-full text-xs border border-zinc-300 dark:border-zinc-600"
                    style={{ color: "var(--zen-ink)" }}
                  >
                    重置
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button onClick={() => setOpen(p => !p)} aria-label="計時器">
        {finished ? (
          <span className="text-xs font-mono text-red-500">時間到</span>
        ) : isActive ? (
          <span
            className="text-xs font-mono tabular-nums"
            style={{ color: running ? "#5fa870" : "#b19739" }}
          >
            {fmt(seconds)}
          </span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5fa870" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        )}
      </button>
    </div>
  );
}
