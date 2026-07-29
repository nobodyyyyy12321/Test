import { auth } from "../../auth";
import { findUserByName, findUserByEmail } from "../../lib/users-supabase";
import type { InitialProfile } from "./ProfileClient";

export type LoadedProfile = {
  user: NonNullable<Awaited<ReturnType<typeof findUserByName>>>;
  isOwner: boolean;
  initialProfile: InitialProfile;
};

export async function loadProfileData(urlName: string): Promise<LoadedProfile | null> {
  const user = await findUserByName(urlName).catch(() => null);
  if (!user) return null;

  let isOwner = false;
  try {
    const session = await auth();
    const sessionEmail = (session?.user as { email?: string } | undefined)?.email;
    const sessionName = (session?.user as { name?: string } | undefined)?.name;
    if (sessionEmail) {
      const sessionUser = await findUserByEmail(sessionEmail).catch(() => null);
      if (sessionUser && sessionUser.id === user.id) isOwner = true;
    }
    if (!isOwner && sessionName === urlName) isOwner = true;
  } catch {
    // not authenticated — isOwner stays false
  }

  const initialProfile: InitialProfile = {
    id: user.id,
    name: user.name,
    email: user.email,
    emailPublic: user.emailPublic,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    socialLinks: user.socialLinks as Record<string, string | undefined> | undefined,
    records: isOwner ? (user.records as InitialProfile["records"]) : undefined,
  };

  return { user, isOwner, initialProfile };
}
