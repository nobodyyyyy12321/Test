import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { getFoldersPayload, patchFolderOp } from "@/lib/my-folders-api";

/** @deprecated Use /api/my-collections?foldersOnly=1 — kept for compatibility */
async function getUser() {
  const session = await auth();
  const email = (session?.user as { email?: string })?.email;
  const name = session?.user?.name ?? undefined;
  if (!email && !name) return null;
  return email ? findUserByEmail(email) : findUserByName(name!);
}

export async function GET() {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json(await getFoldersPayload(user.id));
  } catch (err) {
    console.error("GET /api/my-categories error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message, folders: [] }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const result = await patchFolderOp(user.id, body);
    if (result.status !== 200) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, folders: result.folders });
  } catch (err) {
    console.error("PATCH /api/my-categories error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
