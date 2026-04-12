import { NextResponse } from "next/server";
import { findUserByEmail, findUserByName, updateUser } from "../../../../lib/users";
import { getFirestoreDB } from "../../../../lib/firebase-admin";
import type { Session } from "next-auth";
import { auth } from "../../../../auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nameParam = searchParams.get("name");

    // If name parameter is provided, fetch that user's public profile
    if (nameParam) {
      const user = await findUserByName(nameParam);
      if (!user) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Determine if the requester is the owner (authenticated and same email)
      let isOwner = false;
      try {
        const session = (await auth()) as unknown as Session | null;
        if (session?.user?.email) {
          const found = await findUserByEmail(session.user.email as string);
          if (found && found.id === user.id) isOwner = true;
        }
      } catch (e) {
        // ignore auth errors — treat as not owner
      }

      // Return data: include recitations only if owner or public
      const { id, name, email, bio, avatarUrl, socialLinks, recitations, recitationsPublic, emailPublic, records, studyChineseRecords } = user;
      const outRecitations = isOwner ? recitations : (recitationsPublic ? recitations : []);
      const outRecords = isOwner ? records : (recitationsPublic ? records : []);
      const outStudyChineseRecords = isOwner ? studyChineseRecords : (recitationsPublic ? studyChineseRecords : []);
      const profilePublic = Boolean(recitationsPublic || emailPublic);
      return NextResponse.json({
        ok: true,
        user: { id, name, email, bio, avatarUrl, socialLinks, recitations: outRecitations, recitationsPublic, emailPublic, isOwner, profilePublic, records: outRecords, studyChineseRecords: outStudyChineseRecords }
      });
    }

    // Otherwise, return the authenticated user's own profile
    const session = (await auth()) as unknown as Session | null;
    const sessionEmail = session?.user?.email as string | undefined;
    const sessionName = session?.user?.name as string | undefined;
    if (!sessionEmail && !sessionName) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = sessionEmail ? await findUserByEmail(sessionEmail) : undefined;
    if (!user && sessionName) {
      user = await findUserByName(sessionName);
    }
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { id, name, email, bio, avatarUrl, socialLinks, recitations, recitationsPublic, emailPublic, records, studyChineseRecords } = user;
    return NextResponse.json({ ok: true, user: { id, name, email, bio, avatarUrl, socialLinks, recitations, recitationsPublic, emailPublic, records, studyChineseRecords } });
  } catch (e) {
    console.error("GET User Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = (await auth()) as unknown as Session | null;
    const sessionEmail = session?.user?.email as string | undefined;
    const sessionName = session?.user?.name as string | undefined;
    if (!sessionEmail && !sessionName) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    let user = sessionEmail ? await findUserByEmail(sessionEmail) : undefined;
    if (!user && sessionName) {
      user = await findUserByName(sessionName);
    }
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: any = {};
    
    // 安全檢查並整理更新欄位
    if (typeof body.bio === "string") updates.bio = body.bio;
    if (typeof body.avatarUrl === "string") updates.avatarUrl = body.avatarUrl;
    // Enforce name-change cooldown: only allow changing display name once per 7 days
    if (typeof body.name === "string" && body.name !== user.name) {
      const existingWithName = await findUserByName(body.name);
      if (existingWithName && existingWithName.id !== user.id) {
        return NextResponse.json({ error: "此名稱已被使用" }, { status: 409 });
      }
      updates.name = body.name;
      updates.nameUpdatedAt = new Date().toISOString();
    }
    if (body.socialLinks && typeof body.socialLinks === "object") {
      updates.socialLinks = body.socialLinks;
    }
    if (typeof body.recitationsPublic === "boolean") {
      updates.recitationsPublic = body.recitationsPublic;
    }
    if (typeof body.emailPublic === "boolean") {
      updates.emailPublic = body.emailPublic;
    }

    const updated = await updateUser(user.id, updates);

    return NextResponse.json({ ok: true, user: updated });
  } catch (e) {
    console.error("PATCH User Error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}