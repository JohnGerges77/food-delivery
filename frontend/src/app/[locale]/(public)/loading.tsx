export default function Loading() {
  return <main className="min-h-screen bg-[color:var(--background)] px-4 py-20 text-[color:var(--text)]" aria-label="Loading storefront">
    <div className="mx-auto max-w-7xl animate-pulse space-y-8">
      <div className="h-12 w-64 rounded-xl bg-white/[.08]" />
      <div className="h-6 w-96 max-w-full rounded-xl bg-white/[.05]" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((n) => <div className="h-80 rounded-[1.5rem] bg-white/[.06]" key={n} />)}</div>
    </div>
  </main>;
}
