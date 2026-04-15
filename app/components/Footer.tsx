import Link from "next/link";

const feedbackLabels: Record<string, string> = {
  en: "Feedback",
  "zh-CN": "意见反馈",
  es: "Retroalimentación",
  th: "ข้อเสนอแนะ",
  id: "Masukan",
  ko: "피드백",
  ru: "Обратная связь",
  "zh-TW": "意見回饋",
};

export function Footer({ language }: { language: string }) {
  return (
    <footer className="w-full mt-auto pt-16 pb-12 flex flex-col items-center justify-center gap-6 relative">
      <div className="w-12 h-[1px] bg-zinc-200 dark:bg-zinc-800 mb-4" />
      <div className="flex items-center justify-center gap-6">
        <Link
          href="/feedback"
          className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-sm transition-colors border border-transparent hover:border-zinc-100 dark:hover:border-zinc-800"
        >
          {feedbackLabels[language] ?? feedbackLabels["zh-TW"]}
        </Link>
      </div>
    </footer>
  );
}
