import { productMetadata } from "@/lib/product-metadata";

export function ProductMetadata({ product, locale, compact = false }: {
  product: { calories?: number | null; preparationTime?: number | null };
  locale: string;
  compact?: boolean;
}) {
  const entries = productMetadata(product, locale);
  if (!entries.length) return null;
  return <dl className={compact
    ? "mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs leading-5 text-[color:var(--sf-text-muted)] sm:mt-2"
    : "mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm leading-6 text-[color:var(--sf-text-muted)]"}>
    {entries.map(({ label, value }) => <div key={label} className="flex min-w-0 flex-wrap gap-x-1">
      <dt>{label}:</dt><dd dir="auto">{value}</dd>
    </div>)}
  </dl>;
}
