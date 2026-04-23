import { getCategoriesCached } from "@/lib/categories";
import { HomeContent } from "./components/HomeContent";

export default async function Home() {
  const initialCategories = await getCategoriesCached("zh-TW");
  return <HomeContent initialCategories={initialCategories} />;
}
