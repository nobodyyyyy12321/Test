import { getFirestoreDB } from "./firebase-admin";
import { v4 as uuidv4 } from "uuid";

export type ListQuestion = {
  questionId: string;
  collectionId: string;
  title: string;
  number: number;
  level?: number | null;
};

export type SharedResult = {
  answered: number;
  correct: number;
  timestamp: string;
};

export type QuestionList = {
  id: string;
  title: string;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  questions: ListQuestion[];
  sharedWith?: string[];   // array of usernames
  sharedResults?: Record<string, SharedResult[]>; // userName → last 3 results
  ownerName?: string;      // display-only, resolved at API layer
};

const COL = "lists";

function docToList(doc: any): QuestionList {
  const d = doc.data();
  return {
    id: doc.id,
    title: d.title ?? "",
    ownerId: d.ownerId ?? "",
    isPublic: d.isPublic ?? false,
    createdAt: d.createdAt ?? "",
    questions: d.questions ?? [],
    sharedWith: d.sharedWith ?? [],
    sharedResults: d.sharedResults ?? {},
  };
}

export async function getListsByOwner(ownerId: string): Promise<QuestionList[]> {
  const db = getFirestoreDB();
  const snap = await db.collection(COL).where("ownerId", "==", ownerId).get();
  return snap.docs.map(docToList).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPublicListsByOwner(ownerId: string): Promise<QuestionList[]> {
  const db = getFirestoreDB();
  const snap = await db.collection(COL)
    .where("ownerId", "==", ownerId)
    .where("isPublic", "==", true)
    .get();
  return snap.docs.map(docToList).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getListById(id: string): Promise<QuestionList | undefined> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(id).get();
  if (!doc.exists) return undefined;
  return docToList(doc);
}

export async function createList(ownerId: string, title: string): Promise<QuestionList> {
  const db = getFirestoreDB();
  const id = uuidv4();
  const list: Omit<QuestionList, "id"> = {
    title,
    ownerId,
    isPublic: false,
    createdAt: new Date().toISOString(),
    questions: [],
  };
  await db.collection(COL).doc(id).set(list);
  return { id, ...list };
}

export async function updateList(id: string, updates: Partial<Pick<QuestionList, "title" | "isPublic">>): Promise<void> {
  const db = getFirestoreDB();
  await db.collection(COL).doc(id).update(updates as any);
}

export async function deleteList(id: string): Promise<void> {
  const db = getFirestoreDB();
  await db.collection(COL).doc(id).delete();
}

export async function addQuestionToList(listId: string, question: ListQuestion): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const questions: ListQuestion[] = doc.data()?.questions ?? [];
  if (questions.some(q => q.questionId === question.questionId && q.collectionId === question.collectionId)) return;
  await db.collection(COL).doc(listId).update({ questions: [...questions, question] });
}

export async function addQuestionsToList(listId: string, incoming: ListQuestion[]): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const existing: ListQuestion[] = doc.data()?.questions ?? [];
  const toAdd = incoming.filter(
    q => !existing.some(e => e.questionId === q.questionId && e.collectionId === q.collectionId)
  );
  if (toAdd.length === 0) return;
  await db.collection(COL).doc(listId).update({ questions: [...existing, ...toAdd] });
}

export async function getListsSharedWithUser(userName: string): Promise<QuestionList[]> {
  const db = getFirestoreDB();
  const snap = await db.collection(COL).where("sharedWith", "array-contains", userName).get();
  return snap.docs.map(docToList).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function copyList(sourceListId: string, newOwnerId: string): Promise<QuestionList> {
  const db = getFirestoreDB();
  const source = await db.collection(COL).doc(sourceListId).get();
  if (!source.exists) throw new Error("List not found");
  const d = source.data()!;
  const id = uuidv4();
  const list: Omit<QuestionList, "id" | "ownerName"> = {
    title: d.title ?? "",
    ownerId: newOwnerId,
    isPublic: false,
    createdAt: new Date().toISOString(),
    questions: d.questions ?? [],
    sharedWith: [],
  };
  await db.collection(COL).doc(id).set(list);
  return { id, ...list };
}

export async function addSharedResult(
  listId: string,
  userName: string,
  result: SharedResult
): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const current: Record<string, SharedResult[]> = doc.data()?.sharedResults ?? {};
  const prev = current[userName] ?? [];
  const updated = [...prev, result].slice(-3); // keep last 3
  await db.collection(COL).doc(listId).update({
    [`sharedResults.${userName}`]: updated,
  });
}

export async function shareListWithUser(listId: string, userName: string): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const current: string[] = doc.data()?.sharedWith ?? [];
  if (current.includes(userName)) return;
  await db.collection(COL).doc(listId).update({ sharedWith: [...current, userName] });
}

export async function unshareListWithUser(listId: string, userName: string): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const current: string[] = doc.data()?.sharedWith ?? [];
  await db.collection(COL).doc(listId).update({ sharedWith: current.filter(n => n !== userName) });
}

export async function removeQuestionFromList(listId: string, questionId: string, collectionId: string): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const questions: ListQuestion[] = doc.data()?.questions ?? [];
  await db.collection(COL).doc(listId).update({
    questions: questions.filter(q => !(q.questionId === questionId && q.collectionId === collectionId)),
  });
}
