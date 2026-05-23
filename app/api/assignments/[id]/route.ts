import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import {
  getAssignmentById,
  getAssignmentAnswers,
  submitAssignment,
  deleteAssignment,
  gradeAssignment,
  type AssignmentAnswer,
} from "@/lib/assignments-supabase";
import { fetchQuestions } from "@/lib/questions";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignment = await getAssignmentById(id);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (assignment.assigneeId !== user.id && assignment.assignerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (assignment.submittedAt && !assignment.gradedAt && new Date(assignment.endAt).getTime() < Date.now()) {
    await gradeAssignment(id);
    const updated = await getAssignmentById(id);
    if (updated) Object.assign(assignment, updated);
  }

  const now = Date.now();
  const end = new Date(assignment.endAt).getTime();
  const isAfterWindow = now > end;
  const isAssignee = assignment.assigneeId === user.id;

  const questions = assignment.sourceResourceType === "list"
    ? await fetchQuestions({ id: "", listId: assignment.sourceResourceId })
    : await fetchQuestions({ id: assignment.sourceResourceId });

  // Assigner cannot peek at the assignee's answers or submission status before the window closes.
  let answers: AssignmentAnswer[] | null = null;
  let submittedAt = assignment.submittedAt;
  if (assignment.submittedAt && (isAssignee || isAfterWindow)) {
    answers = await getAssignmentAnswers(id);
  }
  if (!isAssignee && !isAfterWindow) {
    submittedAt = null;
  }

  return NextResponse.json({
    ...assignment,
    submittedAt,
    answers,
    questions: isAfterWindow ? questions : questions.map(q => ({ ...q, answer: undefined })),
  });
}

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignment = await getAssignmentById(id);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (assignment.assigneeId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = Date.now();
  const start = new Date(assignment.startAt).getTime();
  const end = new Date(assignment.endAt).getTime();
  if (now < start || now > end) {
    return NextResponse.json({ error: "Submission window is closed" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await _req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers = body.answers;
  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: "answers required (array of {n,u})" }, { status: 400 });
  }

  const ok = await submitAssignment(id, answers as AssignmentAnswer[]);
  if (!ok) return NextResponse.json({ error: "Failed to submit" }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assignment = await getAssignmentById(id);
  if (!assignment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (assignment.assignerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (assignment.submittedAt) {
    return NextResponse.json({ error: "Cannot delete after submission" }, { status: 403 });
  }

  const ok = await deleteAssignment(id);
  if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
