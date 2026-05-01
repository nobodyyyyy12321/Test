import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName, updateUser } from "../../../../lib/users";

const AVATAR_BUCKET = process.env.SUPABASE_AVATAR_BUCKET || "avatars";

export async function POST(req: Request) {
  try {
    // require authenticated user
    const session = (await auth()) as any | null;
    const sessionEmail = session?.user?.email as string | undefined;
    const sessionName = session?.user?.name as string | undefined;
    if (!sessionEmail && !sessionName) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = sessionEmail ? await findUserByEmail(sessionEmail) : undefined;
    if (!user && sessionName) user = await findUserByName(sessionName);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const rawData = typeof body?.data === "string" ? body.data.trim() : "";
    // expect data URL: data:image/png;base64,....
    if (!rawData) return NextResponse.json({ error: "No data provided" }, { status: 400 });

    const commaIndex = rawData.indexOf(",");
    if (commaIndex <= 0) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

    const header = rawData.slice(0, commaIndex);
    const base64Part = rawData.slice(commaIndex + 1);
    const mimeMatch = header.match(/^data:(image\/[a-zA-Z0-9.+-]+)(;[^,]*)?;base64$/i);
    if (!mimeMatch || !base64Part) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    const mime = mimeMatch[1].toLowerCase();
    const allowedMimes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    if (!allowedMimes.has(mime)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }

    const ext = mime.split("/")[1] || "png";
    const buffer = Buffer.from(base64Part, "base64");
    if (!buffer.length) {
      return NextResponse.json({ error: "Invalid image payload" }, { status: 400 });
    }
    const maxBytes = 5 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return NextResponse.json({ error: "Image too large (max 5MB)" }, { status: 413 });
    }

    const sb = getSupabaseAdmin();
    const filename = `${user.id}/${uuidv4()}.${ext}`;

    const { error: uploadError } = await sb
      .storage
      .from(AVATAR_BUCKET)
      .upload(filename, buffer, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) {
      console.error("Supabase avatar upload failed:", uploadError);
      return NextResponse.json({ error: "Avatar upload failed" }, { status: 500 });
    }

    // `getPublicUrl` returns a URL even when bucket is private; that URL won't be readable.
    // Prefer a long-lived signed URL so avatars render for both private and public buckets.
    const { data: signedData, error: signedErr } = await sb
      .storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(filename, 60 * 60 * 24 * 365 * 10);

    let url = signedData?.signedUrl || "";
    if (!url) {
      if (signedErr) {
        console.warn("Supabase signed URL failed, fallback to public URL:", signedErr);
      }
      const publicResult = sb.storage.from(AVATAR_BUCKET).getPublicUrl(filename);
      url = publicResult.data.publicUrl;
    }
    if (!url) {
      return NextResponse.json({ error: "Avatar upload succeeded but URL generation failed" }, { status: 500 });
    }

    // update user record
    await updateUser(user.id, { avatarUrl: url });

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("avatar upload internal error:", e);
    return NextResponse.json({ error: "Internal error: avatar upload failed" }, { status: 500 });
  }
}