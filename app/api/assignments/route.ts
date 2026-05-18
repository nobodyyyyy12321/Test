import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { createAssignment, getAssignmentsByAssignee, getAssignmentsByAssigner, evictOldestTerminal } from "@/lib/assignments-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sourceResourceId = typeof body.sourceResourceId === "string" ? body.sourceResourceId.trim() : "";
  const assigneeId = typeof body.assigneeId === "string" ? body.assigneeId.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt.trim() : "";
  const endAt = typeof body.endAt === "string" ? body.endAt.trim() : "";

  if (!sourceResourceId || !assigneeId || !title || !startAt || !endAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (new Date(endAt).getTime() - new Date(startAt).getTime() < 60000) {
    return NextResponse.json({ error: "Window must be at least 1 minute" }, { status: 400 });
  }

  if (new Date(startAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "startAt must be in the future" }, { status: 400 });
  }

  // Check block relationship
  const sb = (await import("@/lib/supabase-admin")).getSupabaseAdmin();
  const { data: block } = await sb
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${assigneeId}),and(blocker_id.eq.${assigneeId},blocked_id.eq.${user.id})`)
    .maybeSingle();
  if (block) {
    return NextResponse.json({ error: "Block relationship exists" }, { status: 403 });
  }

  await evictOldestTerminal(user.id);
  await evictOldestTerminal(assigneeId);

  const assignment = await createAssignment({
    assignerId: user.id,
    assigneeId,
    sourceResourceId,
    title,
    startAt,
    endAt,
  });

  if (!assignment) return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 });
  return NextResponse.json({ assignment });
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  if (scope === "inbox") {
    const assignments = await getAssignmentsByAssignee(user.id);
    return NextResponse.json({ assignments });
  }

  if (scope === "outbox") {
    const assignments = await getAssignmentsByAssigner(user.id);
    return NextResponse.json({ assignments });
  }

  return NextResponse.json({ error: "scope required (inbox or outbox)" }, { status: 400 });
}
