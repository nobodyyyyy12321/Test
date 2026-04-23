import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UploadClient from "./UploadClient";

export default async function AdminUploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  return <UploadClient />;
}
