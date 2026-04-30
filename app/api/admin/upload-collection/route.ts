import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

type Item =
  | { id: number | string; type: "single_choice" | "multiple_choice"; title: string;
      options: Record<string, string>; answer?: string | null }
  | { id: number | string; type: "group"; content: string };

type Payload = { examName: string; items: Item[] };

function parseQuestionNumber(id: number | string): number | null {
  if (typeof id === "number") return Number.isFinite(id) ? id : null;
  const n = parseInt(String(id), 10);
  return Number.isFinite(n) ? n : null;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Payload;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.examName || typeof body.examName !== "string") {
    return Response.json({ error: "examName is required" }, { status: 400 });
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return Response.json({ error: "items must be a non-empty array" }, { status: 400 });
  }

  const examName = body.examName.trim();
  const groupRows: { exam_name: string; group_id: string; content: string }[] = [];
  const questionRows: {
    exam_name: string; number: number; title: string;
    type: string; options: Record<string, string>; answer: string | null;
  }[] = [];
  const seenNumbers = new Set<number>();
  const errors: string[] = [];

  body.items.forEach((it, idx) => {
    if (it.type === "group") {
      if (!it.id || typeof it.content !== "string") {
        errors.push(`第 ${idx + 1} 項 group 缺少 id 或 content`);
        return;
      }
      groupRows.push({ exam_name: examName, group_id: String(it.id), content: it.content });
      return;
    }
    if (it.type !== "single_choice" && it.type !== "multiple_choice") {
      errors.push(`第 ${idx + 1} 項 type 不正確：${(it as any).type}`);
      return;
    }
    const number = parseQuestionNumber(it.id);
    if (number === null) {
      errors.push(`第 ${idx + 1} 項 id 無法解析為題號`);
      return;
    }
    if (seenNumbers.has(number)) {
      errors.push(`題號 ${number} 重複`);
      return;
    }
    seenNumbers.add(number);
    if (!it.title) {
      errors.push(`題號 ${number} 缺少 title`);
      return;
    }
    if (!it.options || typeof it.options !== "object") {
      errors.push(`題號 ${number} 缺少 options`);
      return;
    }
    questionRows.push({
      exam_name: examName,
      number,
      title: it.title,
      type: it.type,
      options: it.options,
      answer: it.answer ?? null,
    });
  });

  if (errors.length > 0) {
    return Response.json({ error: errors.join("\n") }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Replace any existing rows for this exam_name so re-uploads are idempotent
  const [delQ, delG] = await Promise.all([
    supabase.from("questions").delete().eq("exam_name", examName),
    supabase.from("question_groups").delete().eq("exam_name", examName),
  ]);
  if (delQ.error) return Response.json({ error: `delete questions failed: ${delQ.error.message}` }, { status: 500 });
  if (delG.error) return Response.json({ error: `delete question_groups failed: ${delG.error.message}` }, { status: 500 });

  if (groupRows.length > 0) {
    const { error } = await supabase.from("question_groups").insert(groupRows);
    if (error) return Response.json({ error: `insert question_groups failed: ${error.message}` }, { status: 500 });
  }
  if (questionRows.length > 0) {
    const { error } = await supabase.from("questions").insert(questionRows);
    if (error) return Response.json({ error: `insert questions failed: ${error.message}` }, { status: 500 });
  }

  return Response.json({
    ok: true,
    examName,
    insertedQuestions: questionRows.length,
    insertedGroups: groupRows.length,
  });
}
