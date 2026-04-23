import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCategoriesCached } from "@/lib/categories";
import AdminCategoriesClient from "./AdminCategoriesClient";

const SUPPORTED_LANGS = ["zh-TW", "zh-CN", "en", "ko", "es", "th", "id"];

function isAdmin(email?: string | null): boolean {
  if (!email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map(s => s.trim()).filter(Boolean);
  return allowed.includes(email);
}

export default async function AdminCategoriesPage() {
  const session = await auth();
  if (!isAdmin((session?.user as any)?.email)) redirect("/");

  const entries = await Promise.all(
    SUPPORTED_LANGS.map(async lang => ({
      language: lang,
      data: await getCategoriesCached(lang),
    }))
  );

  return <AdminCategoriesClient initialEntries={entries} />;
}
