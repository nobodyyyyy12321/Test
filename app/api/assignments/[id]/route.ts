import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getAssignmentById, submitAssignment, deleteAssignment, gradeAssignment } from "@/lib/assignments-supabase";
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

  // Lazy grade if needed
  if (assignment.submittedAt && !assignment.gradedAt && new Date(assignment.endAt).getTime() < Date.now()) {
    await gradeAssignment(id);
    const updated = await getAssignmentById(id);
    if (updated) Object.assign(assignment, updated);
  }

  const now = Date.now();
  const start = new Date(assignment.startAt).getTime();
  const end = new Date(assignment.endAt).getTime();
  const isWindowOpen = now >= start && now <= end;
  const isAfterWindow = now > end;

  // Fetch questions (strip answer key before window closes)
  const questions = await fetchQuestions({ id: assignment.sourceResourceId });
  const result: Record<string, unknown> = {
    ...assignment,
    questions: isAfterWindow ? questions : questions.map(q => ({ ...q, answer: undefined })),
  };

  // Only assignee sees answers key they submitted
  if (assignment.assigneeId !== user.id && isWindowOpen) {
    result.answers = undefined;
    result.submittedAt = undefined;
  }

  return NextResponse.json(result);
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

  const answers = body.answers as Record<string, unknown> | undefined;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "answers required" }, { status: 400 });
  }

  const ok = await submitAssignment(id, answers);
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
