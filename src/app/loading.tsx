export default function Loading() {
  return (
    <div className="container-page py-12" aria-live="polite">
      <div className="h-7 w-40 animate-pulse rounded bg-[#dfe7df]" />
      <div className="mt-4 h-14 max-w-xl animate-pulse rounded bg-[#dfe7df]" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="aspect-[4/3] animate-pulse rounded-3xl bg-[#e8efe8]"
          />
        ))}
      </div>
    </div>
  );
}
