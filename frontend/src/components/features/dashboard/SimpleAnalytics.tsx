import type { TopProduct } from "@/types";
import { useTranslations } from "next-intl";

export function SimpleAnalytics({ products }: { products: TopProduct[] }) {
  const t = useTranslations("components");

  return (
    <div className="grid gap-3">
      {products.map((product) => (
        <div className="rounded-md border border-zinc-200 bg-white p-4" key={product.productId}>
          <p className="font-medium text-zinc-950">{product.name}</p>
          <p className="text-sm text-zinc-600">
            {t("ordersCount", { count: product.ordersCount })}
          </p>
        </div>
      ))}
    </div>
  );
}
