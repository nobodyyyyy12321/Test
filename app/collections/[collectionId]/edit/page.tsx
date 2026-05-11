import { notFound, redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../lib/users";
import { getUserCollectionRef } from "../../../../lib/user-collections-supabase";
import { fetchPersonalQuizQuestionsFresh } from "../../../../lib/questions-supabase";
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

  const ref = await getUserCollectionRef(user.id, collectionId).catch(() => null);
  // hide page for: not-owned, or grid-added (read-only references to system collections)
  if (!ref || ref.fromGrid) notFound();

  const questions = await fetchPersonalQuizQuestionsFresh(user.id, collectionId, ref.language).catch(() => []);

  return (
    <CollectionEditClient
      collectionId={collectionId}
      displayName={ref.displayName}
      initialIsPublic={ref.isPublic}
      initialQuestions={questions}
    />
  );
}
