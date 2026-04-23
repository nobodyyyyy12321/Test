import { auth } from "@/auth";
import { createPendingUpload } from "@/lib/pending-uploads";
import type { CategoryNode } from "@/lib/categories";

type QuestionRow = {
  number: number;
  title: string;
  type?: "single" | "multiple" | "fill";
  options?: Record<string, string>;
  answer?: string | string[];
  level?: number | null;
  groupContent?: string | null;
  [key: string]: unknown;
};

type UploadPayload = {
  language?: string;
  categories?: CategoryNode[];
  collections?: Record<string, QuestionRow[]>;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: UploadPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.categories && !payload.collections) {
    return Response.json({ error: "Nothing to upload — provide categories and/or collections" }, { status: 400 });
  }

  let record;
  try {
    record = await createPendingUpload({
      submitter_email: (session.user as any).email ?? null,
      submitter_name: session.user.name ?? null,
      payload,
    });
  } catch (err: any) {
    console.error("createPendingUpload failed:", err);
    return Response.json({ ok: false, error: err?.message ?? "儲存失敗" }, { status: 500 });
  }

  return Response.json({ ok: true, pendingId: record.id, status: "pending" });
}
