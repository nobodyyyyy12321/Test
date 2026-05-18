import { cookies } from "next/headers";
import AssignmentTestClient from "./AssignmentTestClient";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ review?: string }>;
};

export default async function AssignmentTestPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { review } = await searchParams;
  const cookieStore = await cookies();
  const serverLang = cookieStore.get("siteLanguage")?.value ?? "zh-TW";

  return <AssignmentTestClient assignmentId={id} serverLang={serverLang} review={review === "1"} />;
}
