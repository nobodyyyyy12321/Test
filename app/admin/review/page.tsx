import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listPendingUploads } from "@/lib/pending-uploads";
import ReviewClient from "./ReviewClient";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export default async function AdminReviewPage() {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) redirect("/");

  const uploads = await listPendingUploads();
  return <ReviewClient initialUploads={uploads} />;
}
