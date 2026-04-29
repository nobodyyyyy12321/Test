import { notFound, redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { findUserByEmail, findUserByName } from "../../../../lib/users";
import { getListById } from "../../../../lib/lists-supabase";
import ListEditClient from "./ListEditClient";

type Props = { params: Promise<{ listId: string }> };

export const dynamic = "force-dynamic";

export default async function ListEditPage({ params }: Props) {
  const { listId } = await params;
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

  const list = await getListById(listId).catch(() => null);
  if (!list || list.ownerId !== user.id) notFound();

  return <ListEditClient list={list} />;
}
