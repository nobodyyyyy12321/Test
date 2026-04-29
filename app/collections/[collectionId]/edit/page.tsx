import { notFound, redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../lib/users";
import {
  userOwnsCollection,
  getUserCollectionDisplayName,
} from "../../../../lib/user-collections-supabase";
import { fetchAllQuizQuestionsFresh } from "../../../../lib/questions-supabase";
import CollectionEditClient from "./CollectionEditClient";

type Props = { params: Promise<{ collectionId: string }> };

export const dynamic = "force-dynamic";

export default async function CollectionEditPage({ params }: Props) {
  const { collectionId: raw } = await params;
  const collectionId = decodeURIComponent(raw);

  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  const email = (session.user as { email?: string }).email;
  const name = (session.user as { name?: string }).name;
  const user = email
    ? await findUserByEmail(email).catch(() => null)
    : name
      ? await findUserByName(name).catch(() => null)
      : null;
  if (!user) redirect("/auth/login");

  const owns = await userOwnsCollection(user.id, collectionId);
  if (!owns) notFound();

  const [displayName, questions] = await Promise.all([
    getUserCollectionDisplayName(user.id, collectionId).catch(() => null),
    fetchAllQuizQuestionsFresh(collectionId).catch(() => []),
  ]);

  return (
    <CollectionEditClient
      collectionId={collectionId}
      displayName={displayName ?? collectionId}
      initialQuestions={questions}
    />
  );
}
