import React from "react";
import { getArticleByNumber } from "../../../../lib/articles-firebase";
import { auth } from "../../../../auth";
import Link from "next/link";
import RecitationClient from "./RecitationClient";

type Props = { params: Promise<{ category: string; number: string }> };

export default async function ArticlePage({ params }: Props) {
  const resolvedParams = await params;
  const number = parseInt(resolvedParams.number, 10);
  // enforce anonymous access restriction: show registration prompt for not-logged-in users when number > 3
  try {
    const session = await auth();
    if (!session?.user?.email && number > 3) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-transparent font-serif dark:bg-black">
          <main className="w-full max-w-2xl rounded-lg zen-card p-12 text-center">
            <h1 className="text-3xl font-semibold mb-4">註冊以背誦更多詩文</h1>
            <div className="flex justify-center gap-4">
              <Link href="/auth/register" className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700">註冊 / 登入</Link>
              <Link href="/" className="px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-full">返回首頁</Link>
            </div>
          </main>
        </div>
      );
    }
  } catch (e) {
    // if auth check fails, treat as anonymous and show prompt when number > 3
    if (number > 3) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-transparent font-serif dark:bg-black">
          <main className="w-full max-w-2xl rounded-lg zen-card p-12 text-center">
            <h1 className="text-3xl font-semibold mb-4">註冊以背誦更多詩文</h1>
            <div className="flex justify-center gap-4">
              <Link href="/auth/register" className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700">註冊 / 登入</Link>
              <Link href="/" className="px-6 py-3 bg-gray-200 dark:bg-gray-800 rounded-full">返回首頁</Link>
            </div>
          </main>
        </div>
      );
    }
  }
  const article = await getArticleByNumber(number);

  if (!article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent font-serif dark:bg-black">
        <main className="w-full max-w-2xl rounded-lg zen-card p-12">
          <header className="mb-6 text-center">
            <h1 className="text-4xl zen-title">找不到文章</h1>
            <p className="mt-2 text-sm zen-subtle">找不到編號為「{number}」的文章，請確認 Firestore `articles` 是否存在該文件。</p>
          </header>
        </main>
      </div>
    );
  }

  const lines: string[] = Array.isArray(article.content)
    ? (article.content as string[])
    : String(article.content || "").split(/\r?\n/).filter(Boolean);

  const attemptCount = (article.attemptCount as number) || 0;
  const successCount = (article.successCount as number) || 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-serif dark:bg-black">
      <main className="w-full max-w-2xl rounded-lg zen-card p-12">
        <header className="mb-6 text-center relative">
          <h1 className="text-4xl zen-title">{(article.number || number) + ". " + article.title}</h1>
          {article.author && <p className="mt-2 text-sm zen-subtle">— {article.author}</p>}
        </header>

        <RecitationClient
          articleId={article.id}
          articleNumber={article.number || number}
          title={article.title}
          content={lines}
          attemptCount={attemptCount}
          successCount={successCount}
        />
      </main>
    </div>
  );
}
