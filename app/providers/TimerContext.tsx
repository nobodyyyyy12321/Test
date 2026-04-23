"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type TimerMode = "up" | "down";

interface TimerCtx {
  enabled: boolean;
  mode: TimerMode;
  running: boolean;
  seconds: number;        // display: elapsed for "up", remaining for "down"
  countdownTotal: number;
  finished: boolean;
  setEnabled: (v: boolean) => void;
  setMode: (m: TimerMode) => void;
  setCountdownTotal: (s: number) => void;
  start: () => void;
  pause: () => void;
  stop: () => void;
  reset: () => void;
}

const Ctx = createContext<TimerCtx | null>(null);

export function TimerProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<TimerMode>("up");
  const [running, setRunning] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [countdownTotal, setCountdownTotal] = useState(30 * 60);
  const [finished, setFinished] = useState(false);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const clear = () => { if (ref.current) { clearInterval(ref.current); ref.current = null; } };

  useEffect(() => {
    if (!running) { clear(); return; }
    ref.current = setInterval(() => {
      setTicks(t => {
        const next = t + 1;
        if (mode === "down" && next >= countdownTotal) {
          setFinished(true);
          setRunning(false);
          return countdownTotal;
        }
        return next;
      });
    }, 1000);
    return clear;
  }, [running, mode, countdownTotal]);

  const start = useCallback(() => { setFinished(false); setRunning(true); }, []);
  const pause = useCallback(() => setRunning(false), []);
  const stop = useCallback(() => setRunning(false), []);
  const reset = useCallback(() => { setRunning(false); setTicks(0); setFinished(false); }, []);

  const seconds = mode === "up" ? ticks : Math.max(0, countdownTotal - ticks);

  return (
    <Ctx.Provider value={{
      enabled, mode, running, seconds, countdownTotal, finished,
      setEnabled, setMode, setCountdownTotal,
      start, pause, stop, reset,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}
