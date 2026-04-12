"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type QuizRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category?: string;
  success?: boolean;
};

const englishSetNames: Record<string, string> = {
  "englishWords:1,2": "2000單",
  "englishWords:3,4": "4000單",
  "englishWords:5,6": "6000單",
  englishWords: "英文",
  quoteChinese: "名言佳句",
};

export default function RecordsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [quizRecords, setQuizRecords] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [userName, setUserName] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const nameParam = params?.name;
    if (!nameParam || typeof nameParam !== "string") {
      router.push("/");
      return;
    }

    const decodedName = decodeURIComponent(nameParam);
    setUserName(decodedName);

    fetch(`/api/user/profile?name=${encodeURIComponent(decodedName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          const owner = Boolean(data.user.isOwner) || (session?.user?.email && session.user.email === data.user.email) || session?.user?.name === decodedName;
          setIsOwner(owner);
          setQuizRecords(data.user.records || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch recitations:", err);
        setLoading(false);
      });
  }, [status, session, router, params]);

  if (loading || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent dark:bg-black">
        <main className="w-full max-w-2xl p-8 text-center">
          <p className="text-sm zen-subtle">載入中...</p>
        </main>
      </div>
    );
  }

  const combined = [...quizRecords]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-10)
    .reverse();

  function handleShare() {
    const url = window.location.href;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 1500);
      }).catch(() => {
        window.prompt("複製連結", url);
      });
    } else {
      window.prompt("複製連結", url);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center pt-8 bg-transparent font-sans dark:bg-black">
      <main className="w-full max-w-2xl zen-card p-8 flex flex-col items-center text-center">
        <div className="mb-8 flex w-full max-w-md flex-wrap items-center justify-center gap-3 mx-auto">
          <div className="w-full text-center">
            <h1 className="text-3xl font-bold zen-title whitespace-nowrap">
              {userName ? `${userName} 的紀錄` : "紀錄"}
            </h1>
            <p className="text-xs text-gray-400 mt-1">保留最近十筆測驗紀錄</p>
          </div>
          <div className="flex items-center gap-2 whitespace-nowrap">
            {userName && (
              <Link href={`/account/${encodeURIComponent(userName)}/profile`} className="inline-flex items-center justify-center whitespace-nowrap px-3 py-2 border rounded-full bg-white text-black text-sm leading-none cursor-pointer hover:opacity-90 transition-opacity">個人檔案</Link>
            )}
            {isOwner && (
              <button className="inline-flex items-center justify-center whitespace-nowrap px-3 py-2 border rounded-full bg-white text-black text-sm leading-none cursor-pointer hover:opacity-90 transition-opacity" onClick={handleShare}>
                {shareCopied ? "已複製" : "分享連結"}
              </button>
            )}
          </div>
        </div>

        {combined.length === 0 ? (
          <div className="w-full max-w-md text-center py-12 mx-auto">
            <p className="text-gray-500">尚無紀錄</p>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-3 mx-auto">
            {combined.map((item, index) => (
              <div key={index} className="border border-white rounded-lg p-4 bg-transparent transition-colors">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white">{englishSetNames[item.set] ?? item.set}</span>
                    {item.category === "詩文背誦" ? (
                      <span className="inline-block px-2 py-0.5 rounded text-xs border border-white bg-transparent text-white">
                        {item.success ? "✓ 成功" : "✗ 失敗"}
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded text-xs border border-white bg-transparent text-white">
                        {item.correct}/{item.answered}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(item.timestamp).toLocaleDateString("zh-TW", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
