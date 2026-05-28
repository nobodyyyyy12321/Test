import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail } from "../../../../lib/users-supabase";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ pinnedCats: [], pinnedCollectionIds: [], pinnedListIds: [] });
  const db = getSupabaseAdmin();
  const { data } = await db.from("users").select("pinned_cats,pinned_collection_ids,pinned_list_ids").eq("id", me.id).maybeSingle();
  return NextResponse.json({
    pinnedCats: (data?.pinned_cats as string[]) ?? [],
    pinnedCollectionIds: (data?.pinned_collection_ids as string[]) ?? [],
    pinnedListIds: (data?.pinned_list_ids as string[]) ?? [],
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
  if (Array.isArray(body.pinnedCollectionIds)) update.pinned_collection_ids = body.pinnedCollectionIds;
  if (Array.isArray(body.pinnedListIds)) update.pinned_list_ids = body.pinnedListIds;
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true });
  const { error } = await db.from("users").update(update).eq("id", me.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
