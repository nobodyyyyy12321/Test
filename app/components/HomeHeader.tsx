// src/app/components/HomeHeader.tsx
interface HomeHeaderProps {
  title: string;
  isSimplified: boolean;
  query: string;
  setQuery: (val: string) => void;
  language: string;
}

export function HomeHeader({ title, isSimplified, query, setQuery, language }: HomeHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center w-full">
      <h1 className={`text-4xl font-bold ${isSimplified ? "zen-title-sc" : "zen-title"}`}>
        {title}
      </h1>
      <p className="text-lg zen-subtle">sapiens.camp</p>
      <input
        className="w-full max-w-sm mx-auto p-3 rounded-full border border-zinc-200 text-sm mt-4 dark:bg-zinc-900"
        placeholder={language === "en" ? "Search subjects" : "搜尋科目"}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  );
}