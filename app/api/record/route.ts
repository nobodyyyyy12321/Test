import { auth } from "@/auth";
import { appendPractice } from "@/lib/users";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { answered, correct, set, answers } = body;

    if (typeof answered !== "number" || typeof correct !== "number" || typeof set !== "string") {
      return Response.json({ error: "Invalid data" }, { status: 400 });
    }

    await appendPractice(session.user.email, {
      answered,
      correct,
      set,
      answers: Array.isArray(answers) ? answers : undefined,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error saving record:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
