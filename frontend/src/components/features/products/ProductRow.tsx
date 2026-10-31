import { ProductActions } from "@/components/features/products/ProductActions";
import { formatCurrency } from "@/lib/formatters";
import type { Product } from "@/types";
import { useLocale } from "next-intl";

export function ProductRow({ product }: { product: Product }) {
  const locale = useLocale();

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white p-4">
      <div>
        <p className="font-medium text-zinc-950">{product.name}</p>
        <p className="text-sm text-zinc-600">{formatCurrency(product.price, locale)}</p>
      </div>
      <ProductActions product={product} />
    </div>
  );
}
