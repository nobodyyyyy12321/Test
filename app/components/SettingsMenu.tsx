"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
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

export default function SettingsMenu() {
  const { data: session, status } = useSession();
  const {
    enabled: timerEnabled,
    setEnabled: setTimerEnabled,
    mode: timerMode,
    setMode: setTimerMode,
    running: timerRunning,
    seconds: timerSeconds,
    countdownTotal,
    setCountdownTotal,
    finished: timerFinished,
    start: timerStart,
    pause: timerPause,
    reset: timerReset,
  } = useTimer();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showTimerPanel, setShowTimerPanel] = useState(false);
  const [timerMins, setTimerMins] = useState(String(Math.floor(countdownTotal / 60)));
  const prevLoggedInRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    setTimerMins(String(Math.max(1, Math.floor(countdownTotal / 60))));
  }, [countdownTotal]);

  useEffect(() => {
    const loggedIn = !!session?.user;
    if (loggedIn && !prevLoggedInRef.current) {
      localStorage.setItem("quizMode", "practice");
    }
    prevLoggedInRef.current = loggedIn;
  }, [session]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  if (status === "loading" || !session?.user) return null;

  const selectTimerMode = (m: "up" | "down") => {
    setTimerMode(m);
    if (m === "down") {
      const parsed = Math.max(1, parseInt(timerMins) || 30);
      setCountdownTotal(parsed * 60);
      setTimerMins(String(parsed));
    }
  };

  const handleTimerToggle = () => {
    if (timerEnabled) {
      timerReset();
      setTimerEnabled(false);
      return;
    }
    if (timerMode === "down") {
      const parsed = Math.max(1, parseInt(timerMins) || 30);
      setCountdownTotal(parsed * 60);
      setTimerMins(String(parsed));
    }
    setTimerEnabled(true);
    timerReset();
  };

  const timerActive = timerEnabled && (timerRunning || timerSeconds > 0 || timerFinished);

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          aria-haspopup="true"
          aria-label="開啟設定選單"
          className="flex items-center"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--zen-ink)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* 桌機下拉選單 */}
        {isMenuOpen && (
          <div className="hidden sm:block absolute right-0 top-full mt-2 w-44 rounded shadow-md z-[61] border border-zinc-200 dark:border-zinc-800 bg-zen-paper dark:bg-zinc-900">
            <div className="py-1">
              <button
                onClick={() => setShowTimerPanel(v => !v)}
                className="w-full text-left px-4 py-3 !text-sm !leading-5 font-normal hover:bg-zinc-100 dark:hover:bg-zinc-800"
                style={{ color: "#D1D5DB" }}
              >
                計時器{timerActive ? `：${timerFinished ? "時間到" : fmt(timerSeconds)}` : ""}
              </button>
              {showTimerPanel && (
                <div className="px-4 pb-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: "var(--zen-ink)" }}>計時器</span>
                    <ToggleSwitch on={timerEnabled} onToggle={handleTimerToggle} />
                  </div>
                  {!timerEnabled && (
                    <>
                      <div className="flex gap-1.5 mb-2">
                        {(["up", "down"] as const).map(m => (
                          <button
                            key={m}
                            onClick={() => selectTimerMode(m)}
                            className="flex-1 py-1 rounded-full text-xs border transition-colors"
                            style={{
                              borderColor: timerMode === m ? "#b19739" : "color-mix(in srgb, var(--zen-ink) 20%, transparent)",
                              color: timerMode === m ? "#b19739" : "var(--zen-ink)",
                            }}
                          >
                            {m === "up" ? "計時" : "倒數"}
                          </button>
                        ))}
                      </div>
                      {timerMode === "down" && (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="999"
                            value={timerMins}
                            onChange={e => setTimerMins(e.target.value)}
                            className="w-14 px-2 py-1 text-center text-sm border rounded outline-none"
                            style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)", borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)" }}
                          />
                          <span className="text-xs" style={{ color: "var(--zen-ink)" }}>分鐘</span>
                        </div>
                      )}
                    </>
                  )}
                  {timerEnabled && (
                    <>
                      <div className="text-center font-mono mb-2" style={{ fontSize: timerFinished ? "0.85rem" : "1.15rem", color: timerFinished ? "rgb(239,68,68)" : "#b19739" }}>
                        {timerFinished ? "時間到！" : fmt(timerSeconds)}
                      </div>
                      {!timerRunning && !timerFinished && timerSeconds === 0 && (
                        <p className="text-center text-xs mb-2 opacity-55" style={{ color: "var(--zen-ink)" }}>進入題目後自動開始</p>
                      )}
                      {(timerRunning || (!timerFinished && timerSeconds > 0)) && (
                        <div className="flex gap-1.5">
                          {timerRunning ? (
                            <button onClick={timerPause} className="flex-1 py-1 rounded-full text-xs border" style={{ borderColor: "#b19739", color: "#b19739" }}>暫停</button>
                          ) : (
                            <button onClick={timerStart} className="flex-1 py-1 rounded-full text-xs text-white" style={{ backgroundColor: "#5fa870" }}>繼續</button>
                          )}
                          <button onClick={() => { timerReset(); }} className="flex-1 py-1 rounded-full text-xs border border-zinc-300 dark:border-zinc-600" style={{ color: "var(--zen-ink)" }}>重置</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

    </>
  );
}
