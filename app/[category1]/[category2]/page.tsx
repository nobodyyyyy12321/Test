"use client";
import { useEffect, useState } from "react";

async function fetchQuestions(category1: string, category2: string) {
  if (category1 === "english") {
    const res = await fetch("/api/english/questions?range=1-1971");
    const data = await res.json();
    return data.questions || [];
  }
  return [];
}

export default function Page({ params }: { params: { category1: string; category2: string } }) {
  const category1 = params?.category1 || "";
  const category2 = params?.category2 || "";
  const [questions, setQuestions] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [results, setResults] = useState<{ correct: boolean; answer: string; user: string | null }[]>([]);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    fetchQuestions(category1, category2).then(setQuestions);
  }, [category1, category2]);

  if (questions.length === 0) {
    return <div className="flex min-h-screen items-center justify-center"><p>目前無資料</p></div>;
  }

  const q = questions[current];

  function handleSelect(option: string) {
    setSelected(option);
  }

  function handleSubmit() {
    if (!selected) return;
    setShowResult(true);
    setResults([
      ...results,
      { correct: selected === q.answer, answer: q.answer, user: selected },
    ]);
  }

  function handleNext() {
    setSelected(null);
    setShowResult(false);
    if (current + 1 < questions.length) {
      setCurrent(current + 1);
    } else {
      setFinished(true);
    }
  }

  if (finished) {
    const correctCount = results.filter(r => r.correct).length;
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
        <main className="flex flex-col items-center justify-center w-full max-w-2xl py-20 px-4">
          <h1 className="text-3xl font-bold mb-6">作答結果</h1>
          <div className="mb-4">共 {questions.length} 題，答對 {correctCount} 題</div>
          <ul className="w-full">
            {questions.map((q, i) => (
              <li key={q.id || q.number} className="mb-2 p-2 border rounded bg-white dark:bg-gray-900">
                <div className="font-bold">{q.title || q.question}</div>
                <div>你的答案：{results[i]?.user || "未作答"}，正解：{q.answer} {results[i]?.correct ? "✅" : "❌"}</div>
              </li>
            ))}
          </ul>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex flex-col items-center justify-center w-full max-w-2xl py-20 px-4">
        <h1 className="text-2xl font-bold mb-4">{category1} / {category2}</h1>
        <div className="w-full max-w-xl p-6 border rounded bg-white dark:bg-gray-900">
          <div className="mb-4 font-bold">第 {current + 1} 題 / 共 {questions.length} 題</div>
          <div className="mb-4 text-lg">{q.title || q.question}</div>
          <form onSubmit={e => { e.preventDefault(); handleSubmit(); }}>
            <ul className="mb-4">
              {q.options && Object.entries(q.options).map(([k, v]) => (
                <li key={k} className="mb-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="option"
                      value={k}
                      checked={selected === k}
                      onChange={() => handleSelect(k)}
                      disabled={showResult}
                    />
                    <span>{k}. {String(v)}</span>
                  </label>
                </li>
              ))}
            </ul>
            {!showResult && (
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded" disabled={!selected}>送出</button>
            )}
            {showResult && (
              <div className="mt-4">
                {selected === q.answer ? (
                  <div className="text-green-600 font-bold">答對了！</div>
                ) : (
                  <div className="text-red-600 font-bold">答錯了，正解：{q.answer}</div>
                )}
                <button type="button" className="ml-4 px-4 py-2 bg-gray-600 text-white rounded" onClick={handleNext}>
                  {current + 1 === questions.length ? "看結果" : "下一題"}
                </button>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
