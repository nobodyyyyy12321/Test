import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase-admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  let body: { type?: string; id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const type = body.type;
  const id = body.id;
  if ((type !== "qset" && type !== "list") || typeof id !== "string" || !UUID_RE.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid_input" }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { error } = await db.rpc("increment_visit", { target_type: type, target_id: id });
  if (error) {
    console.error("increment_visit error:", error);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
