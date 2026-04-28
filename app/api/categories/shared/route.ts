import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { findUserByEmail } from "../../../../lib/users-supabase";
import { getSharedCategoriesForUser } from "../../../../lib/shared-categories-supabase";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const me = await findUserByEmail(session.user.email);
  if (!me) return NextResponse.json({ sharedCategories: [] });
  const sharedCategories = await getSharedCategoriesForUser(me.id, me.name);
  return NextResponse.json({ sharedCategories });
}
