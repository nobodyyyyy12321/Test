import { getFirestoreDB } from "./firebase-admin";

export type User = {
  id: string;
  name: string;
  email?: string;
  passwordHash?: string;
  emailVerified?: boolean;
  verificationToken?: string;
  verificationExpires?: string; // ISO string
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
  quoteRecords?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    category: "名言佳句";
  }>;
  englishRecords?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    category: "英文";
  }>;
  studyChineseRecords?: Array<{
    answered: number;
    correct: number;
    set: string;
    timestamp: string;
    category: "學中文";
  }>;
};

const COLLECTION_NAME = "users";
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 分鐘
const userCacheByEmail = new Map<string, { data: User; ts: number }>();
const userCacheById = new Map<string, { data: User; ts: number }>();

function cacheUser(user: User) {
  const now = Date.now();
  if (user.email) userCacheByEmail.set(user.email.toLowerCase(), { data: user, ts: now });
  userCacheById.set(user.id, { data: user, ts: now });
}

// 輔助函數：將 Firestore 文檔轉換為 User
function docToUser(doc: any): User {
  return {
    id: doc.id,
    ...doc.data(),
  } as User;
}

export async function getUsers(): Promise<User[]> {
  try {
    const db = getFirestoreDB();
    const snapshot = await db.collection(COLLECTION_NAME).get();
    return snapshot.docs.map((doc) => docToUser(doc));
  } catch (error) {
    console.error("Error getting users:", error);
    return [];
  }
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  if (!email) return undefined;
  const key = email.toLowerCase();
  const cached = userCacheByEmail.get(key);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.data;
  try {
    const db = getFirestoreDB();
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("email", "==", key)
      .limit(1)
      .get();

    if (snapshot.empty) return undefined;
    const user = docToUser(snapshot.docs[0]);
    cacheUser(user);
    return user;
  } catch (error) {
    console.error("Error finding user by email:", error);
    return undefined;
  }
}

export async function findUserByName(name: string): Promise<User | undefined> {
  try {
    const db = getFirestoreDB();
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("name", "==", name)
      .limit(1)
      .get();

    if (snapshot.empty) return undefined;
    return docToUser(snapshot.docs[0]);
  } catch (error) {
    console.error("Error finding user by name:", error);
    return undefined;
  }
}

export async function findUserByVerificationToken(
  token: string
): Promise<User | undefined> {
  try {
    const db = getFirestoreDB();
    const snapshot = await db
      .collection(COLLECTION_NAME)
      .where("verificationToken", "==", token)
      .limit(1)
      .get();

    if (snapshot.empty) return undefined;
    return docToUser(snapshot.docs[0]);
  } catch (error) {
    console.error("Error finding user by verification token:", error);
    return undefined;
  }
}

export async function findUserById(id: string): Promise<User | undefined> {
  const cached = userCacheById.get(id);
  if (cached && Date.now() - cached.ts < USER_CACHE_TTL) return cached.data;
  try {
    const db = getFirestoreDB();
    const doc = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!doc.exists) return undefined;
    const user = docToUser(doc);
    cacheUser(user);
    return user;
  } catch (error) {
    console.error("Error finding user by id:", error);
    return undefined;
  }
}

export async function saveUser(user: User): Promise<void> {
  try {
    const db = getFirestoreDB();
    const userData = { ...user };
    delete (userData as any).id; // Firestore 會自動生成 ID，或使用提供的 ID

    if (user.email) {
      userData.email = user.email.toLowerCase();
    }

    await db.collection(COLLECTION_NAME).doc(user.id).set(userData);
  } catch (error) {
    console.error("Error saving user:", error);
    throw error;
  }
}

export async function updateUser(
  id: string,
  updates: Partial<User>
): Promise<User | null> {
  try {
    const db = getFirestoreDB();
    const updateData: any = { ...updates };

    // 移除值為 undefined 的欄位，避免 Firestore update 出錯
    Object.keys(updateData).forEach((k) => {
      if ((updateData as any)[k] === undefined) delete (updateData as any)[k];
    });

    // 如果更新 email，轉換為小寫
    if (updateData.email) {
      updateData.email = updateData.email.toLowerCase();
    }

    // 移除 id 欄位（不應該更新）
    delete updateData.id;

    await db.collection(COLLECTION_NAME).doc(id).update(updateData);
    
    const updatedDoc = await db.collection(COLLECTION_NAME).doc(id).get();
    if (!updatedDoc.exists) return null;
    const user = docToUser(updatedDoc);
    cacheUser(user);
    return user;
  } catch (error) {
    console.error("Error updating user:", error);
    return null;
  }
}

