import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AdminEmailClient from "./AdminEmailClient";

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export default async function AdminEmailPage() {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) redirect("/");

  return <AdminEmailClient adminEmail={(session?.user as any)?.email ?? ""} />;
}
