"use client";

import React, { useEffect, useState } from "react";
import TestClient from "../../[id]/TestClient";
import type { Question } from "../../../../lib/questions";

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

  if (review && assignment.submittedAt) {
    const answers = assignment.answers as Record<string, string | string[] | null> | null;
    if (answers && questions.length > 0) {
      const sorted = [...questions].sort((a, b) => a.number - b.number);
      const compactAnswers = sorted
        .filter(q => q.type !== "group")
        .map(q => ({ n: q.number, u: answers[String(q.number)] ?? null }));
      const replayKey = `assignment_review_${assignmentId}`;
      try { sessionStorage.setItem(`quiz_replay_${replayKey}`, JSON.stringify({ answers: compactAnswers })); } catch {}
      const qsetId = assignment.sourceResourceId as string || assignmentId;
      // Redirect to the normal test page with replay
      if (typeof window !== "undefined") {
        window.location.href = `/test/${encodeURIComponent(qsetId)}?replay=${encodeURIComponent(replayKey)}&autostart=1`;
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

  return (
    <TestClient
      id={assignment.sourceResourceId as string || assignmentId}
      ordered={true}
      listId={null}
      listTitle={null}
      levels={null}
      language={serverLang}
      pageTitle={assignment.title as string}
      mode="assignment"
      assignmentId={assignmentId}
      initialQuestions={questions}
    />
  );
}
