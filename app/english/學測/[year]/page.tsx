import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = {
  params: {
    year: string;
  };
};

export default function EnglishXueCeYearPage({ params }: PageProps) {
  const year = Number(params.year);

  if (!Number.isInteger(year) || year < 83 || year > 115) {
    notFound();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-start py-20 px-16 bg-transparent dark:bg-black text-center">
        <h1 className="max-w-xs text-4xl font-bold zen-title">英文學測 {year}</h1>

        <div className="mt-8 w-full max-w-3xl">
          <div className="bookshelf-scroll">
            <div className="bookshelf-grid">
              <Link href="/under-construction" className="book-link">
                題目
              </Link>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
