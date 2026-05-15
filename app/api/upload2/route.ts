import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_TEST_SUPABASE_URL!;
const SUPABASE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY!;
const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
};

const Q_TYPES = new Set(["single", "multiple", "true_false", "fill"]);

type IncomingQuestion = {
  number: number | string;
  content: string;
  q_type: string;
  options: Record<string, string>;
  answer?: string | null;
  level?: number | null;
  explanation?: string | null;
};

type Payload = {
  language: string;
  name: string;
  questions: IncomingQuestion[];
};

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: Payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof payload.language !== "string" || !payload.language.trim()) {
    return NextResponse.json({ error: "language is required" }, { status: 400 });
  }
  if (typeof payload.name !== "string" || !payload.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    return NextResponse.json({ error: "questions array is required" }, { status: 400 });
  }

  const questionRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < payload.questions.length; i++) {
    const q = payload.questions[i];
    const num = Number(q.number);
    if (!Number.isFinite(num)) {
      return NextResponse.json({ error: `questions[${i}].number must be numeric` }, { status: 400 });
    }
    if (typeof q.content !== "string" || !q.content.trim()) {
      return NextResponse.json({ error: `questions[${i}].content is required` }, { status: 400 });
    }
    if (!Q_TYPES.has(q.q_type)) {
      return NextResponse.json({ error: `questions[${i}].q_type must be one of ${[...Q_TYPES].join("|")}` }, { status: 400 });
    }
    if (q.options == null || typeof q.options !== "object") {
      return NextResponse.json({ error: `questions[${i}].options must be an object` }, { status: 400 });
    }
    questionRows.push({
      number: num,
      content: q.content,
      q_type: q.q_type,
      options: q.options,
      answer: q.answer ?? null,
      level: q.level ?? null,
      explanation: q.explanation ?? null,
    });
  }

  const categoryId = newId();
  const categoryBody = {
    id: categoryId,
    owner_id: user.id,
    language: payload.language,
    parent_id: null,
    position: 0,
    is_folder: false,
    name: payload.name,
    dropdown: [],
    dropdown_align: null,
  };

  const catRes = await fetch(`${SUPABASE_URL}/rest/v1/qsets`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(categoryBody),
  });
  if (!catRes.ok) {
    return NextResponse.json({ error: `category insert failed: ${await catRes.text()}` }, { status: 500 });
  }

  const rowsWithFk = questionRows.map((r) => ({ ...r, qsets_id: categoryId }));
  const qRes = await fetch(`${SUPABASE_URL}/rest/v1/questions`, {
    method: "POST",
    headers: { ...HEADERS, Prefer: "return=representation" },
    body: JSON.stringify(rowsWithFk),
  });
  if (!qRes.ok) {
    // Roll back the category insert so we don't leave an empty shell.
    await fetch(`${SUPABASE_URL}/rest/v1/qsets?id=eq.${encodeURIComponent(categoryId)}`, {
      method: "DELETE",
      headers: HEADERS,
    });
    return NextResponse.json({ error: `questions insert failed: ${await qRes.text()}` }, { status: 500 });
  }

  return NextResponse.json({
    categoryId,
    inserted: questionRows.length,
  });
}
