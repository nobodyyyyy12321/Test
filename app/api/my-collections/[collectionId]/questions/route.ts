import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { userOwnsCollection } from "@/lib/user-collections-supabase";
import {
  fetchAllQuizQuestionsFresh,
  updateQuizQuestion,
  deleteQuizQuestion,
  reorderCollectionQuestions,
} from "@/lib/questions-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET(_req: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const language = new URL(_req.url).searchParams.get("lang") ?? new URL(_req.url).searchParams.get("language") ?? "zh-TW";
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const questions = await fetchAllQuizQuestionsFresh(collectionId);
    return NextResponse.json({ questions });
  } catch (e) {
    console.error("GET /api/my-collections/[collectionId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const language = new URL(req.url).searchParams.get("lang") ?? new URL(req.url).searchParams.get("language") ?? "zh-TW";
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = await req.json();
    const number = Number(body.number);
    if (!Number.isFinite(number)) {
      return NextResponse.json({ error: "number required" }, { status: 400 });
    }
    await updateQuizQuestion(collectionId, number, {
      title: typeof body.title === "string" ? body.title : undefined,
      type: typeof body.type === "string" ? body.type : undefined,
      options: body.options !== undefined ? body.options : undefined,
      answer: body.answer !== undefined ? body.answer : undefined,
      level: body.level !== undefined ? body.level : undefined,
      group_range: body.group_range !== undefined
        ? body.group_range
        : (body.group_content !== undefined ? body.group_content : undefined),
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/my-collections/[collectionId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const language = new URL(req.url).searchParams.get("lang") ?? new URL(req.url).searchParams.get("language") ?? "zh-TW";
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = await req.json();
    const order = Array.isArray(body.orderedNumbers)
      ? (body.orderedNumbers as unknown[]).map(n => Number(n)).filter(n => Number.isFinite(n))
      : [];
    if (order.length === 0) {
      return NextResponse.json({ error: "orderedNumbers array required" }, { status: 400 });
    }
    await reorderCollectionQuestions(collectionId, order);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/my-collections/[collectionId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ collectionId: string }> }) {
  const { collectionId } = await params;
  const language = new URL(req.url).searchParams.get("lang") ?? new URL(req.url).searchParams.get("language") ?? "zh-TW";
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const owns = await userOwnsCollection(user.id, collectionId, language);
  if (!owns) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const body = await req.json();
    const number = Number(body.number);
    if (!Number.isFinite(number)) {
      return NextResponse.json({ error: "number required" }, { status: 400 });
    }
    await deleteQuizQuestion(collectionId, number);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/my-collections/[collectionId]/questions error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
