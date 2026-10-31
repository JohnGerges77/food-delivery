export function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <h2 className="text-2xl font-semibold text-zinc-950">{title}</h2>
      {description ? <p className="text-sm text-zinc-600">{description}</p> : null}
    </div>
  );
}
