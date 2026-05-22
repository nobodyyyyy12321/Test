"use client";

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BulkAddToListButton } from "../../components/AddToListButton";
import { useShare } from "../../providers/ShareProvider";
import type { Question } from "../../../lib/questions";
import dynamic from "next/dynamic";

const RenderContent = dynamic(() => import("../../components/RenderContent"), { ssr: false });
import { getTestLabels } from "../../lib/i18n/test";

const QUIZ_GUARD_STATE = { __quizGuard: true };

function gradeAnswer(question: Question, userAns: string | string[] | null): boolean {
  if (userAns === null) return false;
  if (question.answer == null) return false;
  const qtype = question.type ?? "single";
  if (qtype === "fill") {
    return (userAns as string).trim() === (question.answer as string).trim();
  }
  if (qtype === "multiple") {
    const correct = [...(question.answer as string[])].sort();
    const user = [...(userAns as string[])].sort();
    return correct.length === user.length && correct.every((v, i) => v === user[i]);
  }
  return userAns === question.answer;
}

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Props = {
  id: string;
  ordered: boolean;
  listId: string | null;
  listTitle: string | null;
  levels: string | null;
  language: string;
  pageTitle: string;
  replayKey?: string | null;
  autostart?: boolean;
  limit?: number | null;
  mode?: "practice" | "assignment";
  assignmentId?: string;
  initialQuestions?: Question[];
  ownerName?: string | null;
};

export default function TestClient({ id, ordered, listId, listTitle, levels, language, pageTitle, replayKey, autostart, limit, mode = "practice", assignmentId, initialQuestions, ownerName }: Props) {
  const [clientLang, setClientLang] = useState<string | null>(null);
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)siteLanguage=([^;]*)/);
    if (m) setClientLang(m[1]);
  }, []);
  useEffect(() => {
    // Visit increment: list takes priority when test is launched from a list
    const target = listId ? { type: "list" as const, id: listId } : { type: "qset" as const, id };
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(target.id)) return;
    const key = `visited:${target.type}:${target.id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(target),
      keepalive: true,
    }).catch(() => {});
  }, [id, listId]);
  const activeLang = clientLang ?? language;
  const L = useMemo(() => getTestLabels(activeLang), [activeLang]);
  const quizPageSize = limit ?? (id === "englishWords" ? 50 : null);
  const { data: session } = useSession();
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [allUserAnswers, setAllUserAnswers] = useState<(string | string[] | null)[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number | null>(quizPageSize);
  const originalQuestionsRef = useRef<Question[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(new Set());
  const [formalMode, setFormalMode] = useState(false);
  const [started, setStarted] = useState(!!autostart);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [isRetryWrongMode, setIsRetryWrongMode] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [forcedAbandon, setForcedAbandon] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const beforeUnloadHandlerRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const effectivePageSize = pageSize ?? allQuestions.length;
  const pageStart = effectivePageSize > 0 ? pageIndex * effectivePageSize : 0;
  const pageEnd = effectivePageSize > 0 ? pageStart + effectivePageSize : allQuestions.length;
  const questions = effectivePageSize > 0 ? allQuestions.slice(pageStart, pageEnd) : allQuestions;
  const userAnswers = effectivePageSize > 0 ? allUserAnswers.slice(pageStart, pageEnd) : allUserAnswers;
  const totalPages = effectivePageSize > 0 ? Math.max(1, Math.ceil(allQuestions.length / effectivePageSize)) : 1;
  const canGoPrevPage = pageIndex > 0;
  const canGoNextPage = pageIndex < totalPages - 1;

  useLayoutEffect(() => {
    const isFormal = localStorage.getItem("quizMode") === "formal";
    if (isFormal) setFormalMode(true);
  }, []);

  useEffect(() => {
    const active = formalMode && started && !showResults;
    document.documentElement.classList.toggle("formal-quiz-active", active);
    if (!active && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    return () => { document.documentElement.classList.remove("formal-quiz-active"); };
  }, [formalMode, started, showResults]);

  useEffect(() => {
    if (!formalMode || !started || showResults) return;

    const origPush = history.pushState.bind(history);

    // Push sentinel so back-button fires popstate
    origPush(QUIZ_GUARD_STATE, "");

    const handlePopState = () => {
      origPush(QUIZ_GUARD_STATE, ""); // re-block
      pendingNavRef.current = () => { history.go(-2); };
      setShowAbandonModal(true);
    };

    // Intercept anchor clicks in capture phase — avoids calling setState from pushState
    const handleLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as Element).closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      const attr = anchor.getAttribute("href");
      if (!attr || attr.startsWith("#")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dest = anchor.href;
      pendingNavRef.current = () => { window.location.href = dest; };
      setShowAbandonModal(true);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    beforeUnloadHandlerRef.current = handleBeforeUnload;

    // Lock Escape so it fires keydown without exiting fullscreen (Keyboard Lock API)
    const kbd = (navigator as any).keyboard;
    kbd?.lock?.(["Escape"]).catch(() => {});

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAbandonModal(true);
    };

    // Fullscreen exit via browser UI (not Esc) → show modal
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setShowAbandonModal(true);
    };

    // Mobile: switching apps / home button / screen lock → forced abandon on return
    let leftPage = false;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") { leftPage = true; }
      else if (leftPage) {
        leftPage = false;
        setForcedAbandon(true);
        setShowAbandonModal(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleLinkClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      kbd?.unlock?.();
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      history.go(-1); // remove sentinel entry
    };
  }, [formalMode, started, showResults]);

  useEffect(() => {
    // assignment mode: use pre-loaded questions
    if (mode === "assignment" && initialQuestions && initialQuestions.length > 0) {
      const sorted = [...initialQuestions].sort((a, b) => a.number - b.number);
      originalQuestionsRef.current = sorted;
      const hasGroups = sorted.some(q => q.type === "group");
      const shuffled = (ordered || hasGroups) ? sorted : shuffle(sorted);
      setAllQuestions(shuffled);
      setAllUserAnswers(new Array(shuffled.length).fill(null));
      setPageIndex(0);
      setPageSize(quizPageSize);
      setIsLoading(false);
      return;
    }

    // replay mode: load stored answers, fetch questions to match
    if (replayKey) {
      try {
        const stored = sessionStorage.getItem(`quiz_replay_${replayKey}`);
        if (stored) {
          const { answers: storedAnswers }: { answers: { n: number; u: string | string[] | null }[] } = JSON.parse(stored);
          const params = new URLSearchParams({ id });
          if (levels) params.set("levels", levels);
          if (listId) params.set("listId", listId);
          if (language) params.set("lang", language);
          fetch(`/api/questions?${params}`)
            .then(r => r.json())
            .then(({ questions: qs }: { questions: Question[] }) => {
              const sorted = [...qs].sort((a, b) => a.number - b.number);
              const answerMap = new Map(storedAnswers.map(a => [a.n, a.u]));
              const displayed = sorted.filter(q => q.type === "group" || answerMap.has(q.number));
              const answers = displayed.map(q => answerMap.get(q.number) ?? null);
              originalQuestionsRef.current = sorted;
              setAllQuestions(displayed);
              setAllUserAnswers(answers);
              setPageIndex(0);
              setPageSize(null);
              setShowResults(true);
              setIsLoading(false);
            })
            .catch(() => { setIsLoading(false); });
          return;
        }
      } catch {}
    }

    const params = new URLSearchParams({ id });
    if (levels) params.set("levels", levels);
    if (listId) params.set("listId", listId);
    if (language) params.set("lang", language);
    fetch(`/api/questions?${params}`)
      .then(r => r.json())
      .then(({ questions: qs }: { questions: Question[] }) => {
        const sorted = [...qs].sort((a, b) => a.number - b.number);
        originalQuestionsRef.current = sorted;
        const hasGroups = sorted.some(q => q.type === "group");
        const shuffled = (ordered || hasGroups) ? sorted : shuffle(sorted);
        setAllQuestions(shuffled);
        setAllUserAnswers(new Array(shuffled.length).fill(null));
        setPageIndex(0);
        setPageSize(quizPageSize);
        setIsLoading(false);
      })
      .catch(() => { setIsLoading(false); });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { setShareText, setShareTitle, setShareScoreCard } = useShare();

  const checkAnswers = useCallback(() => {
    // Assignment mode: submit answers to API instead of grading locally
    if (mode === "assignment" && assignmentId) {
      const answers: Array<{ n: number; u: string | string[] | null }> = [];
      questions.forEach((q, idx) => {
        if (q.type === "group") return;
        answers.push({ n: q.number, u: userAnswers[idx] ?? null });
      });
      fetch(`/api/assignments/${assignmentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }).catch(() => {});
      setShowResults(true);
      return;
    }

    setShowResults(true);
    const answeredCount = userAnswers.filter((a, idx) => questions[idx]?.type !== "group" && a !== null).length;
    const correctCount = questions.filter((q, idx) => q.type !== "group" && gradeAnswer(q, userAnswers[idx])).length;
    const timestamp = new Date().toISOString();
    const compactAnswers = questions.map((q, idx) => ({ n: q.number, u: userAnswers[idx] ?? null }));
    try { sessionStorage.setItem(`quiz_replay_${timestamp}`, JSON.stringify({ answers: compactAnswers })); } catch {}

    if (isRetryWrongMode) return;
    if (!session?.user?.email || answeredCount === 0) return;
    fetch("/api/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answered: answeredCount,
        correct: correctCount,
        set: listTitle
          ? `個人試卷${listTitle}`
          : `${pageTitle}@@${levels ? `${id}:${levels}` : id}`,
        answers: compactAnswers,
      }),
    }).catch(() => {});
  }, [userAnswers, questions, isRetryWrongMode, session?.user?.email, id, listTitle, levels, listId, pageTitle, mode, assignmentId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (showResults) return;
      if (e.key === "Enter") { checkAnswers(); return; }
      const keyMap: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
      const label = keyMap[e.key];
      if (!label) return;
      const q = questions[focusedIdx];
      if (!q) return;
      const qt = q.type ?? "single";
      if (qt === "fill" || qt === "group") return;
      if (!q.options.some(o => o.label === label)) return;
      if (qt === "multiple") {
        setAllUserAnswers(prev => {
          const answerIdx = pageStart + focusedIdx;
          const current = (prev[answerIdx] as string[] | null) ?? [];
          const next = [...prev];
          const updated = current.includes(label) ? current.filter(l => l !== label) : [...current, label];
          next[answerIdx] = updated.length > 0 ? updated : null;
          return next;
        });
      } else {
        setAllUserAnswers(prev => { const next = [...prev]; next[pageStart + focusedIdx] = label; return next; });
        setFocusedIdx(prev => {
          const nextUnanswered = questions.findIndex((_, i) => i > prev && userAnswers[i] === null);
          return nextUnanswered !== -1 ? nextUnanswered : prev;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, userAnswers, questions, focusedIdx, pageStart, checkAnswers]);

  useEffect(() => {
    const el = questionRefs.current[focusedIdx];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIdx]);

  useEffect(() => {
    if (checkedIdxs.size === 0) { 
      if (!showResults) {
        setShareText(null); 
        setShareTitle(pageTitle);
        setShareScoreCard(null);
      }
      return; 
    }
    const text = questions
      .filter((_, i) => checkedIdxs.has(i))
      .map(q => {
        const numLine = id !== "englishWords" && ordered ? `#${q.number}\n` : "";
        const opts = q.options.length ? "\n" + q.options.map(o => `${o.label}. ${o.text}`).join("  ") : "";
        return `${numLine}${q.title}${opts}`;
      })
      .join("\n\n");
    setShareTitle(pageTitle);
    setShareScoreCard(null);
    setShareText(text + `\n\n${L.shareFrom}`);
  }, [checkedIdxs, questions, id, ordered, setShareText, setShareTitle, setShareScoreCard, pageTitle]);

  useEffect(() => {
    return () => { setShareText(null); setShareTitle(null); setShareScoreCard(null); };
  }, [setShareText, setShareTitle, setShareScoreCard]);

  useEffect(() => {
    if (!showResults || checkedIdxs.size > 0) return;
    const gradableQs = questions.filter(q => q.type !== "group");
    const total = gradableQs.length;
    if (total === 0) { setShareText(null); setShareTitle(pageTitle); return; }
    const correctCount = gradableQs.filter((q, _) => {
      const idx = questions.indexOf(q);
      return gradeAnswer(q, userAnswers[idx]);
    }).length;
    const score = Math.round((correctCount / total) * 100);
    const url = typeof window !== "undefined" ? window.location.href : "https://exam.farm";
    const card = L.shareScoreCard(score, pageTitle);
    setShareTitle(pageTitle);
    setShareScoreCard(card);
    setShareText(url);
  }, [showResults, checkedIdxs.size, questions, userAnswers, pageTitle, L, setShareText, setShareTitle, setShareScoreCard]);

  const handleSingleAnswerAt = (idx: number, answer: string) => {
    setAllUserAnswers(prev => { const next = [...prev]; next[pageStart + idx] = answer; return next; });
  };

  const handleMultipleToggleAt = (idx: number, label: string) => {
    setAllUserAnswers(prev => {
      const answerIdx = pageStart + idx;
      const current = (prev[answerIdx] as string[] | null) ?? [];
      const next = [...prev];
      const updated = current.includes(label) ? current.filter(l => l !== label) : [...current, label];
      next[answerIdx] = updated.length > 0 ? updated : null;
      return next;
    });
  };

  const handleFillChangeAt = (idx: number, value: string) => {
    setAllUserAnswers(prev => { const next = [...prev]; next[pageStart + idx] = value || null; return next; });
  };

  const resetQuiz = () => {
    const orig = originalQuestionsRef.current;
    const hasGroups = orig.some(q => q.type === "group");
    const displayed = (ordered || hasGroups) ? orig : shuffle(orig);
    setIsRetryWrongMode(false);
    setShowResults(false);
    setAllQuestions(displayed);
    setAllUserAnswers(new Array(displayed.length).fill(null));
    setPageIndex(0);
    setPageSize(quizPageSize);
    setCheckedIdxs(new Set());
    setFocusedIdx(0);
  };

  const retryWrong = () => {
    const wrong = questions.filter((q, idx) => q.type !== "group" && userAnswers[idx] !== null && !gradeAnswer(q, userAnswers[idx]));
    if (wrong.length === 0) return;
    setIsRetryWrongMode(true);
    setAllQuestions(wrong);
    setShowResults(false);
    setAllUserAnswers(new Array(wrong.length).fill(null));
    setPageIndex(0);
    setPageSize(quizPageSize);
    setCheckedIdxs(new Set());
    setFocusedIdx(0);
  };

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const handleAbandon = () => {
    setShowAbandonModal(false);
    if (beforeUnloadHandlerRef.current) {
      window.removeEventListener("beforeunload", beforeUnloadHandlerRef.current);
      beforeUnloadHandlerRef.current = null;
    }
    const nav = pendingNavRef.current ?? (() => { window.location.href = "/"; });
    pendingNavRef.current = null;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {}).finally(nav);
    } else {
      nav();
    }
  };

  const handleStay = () => {
    setShowAbandonModal(false);
    pendingNavRef.current = null;
    document.documentElement.requestFullscreen()
      .then(() => (navigator as any).keyboard?.lock?.(["Escape"]).catch(() => {}))
      .catch(() => {});
  };

  const answeredCount = userAnswers.filter((a, idx) => questions[idx]?.type !== "group" && a !== null).length;
  const correctCount = questions.filter((q, idx) => q.type !== "group" && gradeAnswer(q, userAnswers[idx])).length;

  const goToQuestionPage = (direction: -1 | 1) => {
    const next = Math.max(0, Math.min(pageIndex + direction, totalPages - 1));
    if (next === pageIndex) return;
    setPageIndex(next);
    setShowResults(false);
    setCheckedIdxs(new Set());
    setFocusedIdx(0);
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
      {isLoading && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: "var(--zen-bg)" }}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 rounded-full animate-spin" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 20%, transparent)", borderTopColor: "#b19739" }} />
            <p className="text-sm opacity-60" style={{ color: "var(--zen-ink)" }}>{L.loading}</p>
          </div>
        </div>
      )}
      {showAbandonModal && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50" onClick={forcedAbandon ? undefined : handleStay} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-80 rounded-2xl border shadow-xl p-8 flex flex-col gap-6"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            {forcedAbandon ? (
              <>
                <div className="flex flex-col gap-2 text-center">
                  <h2 className="text-lg font-semibold" style={{ color: "#ef4444" }}>{L.examTerminated}</h2>
                  <p className="text-sm opacity-60" style={{ color: "var(--zen-ink)" }}>{L.leftPage}</p>
                </div>
                <button
                  onClick={handleAbandon}
                  className="w-full py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                  style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)" }}
                >
                  {L.confirm}
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2 text-center">
                  <h2 className="text-lg font-semibold" style={{ color: "var(--zen-ink)" }}>{L.abandonTitle}</h2>
                  <p className="text-sm opacity-60" style={{ color: "var(--zen-ink)" }}>{L.abandonBody}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleStay}
                    className="flex-1 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                    style={{ borderColor: "#D1D5DB", color: "#D1D5DB", backgroundColor: "color-mix(in srgb, #D1D5DB 10%, transparent)" }}
                  >
                    {L.continueBtn}
                  </button>
                  <button
                    onClick={handleAbandon}
                    className="flex-1 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                    style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)" }}
                  >
                    {L.abandonBtn}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      {formalMode && !started && (
        <div ref={overlayRef} className="fixed inset-0 sm:left-24 z-50 flex items-center justify-center" style={{ backgroundColor: "var(--zen-bg)" }}>
          <div className="flex flex-col items-center gap-8 px-8 py-12 rounded-2xl" style={{ backgroundColor: "var(--zen-paper)" }}>
            <h1 className="text-2xl font-bold text-center zen-title" style={{ color: "#b19739" }}>{pageTitle}</h1>
            <p className="text-s text-center opacity-65" style={{ color: "var(--zen-ink)" }}>{L.formalWarning}</p>
            <button
              disabled={questions.length === 0}
              onClick={() => {
                if (overlayRef.current) overlayRef.current.style.display = "none";
                setStarted(true);
                document.documentElement.requestFullscreen().catch(() => {});
              }}
              className="px-10 py-3 rounded-full text-base font-medium transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#D1D5DB", color: "#fff" }}
            >
              {L.start}
            </button>
          </div>
        </div>
      )}
      <main className="flex w-full max-w-[1400px] flex-col items-start justify-start pt-[12vh] pb-24 sm:pb-8 px-6 sm:px-16 bg-transparent dark:bg-black sm:items-start">
        <div className="flex items-center justify-between w-full sticky top-0 z-10 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
          <h1 className="text-2xl font-bold zen-title">
            {showResults && mode === "assignment" && <span>已提交</span>}
            {showResults && mode !== "assignment" && <span>{L.score(correctCount, answeredCount)}</span>}
          </h1>
        </div>

        {/* 浮動操作列：固定在右下角 */}
        <div
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-wrap items-center justify-end gap-2 sm:gap-3 px-3 py-2 rounded-full"
          style={{ backgroundColor: "color-mix(in srgb, var(--zen-bg) 92%, transparent)", backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => goToQuestionPage(-1)}
              disabled={!canGoPrevPage}
              className="px-4 py-2 border rounded-full text-sm transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "transparent", borderColor: "#b19739", color: "#b19739" }}
            >
              {L.prevPage}
            </button>
            <button
              type="button"
              onClick={() => goToQuestionPage(1)}
              disabled={!canGoNextPage}
              className="px-4 py-2 border rounded-full text-sm transition-opacity hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: "transparent", borderColor: "#b19739", color: "#b19739" }}
            >
              {L.nextPage}
            </button>
          </div>
          {!showResults ? (
            <>
            {session?.user && (
              <BulkAddToListButton
                questions={questions
                  .map((q, i) => ({ q, i }))
                  .filter(({ i }) => checkedIdxs.has(i))
                  .map(({ q }) => ({
                    questionId: q.id,
                    collectionId: id,
                    title: q.title,
                    number: q.number,
                    level: q.level,
                  }))}
              />
            )}
            <button
              onClick={checkAnswers}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#b19739"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent"; }}
              className="px-4 py-2 border rounded-full text-sm cursor-pointer hover:opacity-90 transition-opacity"
              style={{ background: "transparent", borderColor: "transparent", color: "#b19739" }}
            >
              {mode === "assignment" ? "提交" : L.submit}
            </button>
            </>
          ) : (
            <>
            {mode !== "assignment" && session && (
              <button
                onClick={retryWrong}
                disabled={questions.every((q, idx) => q.type === "group" || userAnswers[idx] === null || gradeAnswer(q, userAnswers[idx]))}
                className="px-4 py-2 border rounded-full text-sm disabled:opacity-30"
                style={{ borderColor: "#b19739", color: "#b19739", background: "transparent" }}
              >
                {L.retryWrong}
              </button>
            )}
            <button
              onClick={resetQuiz}
              className="px-4 py-2 border rounded-full bg-white text-black dark:bg-white dark:text-black text-sm"
            >
              {mode === "assignment" ? "重新作答" : L.restart}
            </button>
            </>
          )}
        </div>

        <div className="mt-4 w-full grid grid-cols-1 sm:gap-x-8 divide-y sm:divide-y-0 divide-zinc-100 dark:divide-zinc-800" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {questions.map((q, idx) => {
            const qt = q.type ?? "single";
            const ans = userAnswers[idx];
            // GSAT legacy: groupContent field on question itself
            const showGroupContent = qt !== "group" && q.groupContent && (idx === 0 || questions[idx - 1]?.groupContent !== q.groupContent);
            const isWrongResult = showResults && mode !== "assignment" && qt !== "group" && !gradeAnswer(q, ans);
            return (
              <React.Fragment key={idx}>
                {showGroupContent && (
                  <div
                    style={{ gridColumn: "1 / -1" }}
                    className="mt-4 mb-1 p-4 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm whitespace-pre-wrap leading-7"
                  >
                    <span className="block text-xs font-semibold text-zinc-400 mb-2">{L.groupLabel}</span>
                    {q.groupContent}
                  </div>
                )}
                {qt === "group" ? (
                  <div
                    style={{ gridColumn: "1 / -1" }}
                    className="mt-4 mb-1 p-4 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm whitespace-pre-wrap leading-7"
                  >
                    <span className="block text-xs font-semibold text-zinc-400 mb-2">{L.groupLabel}{q.groupRange ? ` (${q.groupRange})` : ""}</span>
                    <RenderContent>{q.title || q.groupContent || L.noGroupText}</RenderContent>
                  </div>
                ) : (
                  <div
                    ref={el => { questionRefs.current[idx] = el; }}
                    className="py-4"
                    onClick={() => { if (!showResults) setFocusedIdx(idx); }}
                  >
                  <div className="flex items-center gap-2 text-sm mb-2">
                    {session?.user && (
                      <button
                        type="button"
                        onClick={() => setCheckedIdxs(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; })}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${checkedIdxs.has(idx) ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black" : "border-zinc-400 dark:border-zinc-500"}`}
                        aria-label={L.checkLabel}
                      >
                        {checkedIdxs.has(idx) && "✓"}
                      </button>
                    )}
                    {id !== "englishWords" && ordered && <span style={{ color: "var(--zen-ink)" }}>#{q.number}</span>}
                    {qt === "multiple" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">{L.multipleBadge}</span>}
                    {qt === "fill" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">{L.fillBadge}</span>}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base rounded transition-all" style={{ color: "var(--zen-ink)", backgroundColor: idx === focusedIdx && !showResults && qt !== "fill" ? "rgba(209,213,219,0.2)" : "transparent" }}><RenderContent inline>{q.title}</RenderContent></span>
                    {id === "englishWords" && (
                      <button type="button" onClick={() => speakQuestion(q.title)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-white hover:bg-zinc-600" aria-label={L.speakLabel}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                      </button>
                    )}
                  </div>
                  {qt === "fill" ? (
                    <>
                      {(() => {
                        const showCorrectFill = showResults && ans !== null && !isWrongResult;
                        return (
                      <input
                        type="text"
                        value={(ans as string) ?? ""}
                        onChange={e => handleFillChangeAt(idx, e.target.value)}
                        readOnly={showResults}
                        placeholder={L.fillPlaceholder}
                        className="w-full px-3 py-2 border rounded text-sm outline-none"
                        style={{
                          backgroundColor: "var(--zen-bg)",
                          color: "var(--zen-ink)",
                          borderColor: isWrongResult ? "#ef4444" : showCorrectFill ? "#16a34a" : undefined,
                          borderWidth: isWrongResult ? "1.5px" : undefined,
                        }}
                      />
                        );
                      })()}
                      {showResults && mode !== "assignment" && ans !== null && !isWrongResult && (
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 text-sm font-semibold rounded" style={{ border: "1.5px solid #16a34a", color: "#16a34a" }}>
                          <span aria-hidden="true">✓</span>
                          <span>{L.correct}</span>
                        </div>
                      )}
                      {isWrongResult && (
                        <div className="mt-2 inline-block px-2 py-0.5 text-sm font-semibold rounded" style={{ border: "1.5px solid #ef4444", color: "#ef4444" }}>
                          {L.correctAnswer}{q.answer as string}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-wrap">
                      {q.options.map(option => {
                        const isSel = qt === "multiple"
                          ? ((ans as string[] | null) ?? []).includes(option.label)
                          : ans === option.label;
                        const isCorrectOpt = qt === "multiple"
                          ? Array.isArray(q.answer) && (q.answer as string[]).includes(option.label)
                          : q.answer != null && q.answer === option.label;
                        const isUnanswered = showResults && ans === null;
                        // After submit, correct options are green when answered; red when unanswered.
                        const showCorrectFrameGreen = showResults && mode !== "assignment" && isCorrectOpt && !isUnanswered;
                        const showCorrectFrameRed = showResults && mode !== "assignment" && isCorrectOpt && isUnanswered;
                        // After submit, wrong selected options get red background only.
                        const showWrongSel = showResults && mode !== "assignment" && isSel && !isCorrectOpt;
                        return (
                          <button
                            key={option.label}
                            onClick={() => {
                              if (showResults) return;
                              qt === "multiple" ? handleMultipleToggleAt(idx, option.label) : handleSingleAnswerAt(idx, option.label);
                            }}
                            className="px-2 py-1.5 text-left text-sm rounded transition-colors"
                            onMouseEnter={e => { if (!showResults) (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(209,213,219,0.2)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; }}
                            style={{
                              color: "var(--zen-ink)",
                              border: showCorrectFrameGreen
                                ? "1.5px solid #16a34a"
                                : showCorrectFrameRed
                                ? "1.5px solid #ef4444"
                                : isSel
                                ? "1px solid var(--zen-ink)"
                                : "1.5px solid transparent",
                              backgroundColor: undefined,
                              textDecoration: showWrongSel ? "line-through" : undefined,
                              textDecorationColor: showWrongSel ? "#ef4444" : undefined,
                              textDecorationThickness: showWrongSel ? "2px" : undefined,
                              cursor: showResults ? "default" : "pointer",
                            }}
                          >
                            <span className="font-semibold">{option.label}</span>{" "}
                            <RenderContent inline>{option.text}</RenderContent>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
        {showResults && mode !== "assignment" && (
          <div className="flex justify-end items-center gap-2 mt-6 w-full">
            {(() => {
              const answeredIdxs = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => q.type !== "group" && userAnswers[i] !== null).map(({ i }) => i);
              const allChecked = answeredIdxs.length > 0 && answeredIdxs.every(i => checkedIdxs.has(i));
              const wrongIdxs = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => q.type !== "group" && userAnswers[i] !== null && !gradeAnswer(q, userAnswers[i])).map(({ i }) => i);
              const allWrongChecked = wrongIdxs.length > 0 && wrongIdxs.every(i => checkedIdxs.has(i));
              return (
                <>
                  {session?.user && (
                    <>
                      <button
                        type="button"
                        onClick={() => setCheckedIdxs(allChecked ? new Set() : new Set(answeredIdxs))}
                        className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        style={{ color: "var(--zen-ink)" }}
                      >
                        {allChecked ? L.deselectAll : L.selectAll}
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckedIdxs(allWrongChecked ? new Set() : new Set(wrongIdxs))}
                        className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                        style={{ color: "var(--zen-ink)" }}
                      >
                        {allWrongChecked ? L.deselectWrong : L.selectWrong}
                      </button>
                    </>
                  )}
                  <BulkAddToListButton
                    questions={questions
                      .map((q, i) => ({ q, i }))
                      .filter(({ i }) => checkedIdxs.has(i))
                      .map(({ q }) => ({
                        questionId: q.id,
                        collectionId: id,
                        title: q.title,
                        number: q.number,
                        level: q.level,
                      }))}
                  />
                </>
              );
            })()}
          </div>
        )}
        {ownerName && (
          <div className="mt-8 text-xs opacity-60" style={{ color: "var(--zen-ink)" }}>
            <span>{L.createdBy} </span>
            <Link
              href={`/${encodeURIComponent(ownerName)}`}
              className="hover:opacity-80 underline-offset-2 hover:underline"
            >
              @{ownerName}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
