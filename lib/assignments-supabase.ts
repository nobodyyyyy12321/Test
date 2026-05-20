import { getSupabaseAdmin } from "./supabase-admin";
import { fetchQuestions } from "./questions";

export type AssignmentAnswer = { n: number; u: string | string[] | null };

export type Assignment = {
  id: string;
  assignerId: string;
  assigneeId: string;
  assignType: string;
  sourceResourceType: string;
  sourceResourceId: string;
  title: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  submittedAt: string | null;
  score: number | null;
  total: number | null;
  gradedAt: string | null;
};

type Row = Record<string, unknown>;

function mapRow(row: Row): Assignment {
  return {
    id: row.id as string,
    assignerId: row.assigner_id as string,
    assigneeId: row.assignee_id as string,
    assignType: row.assign_type as string,
    sourceResourceType: row.source_resource_type as string,
    sourceResourceId: row.source_resource_id as string,
    title: row.title as string,
    startAt: row.start_at as string,
    endAt: row.end_at as string,
    createdAt: row.created_at as string,
    submittedAt: row.submitted_at as string | null,
    score: row.score as number | null,
    total: row.total as number | null,
    gradedAt: row.graded_at as string | null,
  };
}

export async function createAssignment(opts: {
  assignerId: string;
  assigneeId: string;
  sourceResourceId: string;
  title: string;
  startAt: string;
  endAt: string;
}): Promise<Assignment | null> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("assignments")
    .insert({
      assigner_id: opts.assignerId,
      assignee_id: opts.assigneeId,
      assign_type: "exam",
      source_resource_type: "qset",
      source_resource_id: opts.sourceResourceId,
      title: opts.title,
      start_at: opts.startAt,
      end_at: opts.endAt,
    })
    .select()
    .single();
  if (error || !data) return null;
  return mapRow(data as Row);
}

export async function getAssignmentsByAssignee(assigneeId: string): Promise<Assignment[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("assignments")
    .select("*")
    .eq("assignee_id", assigneeId)
    .order("end_at", { ascending: false });
  return (data ?? []).map((r: Row) => mapRow(r));
}

export async function getAssignmentsByAssigner(assignerId: string): Promise<Assignment[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("assignments")
    .select("*")
    .eq("assigner_id", assignerId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((r: Row) => mapRow(r));
}

export async function getAssignmentById(id: string): Promise<Assignment | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("assignments")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) return null;
  return mapRow(data as Row);
}

export async function getAssignmentAnswers(assignmentId: string): Promise<AssignmentAnswer[] | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("assignments")
    .select("answers")
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data?.answers) return null;
  return data.answers as AssignmentAnswer[];
}

export async function submitAssignment(id: string, answers: AssignmentAnswer[]): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data: a } = await sb
    .from("assignments")
    .select("submitted_at")
    .eq("id", id)
    .single();
  if (!a || a.submitted_at) return false;

  const { error } = await sb
    .from("assignments")
    .update({ answers, submitted_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("assignments").delete().eq("id", id);
  return !error;
}

export async function gradeAssignment(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();

  const { data: a } = await sb
    .from("assignments")
    .select("source_resource_id, graded_at, answers")
    .eq("id", id)
    .single();
  if (!a || a.graded_at) return false;
  if (!a.answers) return false;

  const answers = a.answers as AssignmentAnswer[];
  const answerMap = new Map<number, unknown>();
  for (const ans of answers) answerMap.set(ans.n, ans.u);

  const questions = await fetchQuestions({ id: a.source_resource_id as string });
  if (!questions || questions.length === 0) return false;

  let score = 0;
  let total = 0;
  for (const q of questions) {
    if (q.type === "group") continue;
    total += 1;

    const userAnswer = answerMap.get(q.number);
    if (userAnswer === undefined || userAnswer === null) continue;

    const isCorrect = (() => {
      if (q.type === "fill") {
        return String(userAnswer).trim() === String(q.answer).trim();
      }
      if (q.type === "multiple") {
        const correct = [...(q.answer as string[])].sort();
        const user = [...(userAnswer as string[])].sort();
        return correct.length === user.length && correct.every((v, i) => v === user[i]);
      }
      return String(userAnswer) === String(q.answer);
    })();

    if (isCorrect) score += 1;
  }

  const { error } = await sb
    .from("assignments")
    .update({ score, total, graded_at: new Date().toISOString() })
    .eq("id", id)
    .is("graded_at", null);
  return !error;
}

export async function evictOldestTerminal(userId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .from("assignments")
    .select("id, end_at, submitted_at, graded_at")
    .or(`assigner_id.eq.${userId},assignee_id.eq.${userId}`);
  if (!rows || rows.length <= 60) return;

  const terminal = (rows as Array<Record<string, unknown>>).filter(r => {
    if (r.submitted_at && !r.graded_at) return false;
    return true;
  });
  if (terminal.length === 0) return;

  terminal.sort((a, b) => new Date(a.end_at as string).getTime() - new Date(b.end_at as string).getTime());
  const toDelete = terminal.slice(0, terminal.length - 60 + 1);
  for (const r of toDelete) {
    await sb.from("assignments").delete().eq("id", r.id as string);
  }
}
