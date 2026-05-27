import { NextResponse } from "next/server";
import { findUserByEmail } from "../../../../lib/users-supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ exists: false, emailVerified: false });
    }

    return NextResponse.json({
      exists: true,
      emailVerified: !!user.emailVerified,
    });
  } catch (error) {
    console.error("verification-status error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
