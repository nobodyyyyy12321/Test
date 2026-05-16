import { NextResponse } from "next/server";
import { findUserByName } from "../../../../../lib/users";
import { getPublicListsByOwner } from "../../../../../lib/lists-supabase";
import { getUserCollections } from "../../../../../lib/user-collections-supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const user = await findUserByName(decodeURIComponent(name));
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [lists, collections] = await Promise.all([
      getPublicListsByOwner(user.id),
      getUserCollections(user.id),
    ]);

    const publicCollections = collections.filter(
      (collection) =>
        collection.isPublic &&
        collection.approvalStatus !== "pending" &&
        collection.approvalStatus !== "rejected"
    );

    return NextResponse.json({ lists, collections: publicCollections });
  } catch (e) {
    console.error("GET /api/users/[name]/lists error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
