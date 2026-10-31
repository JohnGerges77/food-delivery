import { Badge } from "@/components/common/Badge";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/formatters";
import type { Product } from "@/types";
import { useLocale, useTranslations } from "next-intl";

export function ProductCard({ product }: { product: Product }) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-950">{product.name}</h3>
          <p className="mt-1 text-sm text-zinc-600">{product.description}</p>
        </div>
        {product.isFeatured ? <Badge>{t("common.featured")}</Badge> : null}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-medium">{formatCurrency(product.price, locale)}</span>
        <Link className="text-zinc-700 underline" href={`/menu/${product.id}`}>
          {t("components.details")}
        </Link>
      </div>
    </article>
  );
}
