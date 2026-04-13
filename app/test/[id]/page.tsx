"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useSearchParams } from "next/navigation";
import { AddToListButton, BulkAddToListButton } from "../../components/AddToListButton";

type Option = {
  label: string;
  text: string;
};

type Question = {
  id: string;
  number: number;
  title: string;
  type?: "single" | "multiple" | "fill";
  options: Option[];
  answer: string | string[];
  level?: number | null;
  groupContent?: string | null;
};

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

export default function QuotePage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | string[] | null)[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [checkedIdxs, setCheckedIdxs] = useState<Set<number>>(new Set());
  const [listTitle, setListTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const shuffleQuestions = (items: Question[]) => {
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const listId = searchParams.get("listId");
    const levels = searchParams.get("levels");

    if (listId) {
      fetch(`/api/lists/${listId}`)
        .then(r => r.json())
        .then(d => { if (d.list?.title) setListTitle(d.list.title); })
        .catch(() => {});
    } else {
      setListTitle(null);
    }

    const ordered = searchParams.get("ordered") === "true";
    const url = listId
      ? `/api/questions?listId=${listId}`
      : levels ? `/api/questions?id=${id}&levels=${levels}` : `/api/questions?id=${id}`;

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.questions) {
          const loadedQuestions: Question[] = ordered
            ? [...data.questions].sort((a, b) => a.number - b.number)
            : shuffleQuestions(data.questions);
          setQuestions(loadedQuestions);
          setUserAnswers(new Array(loadedQuestions.length).fill(null));
          setCurrentIndex(0);
        }
      })
      .catch(err => console.error("Failed to load questions:", err));
  }, [id, searchParams]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (showResults) return;

      const qtype = questions[currentIndex]?.type ?? "single";
      if (qtype === "single") {
        const keyToOption: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
        const k = keyToOption[e.key] ?? e.key.toUpperCase();
        if (["A", "B", "C", "D"].includes(k)) handleSingleAnswer(k);
      }
      if (e.key === "Enter") checkAnswers();
      if (e.key === "ArrowLeft" && currentIndex > 0) setCurrentIndex(currentIndex - 1);
      if (e.key === "ArrowRight") setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1));
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, userAnswers, currentIndex, questions]);

  const handleSingleAnswer = (answer: string) => {
    if (currentIndex >= questions.length) return;
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = answer;
    setUserAnswers(newAnswers);
    if (currentIndex < questions.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 200);
    }
  };

  const handleMultipleToggle = (label: string) => {
    const current = (userAnswers[currentIndex] as string[] | null) ?? [];
    const next = current.includes(label)
      ? current.filter(l => l !== label)
      : [...current, label];
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = next.length > 0 ? next : null;
    setUserAnswers(newAnswers);
  };

  const handleFillChange = (value: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentIndex] = value || null;
    setUserAnswers(newAnswers);
  };

  const checkAnswers = () => {
    setShowResults(true);
    const answeredCount = userAnswers.filter(a => a !== null).length;
    const correctCount = questions.filter((q, idx) => gradeAnswer(q, userAnswers[idx])).length;
    const listId = searchParams.get("listId");

    if (session?.user?.email) {
      const recordEndpoint = id === "quoteChinese" ? "/api/user/quote/record" : "/api/user/english/record";
      fetch(recordEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answered: answeredCount,
          correct: correctCount,
          set: listTitle ? `個人試卷${listTitle}` : searchParams.get("levels") ? `${id}:${searchParams.get("levels")}` : id,
        }),
      }).catch(err => console.error("Failed to save record:", err));

      if (listId) {
        fetch(`/api/lists/${listId}/result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answered: answeredCount, correct: correctCount }),
        }).catch(err => console.error("Failed to save shared result:", err));
      }
    }
  };

  const resetQuiz = () => {
    setShowResults(false);
    setCurrentIndex(0);
    setUserAnswers(new Array(questions.length).fill(null));
  };

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent dark:bg-black">
        <main className="w-full max-w-2xl p-8 text-center">
          <p className="text-sm zen-subtle">載入中...</p>
        </main>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const qtype = currentQuestion.type ?? "single";
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const correctCount = questions.filter((q, idx) => gradeAnswer(q, userAnswers[idx])).length;
  const currentAnswer = userAnswers[currentIndex];

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-start justify-start py-8 px-16 bg-transparent dark:bg-black sm:items-start">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-3xl font-bold zen-title"></h1>
          {!showResults && (
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className={`px-4 py-2 border rounded-full bg-white text-black text-sm transition-opacity ${currentIndex === 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
              >
                ←
              </button>
              <button
                onClick={() => setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1))}
                disabled={currentIndex === questions.length - 1}
                className={`px-4 py-2 border rounded-full bg-white text-black text-sm transition-opacity ${currentIndex === questions.length - 1 ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-90"}`}
              >
                →
              </button>
              <button
                onClick={checkAnswers}
                className="px-4 py-2 border rounded-full bg-white text-black text-sm cursor-pointer hover:opacity-90 transition-opacity"
              >
                交卷
              </button>
            </div>
          )}
        </div>

        {!showResults ? (
          <div className="mt-6 space-y-4 w-full">
            <div className="flex items-center gap-3 text-sm text-zinc-400">
              <span>題號{currentQuestion.number}</span>
              {qtype === "multiple" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">多選</span>}
              {qtype === "fill" && <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-400">填充</span>}
            </div>

            {currentQuestion.groupContent && (
              <div className="p-4 border border-zinc-300 dark:border-zinc-600 rounded bg-zinc-50 dark:bg-zinc-900 text-sm whitespace-pre-wrap leading-7">
                {currentQuestion.groupContent}
              </div>
            )}

            <div className="p-6 border border-[1px] rounded text-lg flex items-center justify-between gap-3">
              <span>{currentQuestion.title}</span>
              {id === "englishWords" && (
                <button
                  type="button"
                  onClick={() => speakQuestion(currentQuestion.title)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-zinc-700 text-white transition-colors hover:bg-zinc-600"
                  aria-label="朗讀英文"
                  title="朗讀英文"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                    <path d="M11 5 6 9H3v6h3l5 4V5z" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                </button>
              )}
            </div>

            {qtype === "fill" ? (
              <input
                type="text"
                autoFocus
                value={(currentAnswer as string) ?? ""}
                onChange={e => handleFillChange(e.target.value)}
                placeholder="輸入答案"
                className="w-full px-4 py-3 border border-zinc-400 dark:border-zinc-600 rounded text-base outline-none focus:border-black dark:focus:border-zinc-200"
                style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {currentQuestion.options.map((option) => {
                  const isSelected = qtype === "multiple"
                    ? ((currentAnswer as string[] | null) ?? []).includes(option.label)
                    : currentAnswer === option.label;
                  return (
                    <button
                      key={option.label}
                      onClick={() => qtype === "multiple" ? handleMultipleToggle(option.label) : handleSingleAnswer(option.label)}
                      className={`flex-1 px-6 py-3 border border-[1px] rounded text-left transition-colors ${
                        isSelected ? "border-black dark:border-zinc-200" : "border-zinc-400 dark:border-zinc-600"
                      }`}
                      style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                    >
                      <span className="font-semibold">{option.label}</span> {typeof option.text === "string" ? option.text : JSON.stringify(option.text)}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex justify-end">
              <AddToListButton
                questionId={currentQuestion.id}
                collectionId={id}
                title={currentQuestion.title}
                number={currentQuestion.number}
                level={currentQuestion.level}
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4 w-full">
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold">
                寫 {correctCount}/{answeredCount}
              </div>
              <button
                onClick={resetQuiz}
                className="px-4 py-2 border rounded-full bg-white text-black dark:bg-white dark:text-black text-sm"
              >
                重新開始
              </button>
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
                      return <span key={l} className="mr-1">{l} {opt?.text}</span>;
                    });
                  }
                  const opt = question.options.find(o => o.label === userAns);
                  return <span>{userAns as string} {opt?.text}</span>;
                };

                const renderCorrectAns = () => {
                  if (qt === "fill") return <span>{question.answer as string}</span>;
                  if (qt === "multiple") {
                    return (question.answer as string[]).map(l => {
                      const opt = question.options.find(o => o.label === l);
                      return <span key={l} className="mr-1">{l} {opt?.text}</span>;
                    });
                  }
                  const opt = question.options.find(o => o.label === question.answer);
                  return <span>{question.answer as string} {opt?.text}</span>;
                };

                const isChecked = checkedIdxs.has(idx);
                const toggleCheck = () => setCheckedIdxs(prev => {
                  const next = new Set(prev);
                  next.has(idx) ? next.delete(idx) : next.add(idx);
                  return next;
                });

                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                        : "border-red-500 bg-red-50 dark:bg-red-900/10"
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      {session?.user && (
                        <button
                          type="button"
                          onClick={toggleCheck}
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-xs transition-colors ${
                            isChecked
                              ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black"
                              : "border-zinc-400 dark:border-zinc-500"
                          }`}
                          aria-label="勾選"
                        >
                          {isChecked && "✓"}
                        </button>
                      )}
                      <p className="font-medium flex-1">題號{question.number}：{question.title}</p>
                    </div>
                    <div className="text-sm space-y-1 pl-7">
                      <p>你的答案：<span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isCorrect ? "bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-400"}`}>
                        {renderUserAns()}
                      </span></p>
                      {!isCorrect && (
                        <p>正確答案：<span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400">{renderCorrectAns()}</span></p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end items-center gap-2 mt-4">
              {(() => {
                const answeredIdxs = questions
                  .map((_, i) => i)
                  .filter(i => userAnswers[i] !== null);
                const allChecked = answeredIdxs.length > 0 && answeredIdxs.every(i => checkedIdxs.has(i));
                const wrongIdxs = questions
                  .map((q, i) => ({ q, i }))
                  .filter(({ q, i }) => userAnswers[i] !== null && !gradeAnswer(q, userAnswers[i]))
                  .map(({ i }) => i);
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
                  </>
                );
              })()}
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
