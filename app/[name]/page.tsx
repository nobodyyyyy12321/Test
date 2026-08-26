import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { findUserByName } from "../../lib/users-supabase";
import { AVATAR_PLACEHOLDER } from "../lib/asset-version";
import ProfileClient from "./ProfileClient";
import { loadProfileData } from "./_shared";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const urlName = decodeURIComponent(name);
  const cookieStore = await cookies();
  const lang = cookieStore.get("siteLanguage")?.value ?? "zh-TW";
  const isEn = lang === "en";
  const user = await findUserByName(urlName).catch(() => null);
  if (!user) return { title: isEn ? "User Not Found" : "找不到使用者" };
  return {
    title: `${user.name}`,
    description: user.bio || (isEn ? `${user.name}'s profile page` : `${user.name} 的個人頁面`),
    openGraph: {
      siteName: "wikiTest",
      title: `${user.name}`,
      description: user.bio || undefined,
      images: [{ url: user.avatarUrl || AVATAR_PLACEHOLDER }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${user.name}`,
      description: user.bio || (isEn ? `${user.name}'s profile page` : `${user.name} 的個人頁面`),
      images: [user.avatarUrl || AVATAR_PLACEHOLDER],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: Props) {
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
    />
  );
}
