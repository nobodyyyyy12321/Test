"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type RecitationClientProps = {
  articleId: string;
  articleNumber: number;
  title: string;
  content: string[];
  attemptCount?: number;
  successCount?: number;
};

export default function RecitationClient({ articleId, articleNumber, title, content, attemptCount = 0, successCount = 0 }: RecitationClientProps) {
  const { data: session } = useSession();
  const [isReciting, setIsReciting] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<"correct" | "incorrect" | null>(null);
  const recognitionRef = useRef<any>(null);
  const [attemptCountState, setAttemptCountState] = useState<number>(attemptCount);
  const [successCountState, setSuccessCountState] = useState<number>(successCount);

  const fullText = content.join("");
  const normalizeText = (text: string) => text.replace(/[\s\n\r，。、；：！？""''（）《》]/g, "");

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "zh-TW";

      recognitionRef.current.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        if (final) {
          setRecognizedText((prev) => prev + final);
        }
        setInterimText(interim);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const router = useRouter();

  const startRecitation = async () => {
    // If user is not signed in, call attempt API which increments/checks anonymous quota.
    if (!session?.user?.email) {
      try {
        const res = await fetch("/api/user/recitation/attempt", { method: "POST", credentials: "include" });
        if (res.status === 429) {
          // redirect anonymous users to register page on 4th attempt
          router.push("/auth/register");
          return;
        }
        const data = await res.json();
        if (!data || data.allowed === false) {
          router.push("/auth/register");
          return;
        }
      } catch (e) {
        console.error("Attempt check failed:", e);
        // allow recitation on error to avoid blocking happy path
      }
    }

    setIsReciting(true);
    setRecognizedText("");
    setInterimText("");
    setResult(null);
    startListening();
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const checkRecitation = async () => {
    stopListening();
    
    const normalizedOriginal = normalizeText(fullText);
    const normalizedRecognized = normalizeText(recognizedText);

    const isCorrect = normalizedOriginal === normalizedRecognized;
    setResult(isCorrect ? "correct" : "incorrect");
    // Optimistic counters: update UI immediately on button click
    setAttemptCountState((c) => c + 1);
    if (isCorrect) setSuccessCountState((c) => c + 1);

    // Always POST to record the attempt (anonymous allowed server-side)
    try {
      console.log("Saving recitation attempt...", { articleId, articleNumber, title, isCorrect });
      const response = await fetch("/api/user/recitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          articleId,
          articleNumber,
          title,
          success: isCorrect,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();
      console.log("Recitation save response:", response.status, data);

      if (!response.ok) {
        console.error("Failed to save recitation:", data);
        // optional: revert optimistic update if server rejects (not doing here)
      } else {
        // reconcile with server counters
        if (data.attemptCount !== undefined) setAttemptCountState(Number(data.attemptCount));
        if (data.successCount !== undefined) setSuccessCountState(Number(data.successCount));
        console.log("✅ Recitation attempt saved successfully!");
      }
    } catch (error) {
      console.error("Failed to save recitation record:", error);
    }
  };

  const resetRecitation = () => {
    setIsReciting(false);
    setRecognizedText("");
    setInterimText("");
    setResult(null);
    stopListening();
  };

  if (!isReciting) {
    return (
      <div style={{ position: "relative" }}>
        <article className="space-y-4 text-center text-2xl leading-loose mb-8">
          {content.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </article>

        <div className="flex justify-center gap-6 mb-6">
          <span className="text-white text-sm font-medium">嘗試：{attemptCountState}</span>
          <span className="text-white text-sm font-medium">成功：{successCountState}</span>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            onClick={startRecitation}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
          >
            開始背誦
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <div className="flex justify-center gap-3">
        {isListening ? (
          <button
            onClick={stopListening}
            className="px-6 py-3 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors font-medium"
          >
            停止錄音
          </button>
        ) : (
          <button
            onClick={startListening}
            className="px-6 py-3 bg-green-600 text-white rounded-full hover:bg-green-700 transition-colors font-medium"
          >
            開始錄音
          </button>
        )}
        
        <button
          onClick={checkRecitation}
          disabled={!recognizedText.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          檢查背誦
        </button>

        <button
          onClick={resetRecitation}
          className="px-6 py-3 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors font-medium"
        >
          取消
        </button>
      </div>

      {isListening && (
        <div className="text-center">
          <p className="text-sm text-red-600 font-medium animate-pulse">🎤 錄音中...</p>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 min-h-[200px]">
        <h3 className="text-lg font-medium mb-3 zen-title">你的背誦：</h3>
        <div className="text-xl leading-loose whitespace-pre-wrap">
          {recognizedText || interimText ? (
            <>
              <span>{recognizedText}</span>
              <span className="text-gray-400">{interimText}</span>
            </>
          ) : (
            <span className="text-gray-400">等待語音輸入...</span>
          )}
        </div>
      </div>

      {result && (
        <div className={`p-6 rounded-lg text-center ${
          result === "correct" 
            ? "bg-green-50 border-2 border-green-500 dark:bg-green-900/20" 
            : "bg-red-50 border-2 border-red-500 dark:bg-red-900/20"
        }`}>
          {result === "correct" ? (
            <>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300 mb-2">✅ 背誦正確！</p>
              <p className="text-sm text-green-600 dark:text-green-400">已記錄到你的帳號</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-700 dark:text-red-300 mb-2">❌ 背誦不完全正確</p>
              <p className="text-sm text-red-600 dark:text-red-400">請再試一次</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
