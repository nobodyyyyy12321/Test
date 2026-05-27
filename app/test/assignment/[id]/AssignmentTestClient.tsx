"use client";

import React, { useEffect, useState } from "react";
import TestClient from "../../[id]/TestClient";
import type { Question } from "../../../../lib/questions-supabase";

type Props = {
  assignmentId: string;
  serverLang: string;
  review?: boolean;
};

export default function AssignmentTestClient({ assignmentId, serverLang, review }: Props) {
  const [assignment, setAssignment] = useState<Record<string, unknown> | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/assignments/${assignmentId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setAssignment(data);
        const qs = (data.questions ?? []) as Question[];
        setQuestions(qs);
      })
      .catch(() => setError("無法載入"))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm opacity-50">載入中...</p></div>;
  if (error || !assignment) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm text-red-500">{error ?? "無法載入"}</p></div>;

  const isListAssignment = assignment.sourceResourceType === "list";

  if (review && assignment.submittedAt) {
    const answers = assignment.answers as Array<{ n: number; u: string | string[] | null }> | null;
    if (answers && questions.length > 0) {
      const answerMap = new Map(answers.map(a => [a.n, a.u]));
      const sorted = [...questions].sort((a, b) => a.number - b.number);
      const compactAnswers = sorted
        .filter(q => q.type !== "group")
        .map(q => ({ n: q.number, u: answerMap.get(q.number) ?? null }));
      const replayKey = `assignment_review_${assignmentId}`;
      try { sessionStorage.setItem(`quiz_replay_${replayKey}`, JSON.stringify({ answers: compactAnswers })); } catch {}
      const sourceId = assignment.sourceResourceId as string || assignmentId;
      if (typeof window !== "undefined") {
        window.location.href = isListAssignment
          ? `/test/list?listId=${encodeURIComponent(sourceId)}&replay=${encodeURIComponent(replayKey)}&autostart=1`
          : `/test/${encodeURIComponent(sourceId)}?replay=${encodeURIComponent(replayKey)}&autostart=1`;
      }
      return null;
    }
  }

  const now = Date.now();
  const start = new Date(assignment.startAt as string).getTime();
  const end = new Date(assignment.endAt as string).getTime();

  if (now < start) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm opacity-50">尚未開始</p></div>;
  if (now > end) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm opacity-50">已截止</p></div>;
  if (assignment.submittedAt) return <div className="flex min-h-screen items-center justify-center"><p className="text-sm opacity-50">已提交</p></div>;

  const sourceId = (assignment.sourceResourceId as string) || assignmentId;
  return (
    <TestClient
      id={isListAssignment ? "list" : sourceId}
      ordered={true}
      listId={isListAssignment ? sourceId : null}
      listTitle={isListAssignment ? (assignment.title as string) : null}
      levels={null}
      language={serverLang}
      pageTitle={assignment.title as string}
      mode="assignment"
      assignmentId={assignmentId}
      initialQuestions={questions}
    />
  );
}
