import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "quiz-assets";
const ALLOWED_EXT = /\.(jpe?g|png|webp|gif|bmp|svg)$/i;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path || !ALLOWED_EXT.test(path)) {
    return new NextResponse("Invalid path", { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage.from(BUCKET).download(path);

  if (error || !data) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.split(".").pop()?.toLowerCase();
  const mime: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    webp: "image/webp", gif: "image/gif", bmp: "image/bmp",
    svg: "image/svg+xml",
  };

  return new NextResponse(data, {
    headers: {
      "Content-Type": mime[ext ?? ""] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
