import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { findUserByEmail } from "../../../../../lib/users";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await findUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      linked: !!user.googleId,
      hasPassword: !!user.passwordHash,
    });
  } catch (e) {
    console.error("link-google/status error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
