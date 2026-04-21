import { getFirestoreDB } from "./firebase-admin";

export type Follow = {
  id: string;
  followerId: string;
  followerName: string;
  followerAvatarUrl?: string;
  followingId: string;
  followingName: string;
  followingAvatarUrl?: string;
  createdAt: string;
};

const COLLECTION = "follows";

export async function getFollowers(userId: string): Promise<Follow[]> {
  try {
    const db = getFirestoreDB();
    const snap = await db.collection(COLLECTION).where("followingId", "==", userId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Follow));
  } catch {
    return [];
  }
}

export async function getFollowing(userId: string): Promise<Follow[]> {
  try {
    const db = getFirestoreDB();
    const snap = await db.collection(COLLECTION).where("followerId", "==", userId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Follow));
  } catch {
    return [];
  }
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  try {
    const db = getFirestoreDB();
    const snap = await db.collection(COLLECTION)
      .where("followerId", "==", followerId)
      .where("followingId", "==", followingId)
      .limit(1)
      .get();
    return !snap.empty;
  } catch {
    return false;
  }
}

export async function followUser(follow: Omit<Follow, "id">): Promise<string> {
  const db = getFirestoreDB();
  const ref = await db.collection(COLLECTION).add(follow);
  return ref.id;
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const db = getFirestoreDB();
  const snap = await db.collection(COLLECTION)
    .where("followerId", "==", followerId)
    .where("followingId", "==", followingId)
    .limit(1)
    .get();
  await Promise.all(snap.docs.map(d => d.ref.delete()));
}

export async function getFollowerCount(userId: string): Promise<number> {
  try {
    const db = getFirestoreDB();
    const snap = await db.collection(COLLECTION).where("followingId", "==", userId).get();
    return snap.size;
  } catch {
    return 0;
  }
}

export async function getFollowingCount(userId: string): Promise<number> {
  try {
    const db = getFirestoreDB();
    const snap = await db.collection(COLLECTION).where("followerId", "==", userId).get();
    return snap.size;
  } catch {
    return 0;
  }
}
