import { cookies } from "next/headers";
import AssignmentTestClient from "./AssignmentTestClient";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AssignmentTestPage({ params }: Props) {
  const { id } = await params;
  const cookieStore = await cookies();
  const serverLang = cookieStore.get("siteLanguage")?.value ?? "zh-TW";

  return <AssignmentTestClient assignmentId={id} serverLang={serverLang} />;
}
