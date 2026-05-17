import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { auth } from "../../auth";
import { findUserByName, findUserByEmail } from "../../lib/users";
import { AVATAR_PLACEHOLDER } from "../../lib/asset-version";
import ProfileClient from "./ProfileClient";

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
    title: `${user.name} — Test`,
    description: user.bio || (isEn ? `${user.name}'s profile page` : `${user.name} 的個人頁面`),
    openGraph: {
      title: `${user.name} — Test`,
      description: user.bio || undefined,
      images: [{ url: user.avatarUrl || AVATAR_PLACEHOLDER }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${user.name} — Test`,
      description: user.bio || (isEn ? `${user.name}'s profile page` : `${user.name} 的個人頁面`),
      images: [user.avatarUrl || AVATAR_PLACEHOLDER],
    },
  };
}

export const dynamic = "force-dynamic";

export default async function AccountPage({ params }: Props) {
  const { name } = await params;
  const urlName = decodeURIComponent(name);

  const user = await findUserByName(urlName).catch(() => null);
  if (!user) notFound();

  let isOwner = false;
  try {
    const session = await auth();
    const sessionEmail = (session?.user as any)?.email as string | undefined;
    const sessionName = (session?.user as any)?.name as string | undefined;
    if (sessionEmail) {
      const sessionUser = await findUserByEmail(sessionEmail).catch(() => null);
      if (sessionUser && sessionUser.id === user.id) isOwner = true;
    }
    // fallback: name match (covers cases where email lookup fails)
    if (!isOwner && sessionName === urlName) isOwner = true;
  } catch {
    // not authenticated — isOwner stays false
  }

  const initialProfile = {
    id: user.id,
    name: user.name,
    email: user.email,         // always pass email so client can compare
    emailPublic: user.emailPublic,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    socialLinks: user.socialLinks as Record<string, string | undefined> | undefined,
    records: isOwner ? (user.records as any[]) : undefined,
  };

  return (
    <ProfileClient
      key={urlName}
      urlName={urlName}
      isOwner={isOwner}
      initialProfile={initialProfile}
    />
  );
}
