import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Upload2Client from "./Upload2Client";

export default async function Upload2Page() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  return <Upload2Client />;
}
