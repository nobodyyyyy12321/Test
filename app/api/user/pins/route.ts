import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail } from "../../../../lib/users-supabase";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

type PinnedProfileTab = { name: string; tab: string; label: string };

// Only these tabs can be pinned to home page
const PINNABLE_TABS = ["lists", "shared"];

function sanitizeProfileTabs(input: unknown): PinnedProfileTab[] | null {
  if (!Array.isArray(input)) return null;
  const out: PinnedProfileTab[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.name !== "string" || typeof o.tab !== "string" || typeof o.label !== "string") continue;
    // Only allow specific pinnable tabs
    if (!PINNABLE_TABS.includes(o.tab)) continue;
    out.push({ name: o.name, tab: o.tab, label: o.label });
  }
  return out;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ pinnedCats: [], pinnedInboxCats: [], pinnedCollectionIds: [], pinnedListIds: [], pinnedProfileTabs: [] });
  const db = getSupabaseAdmin();
  const { data } = await db.from("users").select("pinned_cats,pinned_inbox_cats,pinned_collection_ids,pinned_list_ids,pinned_profile_tabs").eq("id", me.id).maybeSingle();
  return NextResponse.json({
    pinnedCats: (data?.pinned_cats as string[]) ?? [],
    pinnedInboxCats: (data?.pinned_inbox_cats as string[]) ?? [],
    pinnedCollectionIds: (data?.pinned_collection_ids as string[]) ?? [],
    pinnedListIds: (data?.pinned_list_ids as string[]) ?? [],
    pinnedProfileTabs: (data?.pinned_profile_tabs as PinnedProfileTab[]) ?? [],
  });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ error: "user not found" }, { status: 404 });
  const body = await req.json();
  const db = getSupabaseAdmin();
  const update: Record<string, unknown> = {};
  if (Array.isArray(body.pinnedCats)) update.pinned_cats = body.pinnedCats;
  if (Array.isArray(body.pinnedInboxCats)) update.pinned_inbox_cats = body.pinnedInboxCats;
  if (Array.isArray(body.pinnedCollectionIds)) update.pinned_collection_ids = body.pinnedCollectionIds;
  if (Array.isArray(body.pinnedListIds)) update.pinned_list_ids = body.pinnedListIds;
  if (body.pinnedProfileTabs !== undefined) {
    const sanitized = sanitizeProfileTabs(body.pinnedProfileTabs);
    if (sanitized !== null) update.pinned_profile_tabs = sanitized;
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });
  const { error } = await db.from("users").update(update).eq("id", me.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
