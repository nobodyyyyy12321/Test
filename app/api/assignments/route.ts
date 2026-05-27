import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users-supabase";
import { createAssignment, getAssignmentsByAssignee, getAssignmentsByAssigner, evictOldestTerminal, gradeAssignment } from "@/lib/assignments-supabase";
import { getGroupWithMembers } from "@/lib/groups-supabase";
import { getListById } from "@/lib/lists-supabase";

async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string } | undefined)?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

type SkippedReason = "blocked" | "self" | "unknown_user" | "group_not_found";

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
  const rawType = typeof body.sourceResourceType === "string" ? body.sourceResourceType.trim() : "qset";
  const sourceResourceType: "qset" | "list" = rawType === "list" ? "list" : "qset";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const startAt = typeof body.startAt === "string" ? body.startAt.trim() : "";
  const endAt = typeof body.endAt === "string" ? body.endAt.trim() : "";

  const rawAssigneeIds = Array.isArray(body.assigneeIds)
    ? body.assigneeIds.filter((s): s is string => typeof s === "string" && s.trim() !== "").map(s => s.trim())
    : [];
  const rawGroupIds = Array.isArray(body.groupIds)
    ? body.groupIds.filter((s): s is string => typeof s === "string" && s.trim() !== "").map(s => s.trim())
    : [];

  if (!sourceResourceId || !title || !startAt || !endAt) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // For list sources, only the owner may assign.
  if (sourceResourceType === "list") {
    const list = await getListById(sourceResourceId);
    if (!list) return NextResponse.json({ error: "List not found" }, { status: 404 });
    if (list.ownerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (rawAssigneeIds.length === 0 && rawGroupIds.length === 0) {
    return NextResponse.json({ error: "At least one assignee or group required" }, { status: 400 });
  }

  if (new Date(endAt).getTime() - new Date(startAt).getTime() < 60000) {
    return NextResponse.json({ error: "Window must be at least 1 minute" }, { status: 400 });
  }

  if (new Date(startAt).getTime() <= Date.now()) {
    return NextResponse.json({ error: "startAt must be in the future" }, { status: 400 });
  }

  const skipped: Array<{ userId: string; reason: SkippedReason }> = [];

  // Expand groups → accepted member userIds
  const expanded = new Set<string>(rawAssigneeIds);
  for (const groupId of rawGroupIds) {
    const group = await getGroupWithMembers(groupId);
    if (!group) {
      skipped.push({ userId: groupId, reason: "group_not_found" });
      continue;
    }
    for (const m of group.members ?? []) {
      if (m.status === "accepted") expanded.add(m.userId);
    }
  }

  // Drop self
  if (expanded.has(user.id)) {
    expanded.delete(user.id);
    skipped.push({ userId: user.id, reason: "self" });
  }

  if (expanded.size === 0) {
    return NextResponse.json({ created: 0, skipped, assignments: [] });
  }

  const candidateIds = [...expanded];

  const sb = (await import("@/lib/supabase-admin")).getSupabaseAdmin();

  // Block check — fetch any block relationship between user and any candidate in one query
  const { data: blocks } = await sb
    .from("blocks")
    .select("blocker_id, blocked_id")
    .or(
      `and(blocker_id.eq.${user.id},blocked_id.in.(${candidateIds.join(",")})),` +
      `and(blocked_id.eq.${user.id},blocker_id.in.(${candidateIds.join(",")}))`
    );
  const blockedIds = new Set<string>();
  for (const b of (blocks ?? []) as Array<{ blocker_id: string; blocked_id: string }>) {
    if (b.blocker_id === user.id) blockedIds.add(b.blocked_id);
    else blockedIds.add(b.blocker_id);
  }

  const finalIds = candidateIds.filter(id => {
    if (blockedIds.has(id)) {
      skipped.push({ userId: id, reason: "blocked" });
      return false;
    }
    return true;
  });

  // Verify users actually exist (cheap sanity check)
  const { data: existingUsers } = await sb.from("users").select("id").in("id", finalIds);
  const existingSet = new Set<string>((existingUsers ?? []).map((u: { id: string }) => u.id));

  const toCreate = finalIds.filter(id => {
    if (!existingSet.has(id)) {
      skipped.push({ userId: id, reason: "unknown_user" });
      return false;
    }
    return true;
  });

  if (toCreate.length === 0) {
    return NextResponse.json({ created: 0, skipped, assignments: [] });
  }

  await evictOldestTerminal(user.id);

  const assignments = [];
  for (const assigneeId of toCreate) {
    await evictOldestTerminal(assigneeId);
    const a = await createAssignment({
      assignerId: user.id,
      assigneeId,
      sourceResourceId,
      sourceResourceType,
      title,
      startAt,
      endAt,
    });
    if (a) assignments.push(a);
  }

  return NextResponse.json({ created: assignments.length, skipped, assignments });
}

export async function GET(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");

  let assignments: Awaited<ReturnType<typeof getAssignmentsByAssignee>>;
  if (scope === "inbox") {
    assignments = await getAssignmentsByAssignee(user.id);
  } else if (scope === "outbox") {
    assignments = await getAssignmentsByAssigner(user.id);
  } else {
    return NextResponse.json({ error: "scope required (inbox or outbox)" }, { status: 400 });
  }

  // Lazy grade eligible rows before returning
  const now = Date.now();
  await Promise.all(
    assignments
      .filter(a => a.submittedAt && !a.gradedAt && new Date(a.endAt).getTime() < now)
      .map(a => gradeAssignment(a.id))
  );
  // Re-fetch to get updated scores
  if (scope === "inbox") {
    assignments = await getAssignmentsByAssignee(user.id);
  } else {
    assignments = await getAssignmentsByAssigner(user.id);
  }

  return NextResponse.json({ assignments });
}
