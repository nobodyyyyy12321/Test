import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users";
import { getListById, addQuestionToList, addQuestionsToList, removeQuestionFromList } from "../../../../../lib/lists-firebase";
import type { Session } from "next-auth";

async function getSessionUser() {
  const session = (await auth()) as unknown as Session | null;
  const email = session?.user?.email as string | undefined;
  const name = session?.user?.name as string | undefined;
  if (!email && !name) return null;
  return email ? await findUserByEmail(email) : await findUserByName(name!);
}

export async function POST(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { questionId, collectionId, title, number, level } = await req.json();
    if (!questionId || !collectionId) return NextResponse.json({ error: "questionId and collectionId required" }, { status: 400 });
    await addQuestionToList(listId, { questionId, collectionId, title: title ?? "", number: number ?? 0, level: level ?? null });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/lists/[listId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { questions } = await req.json();
    if (!Array.isArray(questions)) return NextResponse.json({ error: "questions array required" }, { status: 400 });
    await addQuestionsToList(listId, questions);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/lists/[listId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { questionId, collectionId } = await req.json();
    if (!questionId || !collectionId) return NextResponse.json({ error: "questionId and collectionId required" }, { status: 400 });
    await removeQuestionFromList(listId, questionId, collectionId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/lists/[listId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
