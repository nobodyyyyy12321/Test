import { redirect } from "next/navigation";
import { auth } from "@/auth";
import MyUploadClient from "./MyUploadClient";

export default async function MyUploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");
  return <MyUploadClient />;
}
