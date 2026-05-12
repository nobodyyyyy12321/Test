import { auth } from "@/auth";
import { findUserByEmail, findUserByName } from "@/lib/users";
import { fetchQuestions } from "@/lib/questions";

async function getViewerId(): Promise<string | null> {
  try {
    const session = await auth();
    const email = (session?.user as { email?: string } | undefined)?.email;
    const name = session?.user?.name ?? undefined;
    if (!email && !name) return null;
    const user = email ? await findUserByEmail(email) : await findUserByName(name!);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const viewerId = await getViewerId();
    const questions = await fetchQuestions({
      id: searchParams.get("id") ?? "englishWords",
      levels: searchParams.get("levels"),
      listId: searchParams.get("listId"),
      language: searchParams.get("lang") ?? searchParams.get("language"),
      viewerId,
    });
    // Personalized when a viewer is logged in — don't share via shared cache.
    const cacheControl = viewerId
      ? "private, no-store"
      : "public, s-maxage=3600, stale-while-revalidate=86400";
    return Response.json({ questions }, {
      headers: { "Cache-Control": cacheControl },
    });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
