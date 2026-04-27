export default function TestLoading() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-transparent dark:bg-black">
      <div className="w-full max-w-2xl px-6 pt-10 pb-36 sm:pb-10 animate-pulse">
        {/* title skeleton */}
        <div className="h-7 w-48 rounded-lg mb-8" style={{ backgroundColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }} />

        {/* question cards */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mb-4 rounded-2xl border p-5 flex flex-col gap-3" style={{ borderColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }}>
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--zen-ink) 10%, transparent)" }} />
            <div className="h-4 w-1/2 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--zen-ink) 8%, transparent)" }} />
            <div className="flex gap-2 mt-1">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-8 flex-1 rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--zen-ink) 8%, transparent)" }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
