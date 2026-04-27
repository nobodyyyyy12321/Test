"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { BulkAddToListButton } from "../../components/AddToListButton";
import { useShare } from "../../providers/ShareProvider";
import type { Question } from "../../../lib/questions-firebase";
import RenderContent from "../../components/RenderContent";
import { useTimer } from "../../providers/TimerContext";

const QUIZ_GUARD_STATE = { __quizGuard: true };

function gradeAnswer(question: Question, userAns: string | string[] | null): boolean {
  if (userAns === null) return false;
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
  pageTitle: string;
  replayKey?: string | null;
  autostart?: boolean;
};

export default function TestClient({ id, ordered, listId, listTitle, levels, pageTitle, replayKey, autostart }: Props) {
  const { data: session } = useSession();
  const { enabled: timerEnabled, running: timerRunning, finished: timerFinished, mode: timerMode, start: timerStart, stop: timerStop, reset: timerReset } = useTimer();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [userAnswers, setUserAnswers] = useState<(string | string[] | null)[]>([]);
  const originalQuestionsRef = useRef<Question[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(new Set());
  const [formalMode, setFormalMode] = useState(false);
  const [started, setStarted] = useState(!!autostart);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const pendingNavRef = useRef<(() => void) | null>(null);
  const beforeUnloadHandlerRef = useRef<((e: BeforeUnloadEvent) => void) | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const questionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useLayoutEffect(() => {
    const isFormal = localStorage.getItem("quizMode") === "formal";
    if (isFormal) setFormalMode(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleLinkClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      kbd?.unlock?.();
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleLinkClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      history.go(-1); // remove sentinel entry
    };
  }, [formalMode, started, showResults]);

  useEffect(() => {
    // replay mode: load stored answers, fetch questions to match
    if (replayKey) {
      try {
        const stored = sessionStorage.getItem(`quiz_replay_${replayKey}`);
        if (stored) {
          const { answers: storedAnswers }: { answers: { n: number; u: string | string[] | null }[] } = JSON.parse(stored);
          const params = new URLSearchParams({ id });
          if (levels) params.set("levels", levels);
          if (listId) params.set("listId", listId);
          fetch(`/api/questions?${params}`)
            .then(r => r.json())
            .then(({ questions: qs }: { questions: Question[] }) => {
              const sorted = [...qs].sort((a, b) => a.number - b.number);
              const answerMap = new Map(storedAnswers.map(a => [a.n, a.u]));
              const displayed = sorted.filter(q => answerMap.has(q.number));
              const answers = displayed.map(q => answerMap.get(q.number) ?? null);
              originalQuestionsRef.current = sorted;
              setQuestions(displayed);
              setUserAnswers(answers);
              setShowResults(true);
            })
            .catch(() => {});
          return;
        }
      } catch {}
    }

    const params = new URLSearchParams({ id });
    if (levels) params.set("levels", levels);
    if (listId) params.set("listId", listId);
    fetch(`/api/questions?${params}`)
      .then(r => r.json())
      .then(({ questions: qs }: { questions: Question[] }) => {
        const sorted = [...qs].sort((a, b) => a.number - b.number);
        originalQuestionsRef.current = sorted;
        const shuffled = ordered ? sorted : shuffle(sorted);
        const displayed = id === "englishWords" ? shuffled.slice(0, 50) : shuffled;
        setQuestions(displayed);
        setUserAnswers(new Array(displayed.length).fill(null));
        if (!formalMode && timerEnabled) { timerReset(); timerStart(); }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { setShareText, setShareTitle } = useShare();

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
      if (qt === "fill") return;
      if (!q.options.some(o => o.label === label)) return;
      if (qt === "multiple") {
        handleMultipleToggleAt(focusedIdx, label);
      } else {
        handleSingleAnswerAt(focusedIdx, label);
        setFocusedIdx(prev => {
          const nextUnanswered = questions.findIndex((_, i) => i > prev && userAnswers[i] === null);
          return nextUnanswered !== -1 ? nextUnanswered : prev;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, userAnswers, questions, focusedIdx]);

  useEffect(() => {
    const el = questionRefs.current[focusedIdx];
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIdx]);

  useEffect(() => {
    if (checkedIdxs.size === 0) { setShareText(null); setShareTitle(null); return; }
    const text = questions
      .filter((_, i) => checkedIdxs.has(i))
      .map(q => {
        const numLine = id !== "englishWords" ? `#${q.number}\n` : "";
        const opts = q.options.length ? "\n" + q.options.map(o => `${o.label}. ${o.text}`).join("  ") : "";
        return `${numLine}${q.title}${opts}`;
      })
      .join("\n\n");
    setShareTitle(pageTitle);
    setShareText(text + "\n\nfrom testtttt.io");
  }, [checkedIdxs, questions, id, setShareText, setShareTitle, pageTitle]);

  useEffect(() => {
    return () => { setShareText(null); setShareTitle(null); };
  }, [setShareText, setShareTitle]);

  useEffect(() => {
    if (timerFinished && timerMode === "down" && !showResults) checkAnswers();
  }, [timerFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSingleAnswerAt = (idx: number, answer: string) => {
    setUserAnswers(prev => { const next = [...prev]; next[idx] = answer; return next; });
  };

  const handleMultipleToggleAt = (idx: number, label: string) => {
    setUserAnswers(prev => {
      const current = (prev[idx] as string[] | null) ?? [];
      const next = [...prev];
      const updated = current.includes(label) ? current.filter(l => l !== label) : [...current, label];
      next[idx] = updated.length > 0 ? updated : null;
      return next;
    });
  };

  const handleFillChangeAt = (idx: number, value: string) => {
    setUserAnswers(prev => { const next = [...prev]; next[idx] = value || null; return next; });
  };

  const checkAnswers = () => {
    setShowResults(true);
    if (timerEnabled && timerRunning) timerStop();
    const answeredCount = userAnswers.filter(a => a !== null).length;
    const correctCount = questions.filter((q, idx) => gradeAnswer(q, userAnswers[idx])).length;
    const timestamp = new Date().toISOString();
    const compactAnswers = questions.map((q, idx) => ({ n: q.number, u: userAnswers[idx] ?? null }));
    try { sessionStorage.setItem(`quiz_replay_${timestamp}`, JSON.stringify({ answers: compactAnswers })); } catch {}

    if (session?.user?.email) {
      const recordEndpoint = ordered
        ? "/api/user/gsat/record"
        : id === "quoteChinese"
        ? "/api/user/quote/record"
        : "/api/user/english/record";
      fetch(recordEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answered: answeredCount,
          correct: correctCount,
          set: listTitle ? `個人試卷${listTitle}` : levels ? `${id}:${levels}` : id,
          answers: compactAnswers,
        }),
      }).catch(() => {});

      if (listId) {
        fetch(`/api/lists/${listId}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answered: answeredCount, correct: correctCount }),
        }).catch(() => {});
      }
    }
  };

  const resetQuiz = () => {
    const orig = originalQuestionsRef.current;
    const displayed = ordered ? orig : shuffle(orig);
    setShowResults(false);
    setQuestions(displayed);
    setUserAnswers(new Array(displayed.length).fill(null));
    setCheckedIdxs(new Set());
    setFocusedIdx(0);
  };

  const retryWrong = () => {
    const wrong = questions.filter((q, idx) => userAnswers[idx] !== null && !gradeAnswer(q, userAnswers[idx]));
    if (wrong.length === 0) return;
    setQuestions(wrong);
    setShowResults(false);
    setUserAnswers(new Array(wrong.length).fill(null));
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

  const answeredCount = userAnswers.filter(a => a !== null).length;
  const correctCount = questions.filter((q, idx) => gradeAnswer(q, userAnswers[idx])).length;

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
      {showAbandonModal && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50" onClick={handleStay} />
          <div
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-80 rounded-2xl border shadow-xl p-8 flex flex-col gap-6"
            style={{ backgroundColor: "var(--zen-bg)", borderColor: "color-mix(in srgb, var(--zen-ink) 15%, transparent)" }}
          >
            <div className="flex flex-col gap-2 text-center">
              <h2 className="text-lg font-semibold" style={{ color: "var(--zen-ink)" }}>放棄測驗？</h2>
              <p className="text-sm opacity-60" style={{ color: "var(--zen-ink)" }}>離開後將無法繼續本次測驗</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleStay}
                className="flex-1 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                style={{ borderColor: "#5fa870", color: "#5fa870", backgroundColor: "color-mix(in srgb, #5fa870 10%, transparent)" }}
              >
                繼續作答
              </button>
              <button
                onClick={handleAbandon}
                className="flex-1 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                style={{ borderColor: "#ef4444", color: "#ef4444", backgroundColor: "color-mix(in srgb, #ef4444 10%, transparent)" }}
              >
                放棄測驗
              </button>
            </div>
          </div>
        </>
      )}
      {formalMode && !started && (
        <div ref={overlayRef} className="fixed inset-0 sm:left-24 z-50 flex items-center justify-center" style={{ backgroundColor: "var(--zen-bg)" }}>
          <div className="flex flex-col items-center gap-8 px-8 py-12 rounded-2xl" style={{ backgroundColor: "var(--zen-paper)" }}>
            <span className="text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: "#b19739", color: "#b19739" }}>正式模式</span>
            <h1 className="text-2xl font-bold text-center zen-title" style={{ color: "#b19739" }}>{pageTitle}</h1>
            <button
              disabled={questions.length === 0}
              onClick={() => {
                if (overlayRef.current) overlayRef.current.style.display = "none";
                setStarted(true);
                if (timerEnabled) { timerReset(); timerStart(); }
                document.documentElement.requestFullscreen().catch(() => {});
              }}
              className="px-10 py-3 rounded-full text-base font-medium transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#5fa870", color: "#fff" }}
            >
              開始
            </button>
          </div>
        </div>
      )}
      <main className="flex w-full max-w-[1400px] flex-col items-start justify-start pt-[12vh] pb-24 sm:pb-8 px-6 sm:px-16 bg-transparent dark:bg-black sm:items-start">
        <div className="flex items-center justify-between w-full sticky top-0 z-10 py-2" style={{ backgroundColor: "var(--zen-bg)" }}>
          <h1 className="text-3xl font-bold zen-title"></h1>
          {!showResults && (
            <div className="flex items-center gap-3">
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
                交卷
              </button>
            </div>
          )}
        </div>

        {!showResults ? (
          <div className="mt-4 w-full grid grid-cols-1 sm:gap-x-8 divide-y sm:divide-y-0 divide-zinc-100 dark:divide-zinc-800" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {questions.map((q, idx) => {
              const qt = q.type ?? "single";
              const ans = userAnswers[idx];
              const showGroupContent = q.groupContent && (idx === 0 || questions[idx - 1].groupContent !== q.groupContent);
              return (
                <React.Fragment key={idx}>
                  {showGroupContent && (
                    <div className="my-4 p-3 border border-zinc-300 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-900 text-sm whitespace-pre-wrap leading-6 self-start">
                      {q.groupContent}
                    </div>
                  )}
                  <div
                    ref={el => { questionRefs.current[idx] = el; }}
                    className="py-4"
                    onClick={() => setFocusedIdx(idx)}
                  >
                    <div className="flex items-center gap-2 text-sm mb-2">
                      {session?.user && (
                        <button
                          type="button"
                          onClick={() => setCheckedIdxs(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; })}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${checkedIdxs.has(idx) ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black" : "border-zinc-400 dark:border-zinc-500"}`}
                          aria-label="勾選"
                        >
                          {checkedIdxs.has(idx) && "✓"}
                        </button>
                      )}
                      {id !== "englishWords" && <span style={{ color: "#5fa870" }}>#{q.number}</span>}
                      {qt === "multiple" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">多選</span>}
                      {qt === "fill" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">填充</span>}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base rounded transition-all" style={{ color: "#5fa870", backgroundColor: idx === focusedIdx && !showResults && qt !== "fill" ? "rgba(95,168,112,0.15)" : "transparent" }}><RenderContent inline>{q.title}</RenderContent></span>
                      {id === "englishWords" && (
                        <button type="button" onClick={() => speakQuestion(q.title)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-700 text-white hover:bg-zinc-600" aria-label="朗讀英文">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
                        </button>
                      )}
                    </div>
                    {qt === "fill" ? (
                      <input
                        type="text"
                        value={(ans as string) ?? ""}
                        onChange={e => handleFillChangeAt(idx, e.target.value)}
                        placeholder="輸入答案"
                        className="w-full px-3 py-2 border border-zinc-400 dark:border-zinc-600 rounded text-sm outline-none"
                        style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                      />
                    ) : (
                      <div className="flex flex-wrap">
                        {q.options.map(option => {
                          const isSel = qt === "multiple"
                            ? ((ans as string[] | null) ?? []).includes(option.label)
                            : ans === option.label;
                          return (
                            <button
                              key={option.label}
                              onClick={() => qt === "multiple" ? handleMultipleToggleAt(idx, option.label) : handleSingleAnswerAt(idx, option.label)}
                              className="px-2 py-1.5 text-left text-sm rounded transition-colors"
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(95,168,112,0.15)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = ""; }}
                              style={{
                                color: "#5fa870",
                                border: isSel ? "1.5px solid #5fa870" : "1.5px solid transparent",
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
                </React.Fragment>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 space-y-4 w-full">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">寫 {correctCount}/{answeredCount}</div>
              <div className="flex gap-2">
                {session && (
                  <button
                    onClick={retryWrong}
                    disabled={questions.every((q, idx) => userAnswers[idx] === null || gradeAnswer(q, userAnswers[idx]))}
                    className="px-4 py-2 border rounded-full text-sm disabled:opacity-30"
                    style={{ borderColor: "#b19739", color: "#b19739", background: "transparent" }}
                  >
                    錯題重練
                  </button>
                )}
                <button
                  onClick={resetQuiz}
                  className="px-4 py-2 border rounded-full bg-white text-black dark:bg-white dark:text-black text-sm"
                >
                  重新開始
                </button>
              </div>
            </div>
            <h2 className="text-2xl font-bold mt-6">答題結果</h2>
            <div className="space-y-3">
              {questions.map((question, idx) => {
                const userAns = userAnswers[idx];
                if (userAns === null) return null;
                const isCorrect = gradeAnswer(question, userAns);
                const qt = question.type ?? "single";

                const renderUserAns = () => {
                  if (qt === "fill") return <span>{userAns as string}</span>;
                  if (qt === "multiple") {
                    return (userAns as string[]).map(l => {
                      const opt = question.options.find(o => o.label === l);
                      return <span key={l} className="mr-1">{l} {opt && <RenderContent inline>{opt.text}</RenderContent>}</span>;
                    });
                  }
                  const opt = question.options.find(o => o.label === userAns);
                  return <span>{userAns as string} {opt && <RenderContent inline>{opt.text}</RenderContent>}</span>;
                };

                const renderCorrectAns = () => {
                  if (qt === "fill") return <span>{question.answer as string}</span>;
                  if (qt === "multiple") {
                    return (question.answer as string[]).map(l => {
                      const opt = question.options.find(o => o.label === l);
                      return <span key={l} className="mr-1">{l} {opt && <RenderContent inline>{opt.text}</RenderContent>}</span>;
                    });
                  }
                  const opt = question.options.find(o => o.label === question.answer);
                  return <span>{question.answer as string} {opt && <RenderContent inline>{opt.text}</RenderContent>}</span>;
                };

                const isChecked = checkedIdxs.has(idx);
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/10" : "border-red-500 bg-red-50 dark:bg-red-900/10"}`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {session?.user && (
                        <button
                          type="button"
                          onClick={() => setCheckedIdxs(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; })}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${isChecked ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black" : "border-zinc-400 dark:border-zinc-500"}`}
                          aria-label="勾選"
                        >
                          {isChecked && "✓"}
                        </button>
                      )}
                      <p className="font-medium flex-1">題號{question.number}：<RenderContent inline>{question.title}</RenderContent></p>
                    </div>
                    <div className="text-sm space-y-1 pl-7">
                      <p>你的答案：<span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isCorrect ? "bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-400"}`}>{renderUserAns()}</span></p>
                      {!isCorrect && (
                        <p>正確答案：<span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400">{renderCorrectAns()}</span></p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end items-center gap-2 mt-6">
              {(() => {
                const answeredIdxs = questions.map((_, i) => i).filter(i => userAnswers[i] !== null);
                const allChecked = answeredIdxs.length > 0 && answeredIdxs.every(i => checkedIdxs.has(i));
                const wrongIdxs = questions.map((q, i) => ({ q, i })).filter(({ q, i }) => userAnswers[i] !== null && !gradeAnswer(q, userAnswers[i])).map(({ i }) => i);
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
                          {allChecked ? "取消全選" : "全選"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setCheckedIdxs(allWrongChecked ? new Set() : new Set(wrongIdxs))}
                          className="text-xs px-3 py-1.5 rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                          style={{ color: "var(--zen-ink)" }}
                        >
                          {allWrongChecked ? "取消勾選" : "勾選答錯題"}
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
          </div>
        )}
      </main>
    </div>
  );
}
