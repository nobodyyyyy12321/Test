import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { findUserByName } from "../../../lib/users-supabase";
import ProfileClient from "../ProfileClient";
import { loadProfileData } from "../_shared";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const urlName = decodeURIComponent(name);
  const cookieStore = await cookies();
  const lang = cookieStore.get("siteLanguage")?.value ?? "zh-TW";
  const isEn = lang === "en";
  const user = await findUserByName(urlName).catch(() => null);
  if (!user) return { title: isEn ? "User Not Found" : "找不到使用者" };
  return { title: isEn ? `${user.name} — Blocked List` : `${user.name} — 封鎖名單` };
}

export const dynamic = "force-dynamic";

export default async function BlockedPage({ params }: Props) {
  const { name } = await params;
  const urlName = decodeURIComponent(name);

  const loaded = await loadProfileData(urlName);
  if (!loaded) notFound();

  return (
    <ProfileClient
      key={urlName}
      urlName={urlName}
      isOwner={loaded.isOwner}
      initialProfile={loaded.initialProfile}
      initialTab="blocked"
    />
  );
}
