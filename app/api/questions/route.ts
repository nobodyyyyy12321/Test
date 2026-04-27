import { fetchQuestions } from "@/lib/questions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const questions = await fetchQuestions({
      id: searchParams.get("id") ?? "englishWords",
      levels: searchParams.get("levels"),
      listId: searchParams.get("listId"),
    });
    return Response.json({ questions }, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
