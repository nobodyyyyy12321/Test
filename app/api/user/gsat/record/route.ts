import { auth } from "@/auth";
import { getFirestoreDB } from "@/lib/firebase-admin";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { answered, correct, set } = body;

    if (typeof answered !== "number" || typeof correct !== "number" || typeof set !== "string") {
      return Response.json({ error: "Invalid data" }, { status: 400 });
    }

    const db = getFirestoreDB();
    const userSnapshot = await db
      .collection("users")
      .where("email", "==", session.user.email.toLowerCase())
      .limit(1)
      .get();

    if (userSnapshot.empty) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const record = {
      answered,
      correct,
      set,
      timestamp: new Date().toISOString(),
      category: "國文學測",
    };

    const userRef = userSnapshot.docs[0].ref;
    const userDoc = await userRef.get();
    const userData = userDoc.data() ?? {};
    const existing = userData.gsatRecords ?? [];
    const trimmed = [...existing, record].slice(-20);

    await userRef.update({ gsatRecords: trimmed });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Error saving gsat record:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
