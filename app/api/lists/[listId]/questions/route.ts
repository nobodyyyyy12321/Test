import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../../lib/users-supabase";
import { getListById, addQuestionToList, addQuestionsToList, removeQuestionFromList, reorderQuestionsInList } from "../../../../../lib/lists-supabase";
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

export async function PUT(req: Request, { params }: { params: Promise<{ listId: string }> }) {
  try {
    const { listId } = await params;
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const list = await getListById(listId);
    if (!list || list.ownerId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { items } = await req.json();
    if (!Array.isArray(items)) return NextResponse.json({ error: "items array required" }, { status: 400 });
    const cleaned = items
      .map((it: unknown) => it as { questionId?: unknown; collectionId?: unknown })
      .filter(it => typeof it.questionId === "string" && typeof it.collectionId === "string")
      .map(it => ({ questionId: it.questionId as string, collectionId: it.collectionId as string }));
    await reorderQuestionsInList(listId, cleaned);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/lists/[listId]/questions error:", e);
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
