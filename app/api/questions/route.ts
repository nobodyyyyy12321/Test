import { getFirestoreDB } from "@/lib/firebase-admin";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // 新增 id 參數，預設 englishQuestions
    const id = searchParams.get("id") || "englishQuestions";

    const db = getFirestoreDB();
    const snapshot = await db.collection(id).orderBy("number").get();

    const questions = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Convert options object to array format
      const optionsArray = data.options && typeof data.options === 'object'
        ? Object.entries(data.options).map(([label, text]) => ({
            label,
            text: text as string
          }))
        : [];

      return {
        id: doc.id,
        number: data.number,
        title: data.title,
        options: optionsArray,
        answer: data.answer,
      };
    });

    return Response.json({ questions });
  } catch (error) {
    console.error("Error fetching questions:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
