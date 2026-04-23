import { getCategoriesCached } from "@/lib/categories";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get("lang") ?? "zh-TW";
  const data = await getCategoriesCached(lang);
  return Response.json({ data });
}
