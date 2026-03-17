"use client";

import React, { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type Option = {
  label: string;
  text: string;
};

type Question = {
  id: string;
  number: number;
  title: string;
  options: Option[];
  answer: string;
};

export default function QuotePage() {
  const { data: session } = useSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [showResults, setShowResults] = useState(false);

  const shuffleQuestions = (items: Question[]) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  useEffect(() => {
    fetch("/api/quote/questions")
      .then(res => res.json())
      .then(data => {
        if (data.questions) {
          const randomizedQuestions = shuffleQuestions(data.questions);
          setQuestions(randomizedQuestions);
          setUserAnswers(new Array(randomizedQuestions.length).fill(null));
        }
      })
      .catch(err => console.error("Failed to load questions:", err));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (showResults) return;

      const keyToOption: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
      const k = keyToOption[e.key] ?? e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(k)) {
        handleAnswer(k);
      }
      if (k === "ENTER") {
        checkAnswers();
      }
      if (k === "ARROWLEFT") {
        setCurrentIndex(Math.max(0, currentIndex - 1));
      }
      if (k === "ARROWRIGHT") {
        setCurrentIndex(Math.min(questions.length - 1, currentIndex + 1));
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showResults, userAnswers, currentIndex, questions.length]);

  const handleAnswer = (answer: string) => {
    if (currentIndex < questions.length) {
      const newAnswers = [...userAnswers];
      newAnswers[currentIndex] = answer;
      setUserAnswers(newAnswers);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
  };

  const checkAnswers = () => {
    setShowResults(true);
    
    // Save record if user is logged in
    if (session?.user?.email) {
      const answeredCount = userAnswers.filter(a => a !== null).length;
      const correctCount = userAnswers.filter((answer, idx) => answer === questions[idx]?.answer).length;
      
      fetch("/api/user/quote/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answered: answeredCount,
          correct: correctCount,
          set: "1-20",
        }),
      }).catch(err => console.error("Failed to save record:", err));
    }
  };

  const resetQuiz = () => {
    setShowResults(false);
    setCurrentIndex(0);
    setUserAnswers(new Array(questions.length).fill(null));
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
  const answeredCount = userAnswers.filter(a => a !== null).length;
  const correctCount = userAnswers.filter((answer, idx) => answer === questions[idx]?.answer).length;

  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col items-start justify-start py-8 px-16 bg-transparent dark:bg-black sm:items-start">
        <div className="flex items-center justify-between w-full">
          <h1 className="text-3xl font-bold zen-title">名言佳句</h1>
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
            <div className="text-sm text-zinc-400">
              題號{currentQuestion.number}
            </div>

            <div className="p-6 border border-[1px] rounded text-lg">
              {currentQuestion.title}
            </div>
                
            <div className="flex flex-col gap-3">
              {currentQuestion.options.map((option) => (
                <button
                  key={option.label}
                  onClick={() => handleAnswer(option.label)}
                  className={`flex-1 px-6 py-3 border border-[1px] rounded text-left transition-colors ${
                    userAnswers[currentIndex] === option.label
                      ? "border-black dark:border-zinc-200"
                      : "border-zinc-400 dark:border-zinc-600"
                  }`}
                  style={{ backgroundColor: "var(--zen-bg)", color: "var(--zen-ink)" }}
                >
                  <span className="font-semibold">{option.label}</span> {option.text}
                </button>
              ))}
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

                const isCorrect = userAns === question.answer;
                const userOption = question.options.find(opt => opt.label === userAns);
                const correctOption = question.options.find(opt => opt.label === question.answer);
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-2 ${
                      isCorrect
                        ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                        : "border-red-500 bg-red-50 dark:bg-red-900/10"
                    }`}
                  >
                    <p className="font-medium mb-2">題號{question.number}：{question.title}</p>
                    <div className="text-sm space-y-1">
                      <p>你的答案：<span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${isCorrect ? "bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400" : "bg-red-200 text-red-700 dark:bg-red-900/50 dark:text-red-400"}`}>
                        {userAns} {userOption?.text}
                      </span></p>
                      {!isCorrect && (
                        <p>正確答案：<span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-200 text-green-700 dark:bg-green-900/50 dark:text-green-400">{question.answer} {correctOption?.text}</span></p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
