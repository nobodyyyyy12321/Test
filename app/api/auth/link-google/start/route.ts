import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail, updateUser } from "../../../../../lib/users";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.googleId) {
      return NextResponse.json({ ok: false, message: "already_linked" });
    }

    // Set a 5-minute window for the OAuth callback to complete the link.
    const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await updateUser(user.id, { pendingGoogleLinkExpires: expires });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("link-google/start error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
