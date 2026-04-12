import { getFirestoreDB } from "./firebase-admin";
import { v4 as uuidv4 } from "uuid";

export type ListQuestion = {
  questionId: string;
  collectionId: string;
  title: string;
  number: number;
  level?: number | null;
};

export type QuestionList = {
  id: string;
  title: string;
  ownerId: string;
  isPublic: boolean;
  createdAt: string;
  questions: ListQuestion[];
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

export async function removeQuestionFromList(listId: string, questionId: string, collectionId: string): Promise<void> {
  const db = getFirestoreDB();
  const doc = await db.collection(COL).doc(listId).get();
  if (!doc.exists) throw new Error("List not found");
  const questions: ListQuestion[] = doc.data()?.questions ?? [];
  await db.collection(COL).doc(listId).update({
    questions: questions.filter(q => !(q.questionId === questionId && q.collectionId === collectionId)),
  });
}
