import { auth } from "@/auth";
import { getFirestoreDB } from "@/lib/firebase-admin";

type QuoteRecord = {
  answered: number;
  correct: number;
  set: string;
  timestamp: string;
  category: "金句";
};

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { answered, correct, set, answers } = body;

    if (typeof answered !== "number" || typeof correct !== "number" || typeof set !== "string") {
      return Response.json(
        { error: "Invalid data" },
        { status: 400 }
      );
    }

    const userEmail = session.user.email;
    const record: QuoteRecord & { answers?: unknown[] } = {
      answered,
      correct,
      set,
      timestamp: new Date().toISOString(),
      category: "金句",
    };
    if (Array.isArray(answers)) record.answers = answers;

    // Save to Firestore
    const db = getFirestoreDB();
    const userSnapshot = await db
      .collection("users")
      .where("email", "==", userEmail.toLowerCase())
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return Response.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userRef = userSnapshot.docs[0].ref;
    const userDoc = await userRef.get();

    const d = userDoc.data() ?? {};
    const existing = d.records ?? [...(d.englishRecords ?? []), ...(d.quoteRecords ?? [])];
    const trimmed = [...existing, record].slice(-10);

    await userRef.update({ records: trimmed });

    return Response.json({
      success: true,
      record,
    });
  } catch (error) {
    console.error("Error saving quote record:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
