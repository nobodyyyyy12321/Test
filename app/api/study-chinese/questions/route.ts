import { fetchQuizQuestions } from "@/lib/questions-supabase";

export async function GET() {
  try {
    const rows = await fetchQuizQuestions({ collectionId: "studyChineseQuestions", revalidate: 3600 });
    const questions = rows.map(row => ({
      id: String(row.number),
      number: row.number,
      title: row.title,
      type: row.type,
      options: row.options,
      answer: row.answer,
      level: row.level,
    }));
    return Response.json({ questions });
  } catch (error) {
    console.error("Error fetching study-chinese questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
