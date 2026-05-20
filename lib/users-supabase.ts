import { getSupabaseAdmin } from "./supabase-admin";

export type User = {
  id: string;
  name: string;
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  verificationToken?: string;
  verificationExpires?: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: {
    twitter?: string;
    github?: string;
    website?: string;
    [key: string]: string | undefined;
  };
  recitations?: Array<{
    articleId: string;
    articleNumber: number;
    title: string;
    success: boolean;
    timestamp: string;
  }>;
  recitationsPublic?: boolean;
  emailPublic?: boolean;
  googleId?: string;
  pendingGoogleLinkExpires?: string;
  profileLanguage?: string;
  records?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    answers?: { n: number; u: string | string[] | null }[];
  }>;
};

// ── row → User ───────────────────────────────────────────────────────────────

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? undefined,
    passwordHash: (row.password_hash as string | null) ?? undefined,
    emailVerified: (row.email_verified as boolean | null) ?? false,
    verificationToken: (row.verification_token as string | null) ?? undefined,
    verificationExpires: (row.verification_expires as string | null) ?? undefined,
    bio: (row.bio as string | null) ?? undefined,
    avatarUrl: (row.avatar_url as string | null) ?? undefined,
    socialLinks: (row.social_links as User["socialLinks"]) ?? {},
    recitationsPublic: (row.recitations_public as boolean | null) ?? false,
    emailPublic: (row.email_public as boolean | null) ?? false,
    googleId: (row.google_id as string | null) ?? undefined,
    pendingGoogleLinkExpires: (row.pending_google_link_expires as string | null) ?? undefined,
    profileLanguage: (row.profile_language as string | null) ?? undefined,
  };
}

async function attachRecordsAndRecitations(user: User): Promise<User> {
  const db = getSupabaseAdmin();
  const [recRows, recitRows] = await Promise.all([
    db
      .from("practices")
      .select("answered,correct,set,timestamp,answers")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false })
      .limit(50),
    db
      .from("recitations")
      .select("article_id,article_number,title,success,timestamp")
      .eq("user_id", user.id)
      .order("timestamp", { ascending: false }),
  ]);

  const allRecords = (recRows.data ?? []) as Array<{
    answered: number; correct: number; set: string;
    timestamp: string; answers: unknown;
  }>;

  user.records = allRecords.map((r) => ({
    answered: r.answered,
    correct: r.correct,
    set: r.set,
    timestamp: r.timestamp,
    answers: r.answers as { n: number; u: string | string[] | null }[] | undefined,
  }));

  user.recitations = (recitRows.data ?? []).map((r: any) => ({
    articleId: r.article_id,
    articleNumber: r.article_number,
    title: r.title,
    success: r.success,
    timestamp: r.timestamp,
  }));

  return user;
}



export async function searchUsersByName(
  query: string,
  limit = 10
): Promise<Pick<User, "id" | "name" | "avatarUrl">[]> {
  if (!query) return [];
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("users")
    .select("id,name,avatar_url")
    .ilike("name", `${query}%`)
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url ?? undefined,
  }));
}

export async function getUsers(): Promise<User[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("users").select("*");
  return (data ?? []).map(rowToUser);
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  if (!email) return undefined;
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("users")
    .select("*")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data) return undefined;
  return attachRecordsAndRecitations(rowToUser(data));
}

export async function findUserByName(name: string): Promise<User | undefined> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("users")
    .select("*")
    .eq("name", name)
    .maybeSingle();
  if (!data) return undefined;
  return attachRecordsAndRecitations(rowToUser(data));
}

export async function findUserByVerificationToken(
  token: string
): Promise<User | undefined> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("users")
    .select("*")
    .eq("verification_token", token)
    .maybeSingle();
  if (!data) return undefined;
  return rowToUser(data);
}

export async function findUserById(id: string): Promise<User | undefined> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("users")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!data) return undefined;
  return attachRecordsAndRecitations(rowToUser(data));
}

export async function saveUser(user: User): Promise<void> {
  const db = getSupabaseAdmin();
  const row: Record<string, unknown> = {
    id: user.id,
    name: user.name,
    email: user.email?.toLowerCase() ?? null,
    password_hash: user.passwordHash ?? null,
    email_verified: user.emailVerified ?? false,
    verification_token: user.verificationToken ?? null,
    verification_expires: user.verificationExpires ?? null,
    bio: user.bio ?? null,
    avatar_url: user.avatarUrl ?? null,
    social_links: user.socialLinks ?? {},
    recitations_public: user.recitationsPublic ?? false,
    email_public: user.emailPublic ?? false,
    profile_language: user.profileLanguage ?? null,
  };
  const { error } = await db.from("users").upsert(row);
  if (error) throw error;
}

export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  const db = getSupabaseAdmin();
  const row: Record<string, unknown> = {};

  if (updates.name !== undefined) row.name = updates.name;
  if (updates.email !== undefined) row.email = updates.email.toLowerCase();
  if (updates.passwordHash !== undefined) row.password_hash = updates.passwordHash;
  if (updates.emailVerified !== undefined) row.email_verified = updates.emailVerified;
  if (updates.verificationToken !== undefined) row.verification_token = updates.verificationToken;
  if (updates.verificationExpires !== undefined) row.verification_expires = updates.verificationExpires;
  if (updates.bio !== undefined) row.bio = updates.bio;
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl;
  if (updates.socialLinks !== undefined) row.social_links = updates.socialLinks;
  if (updates.recitationsPublic !== undefined) row.recitations_public = updates.recitationsPublic;
  if (updates.emailPublic !== undefined) row.email_public = updates.emailPublic;
  if (updates.googleId !== undefined) row.google_id = updates.googleId ?? null;
  if (updates.pendingGoogleLinkExpires !== undefined) row.pending_google_link_expires = updates.pendingGoogleLinkExpires ?? null;
  if (updates.profileLanguage !== undefined) row.profile_language = updates.profileLanguage ?? null;

  if (Object.keys(row).length === 0) {
    return (await findUserById(id)) ?? null;
  }

  const { error } = await db.from("users").update(row).eq("id", id);
  if (error) {
    console.error("updateUser error:", error);
    return null;
  }
  return (await findUserById(id)) ?? null;
}

// ── practice helpers (called by record API routes) ──────────────────────────

export async function appendPractice(
  userEmail: string,
  record: {
    answered: number;
    correct: number;
    set: string;
    answers?: unknown[];
  }
): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: u } = await db
    .from("users")
    .select("id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (!u) throw new Error("User not found");

  const { error } = await db.from("practices").insert({
    user_id: u.id,
    answered: record.answered,
    correct: record.correct,
    set: record.set,
    timestamp: new Date().toISOString(),
    answers: record.answers ?? null,
  });
  if (error) throw error;

  const { data: all, error: fetchError } = await db
    .from("practices")
    .select("id")
    .eq("user_id", u.id)
    .order("timestamp", { ascending: false });
  if (fetchError) { console.error("fetch practices error", fetchError); throw fetchError; }
  if (all && all.length > 10) {
    const idsToDelete = all.slice(10).map((r) => r.id);
    const { error: delError } = await db
      .from("practices")
      .delete()
      .in("id", idsToDelete);
    if (delError) { console.error("delete practices error", delError); throw delError; }
  }
}

// ── recitation helper ─────────────────────────────────────────────────────────

export async function appendRecitation(
  userEmail: string,
  rec: {
    articleId: string;
    articleNumber: number;
    title: string;
    success: boolean;
    timestamp: string;
  }
): Promise<void> {
  const db = getSupabaseAdmin();
  const { data: u } = await db
    .from("users")
    .select("id")
    .eq("email", userEmail.toLowerCase())
    .maybeSingle();
  if (!u) throw new Error("User not found");

  const { error } = await db.from("recitations").insert({
    user_id: u.id,
    article_id: rec.articleId,
    article_number: rec.articleNumber,
    title: rec.title,
    success: rec.success,
    timestamp: rec.timestamp,
  });
  if (error) throw error;
}

// ── blocks ────────────────────────────────────────────────────────────────────

export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from("blocks").upsert({ blocker_id: blockerId, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const db = getSupabaseAdmin();
  await db.from("blocks").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
}

export async function isBlocking(blockerId: string, blockedId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("blocks").select("blocker_id").eq("blocker_id", blockerId).eq("blocked_id", blockedId).maybeSingle();
  return !!data;
}

export async function hasBlockRelationship(userIdA: string, userIdB: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { data } = await db
    .from("blocks")
    .select("blocker_id")
    .or(`and(blocker_id.eq.${userIdA},blocked_id.eq.${userIdB}),and(blocker_id.eq.${userIdB},blocked_id.eq.${userIdA})`)
    .limit(1)
    .maybeSingle();
  return !!data;
}

export async function getBlockedList(blockerId: string): Promise<{ id: string; name: string; avatarUrl?: string }[]> {
  const db = getSupabaseAdmin();
  const { data } = await db.from("blocks").select("blocked_id").eq("blocker_id", blockerId);
  if (!data?.length) return [];
  const ids = data.map((r: Record<string, unknown>) => r.blocked_id as string);
  const { data: users } = await db.from("users").select("id,name,avatar_url").in("id", ids);
  return (users ?? []).map((u: Record<string, unknown>) => ({
    id: u.id as string,
    name: u.name as string,
    avatarUrl: u.avatar_url as string | undefined,
  }));
}
