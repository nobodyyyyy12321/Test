"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { BulkAddToListButton } from "../../components/AddToListButton";
import { useShare } from "../../providers/ShareProvider";
import type { Question } from "../../../lib/questions-firebase";
import RenderContent from "../../components/RenderContent";
import { useTimer } from "../../providers/TimerContext";

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
  initialQuestions: Question[];
  ordered: boolean;
  listId: string | null;
  listTitle: string | null;
  levels: string | null;
  pageTitle: string;
};

export default function TestClient({ id, initialQuestions, ordered, listId, listTitle, levels, pageTitle }: Props) {
  const { data: session } = useSession();
  const { enabled: timerEnabled, running: timerRunning, start: timerStart, stop: timerStop, reset: timerReset } = useTimer();
  const [questions, setQuestions] = useState<Question[]>(() =>
    [...initialQuestions].sort((a, b) => a.number - b.number)
  );

  useEffect(() => {
    if (!ordered) setQuestions(shuffle(initialQuestions));
    if (timerEnabled) { timerReset(); timerStart(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [userAnswers, setUserAnswers] = useState<(string | string[] | null)[]>(() =>
    new Array(initialQuestions.length).fill(null)
  );
  const [showResults, setShowResults] = useState(false);
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(new Set());
  const { setShareText, setShareTitle } = useShare();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!showResults && e.key === "Enter") checkAnswers();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, userAnswers, questions]);

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
    setShowResults(false);
    setQuestions(ordered ? [...initialQuestions].sort((a, b) => a.number - b.number) : shuffle(initialQuestions));
    setUserAnswers(new Array(questions.length).fill(null));
    setCheckedIdxs(new Set());
  };

  const retryWrong = () => {
    const wrong = questions.filter((q, idx) => userAnswers[idx] !== null && !gradeAnswer(q, userAnswers[idx]));
    if (wrong.length === 0) return;
    setQuestions(wrong);
    setShowResults(false);
    setUserAnswers(new Array(wrong.length).fill(null));
    setCheckedIdxs(new Set());
  };

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  const answeredCount = userAnswers.filter(a => a !== null).length;
  const correctCount = questions.filter((q, idx) => gradeAnswer(q, userAnswers[idx])).length;

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
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
                  <div className="py-4">
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
                      <span className="text-base" style={{ color: "#5fa870" }}><RenderContent inline>{q.title}</RenderContent></span>
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
