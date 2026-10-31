import { Badge } from "@/components/common/Badge";
import { formatCurrency } from "@/lib/formatters";
import type { Product } from "@/types";
import { useLocale, useTranslations } from "next-intl";

export function ProductDetails({ product }: { product: Product }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950">{product.name}</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">{product.description}</p>
        </div>
        <Badge>{product.isAvailable ? t("common.available") : t("common.unavailable")}</Badge>
      </div>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-zinc-500">{t("components.price")}</dt>
          <dd className="font-medium">{formatCurrency(product.price, locale)}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("components.preparation")}</dt>
          <dd className="font-medium">
            {t("components.minutes", { count: product.preparationTime })}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">{t("components.rating")}</dt>
          <dd className="font-medium">{product.rating}</dd>
        </div>
      </dl>
    </article>
  );
}
