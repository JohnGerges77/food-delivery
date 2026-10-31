export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
      <p className="max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
    </header>
  );
}
