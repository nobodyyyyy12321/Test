import { auth } from "@/auth";
import { listPendingUploads } from "@/lib/pending-uploads";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export async function GET() {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  const uploads = await listPendingUploads();
  return Response.json({ uploads });
}
