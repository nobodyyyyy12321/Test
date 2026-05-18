import { getSupabaseAdmin } from "./supabase-admin";
import { fetchQuestions } from "./questions";

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
  answers: Record<string, unknown> | null;
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
    answers: row.answers as Record<string, unknown> | null,
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

export async function submitAssignment(id: string, answers: Record<string, unknown>): Promise<boolean> {
  const sb = getSupabaseAdmin();
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

  const { data: assignment } = await sb
    .from("assignments")
    .select("source_resource_id, answers")
    .eq("id", id)
    .single();
  if (!assignment) return false;

  const row = assignment as Row;
  const qsetId = row.source_resource_id as string;
  const answers = row.answers as Record<string, unknown> | null;
  if (!answers) return false;

  const questions = await fetchQuestions({ id: qsetId });
  if (!questions || questions.length === 0) return false;

  // Build answer map keyed by question number
  const answerMap: Record<number, unknown> = {};
  for (const [k, v] of Object.entries(answers)) {
    answerMap[Number(k)] = v;
  }

  let score = 0;
  let total = 0;
  for (const q of questions) {
    if (q.type === "group") continue;
    const points = 1;
    total += points;

    const userAnswer = answerMap[q.number];
    if (userAnswer === undefined) continue;

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

    if (isCorrect) score += points;
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
