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
  records?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    category: string;
    answers?: { n: number; u: string | string[] | null }[];
  }>;
  studyChineseRecords?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    category: "學中文";
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
  };
}

async function attachRecordsAndRecitations(user: User): Promise<User> {
  const db = getSupabaseAdmin();
  const [recRows, recitRows] = await Promise.all([
    db
      .from("quiz_records")
      .select("answered,correct,set,timestamp,category,answers")
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
    timestamp: string; category: string; answers: unknown;
  }>;

  user.records = allRecords
    .filter((r) => r.category !== "學中文")
    .map((r) => ({
      answered: r.answered,
      correct: r.correct,
      set: r.set,
      timestamp: r.timestamp,
      category: r.category,
      answers: r.answers as User["records"] extends Array<infer T> ? T["answers"] : never,
    }));

  user.studyChineseRecords = allRecords
    .filter((r) => r.category === "學中文")
    .map((r) => ({
      answered: r.answered,
      correct: r.correct,
      set: r.set,
      timestamp: r.timestamp,
      category: "學中文" as const,
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

// ── public API (same shape as users-firebase.ts) ─────────────────────────────

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

  if (Object.keys(row).length === 0) {
    return findUserById(id) ?? null;
  }

  const { error } = await db.from("users").update(row).eq("id", id);
  if (error) {
    console.error("updateUser error:", error);
    return null;
  }
  return (await findUserById(id)) ?? null;
}

// ── quiz record helpers (called by record API routes) ────────────────────────

export async function appendQuizRecord(
  userEmail: string,
  record: {
    answered: number;
    correct: number;
    set: string;
    category: string;
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

  const { error } = await db.from("quiz_records").insert({
    user_id: u.id,
    answered: record.answered,
    correct: record.correct,
    set: record.set,
    timestamp: new Date().toISOString(),
    category: record.category,
    answers: record.answers ?? null,
  });
  if (error) throw error;
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
