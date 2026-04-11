"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type RecitationRecord = {
  articleId: string;
  articleNumber: number;
  title: string;
  success: boolean;
  timestamp: string;
  category?: string;
};


type QuizRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category: "英文" | "Learn Chinese";
};

type Subject = "詩文背誦" | "英文";

export default function RecordsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [recitations, setRecitations] = useState<RecitationRecord[]>([]);
  const [englishRecords, setEnglishRecords] = useState<QuizRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareCopied, setShareCopied] = useState(false);
  const [recitationsPublic, setRecitationsPublic] = useState(false);
  const [userName, setUserName] = useState("");
  const [isOwner, setIsOwner] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject>("詩文背誦");

  useEffect(() => {
    const nameParam = params?.name;
    if (!nameParam || typeof nameParam !== "string") {
      router.push("/");
      return;
    }

    const decodedName = decodeURIComponent(nameParam);
    setUserName(decodedName);

    // Fetch the user's profile
    fetch(`/api/user/profile?name=${encodeURIComponent(decodedName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          // Consider owner true if server marked isOwner, or session email matches profile email,
          // or session name matches the decoded name (fallback)
          const owner = Boolean(data.user.isOwner) || (session?.user?.email && session.user.email === data.user.email) || session?.user?.name === decodedName;
          setIsOwner(owner);
          setRecitationsPublic(data.user.recitationsPublic ?? false);

          // Show records if owner or if public
          if (owner || data.user.recitationsPublic) {
            setRecitations(data.user.recitations || []);

            setEnglishRecords(data.user.englishRecords || []);

          }
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

  const subjects: Subject[] = ["詩文背誦", "英文"];

  const englishSetNames: Record<string, string> = {
    englishQuestions: "2000單",
  };

  const filterRecitations = (records: RecitationRecord[]): RecitationRecord[] => {
    return records.filter(r => (r.category || "詩文背誦") === selectedSubject);
  };

  const filteredRecitations = filterRecitations(recitations);

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
          <h1 className="text-3xl font-bold zen-title whitespace-nowrap">
            {userName ? `${userName} 的紀錄` : "紀錄"}
          </h1>
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

        {!isOwner && !recitationsPublic ? (
          <div className="w-full max-w-md text-center py-12 mx-auto">
            <p className="text-gray-500">此用戶的背誦紀錄為不公開</p>
          </div>
        ) : (
          <div className="w-full max-w-md space-y-6 mx-auto">
            {/* Subject Dropdown */}
            <div className="flex items-center justify-center gap-2">
              <label className="text-sm font-medium text-gray-400">選擇分類：</label>
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value as Subject)}
                className="record-select px-4 py-2 rounded border text-sm font-medium cursor-pointer transition-colors"
              >
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
            </div>

            {selectedSubject === "詩文背誦" && (
              <>
                <div className="mt-8">
                  {filteredRecitations.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">尚無背誦紀錄</p>
                ) : (
                  <div className="space-y-3">
                    {filteredRecitations.slice(-10).reverse().map((record, index) => (
                  <div
                    key={index}
                    className="border border-white rounded-lg p-4 bg-transparent transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{record.title}</span>
                        <span className="inline-block px-2 py-0.5 rounded text-xs border border-white bg-transparent text-white">
                          {record.success ? "✓ 成功" : "✗ 失敗"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {new Date(record.timestamp).toLocaleDateString("zh-TW", {
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
            </div>
            </>
            )}
            {selectedSubject === "英文" && (
              <>
                <div className="mt-8">
                  {englishRecords.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">尚無練習紀錄</p>
                  ) : (
                    <div className="space-y-3">
                      {englishRecords.slice(-10).reverse().map((record, index) => (
                        <div
                          key={index}
                          className="border border-white rounded-lg p-4 bg-transparent transition-colors"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-white">{englishSetNames[record.set] ?? record.set}</span>
                              <span className="inline-block px-2 py-0.5 rounded text-xs border border-white bg-transparent text-white">
                                {record.correct}/{record.answered}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400">
                              {new Date(record.timestamp).toLocaleDateString("zh-TW", {
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
                </div>
              </>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
