import { formatCurrency } from "@/lib/formatters";
import { useLocale, useTranslations } from "next-intl";

export function CartSummary({
  subtotal,
  deliveryFee,
  total,
}: {
  subtotal: number;
  deliveryFee: number;
  total: number;
}) {
  const t = useTranslations("components");
  const locale = useLocale();

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-4 text-sm">
      <div className="flex justify-between">
        <span>{t("subtotal")}</span>
        <span>{formatCurrency(subtotal, locale)}</span>
      </div>
      <div className="mt-2 flex justify-between">
        <span>{t("delivery")}</span>
        <span>{formatCurrency(deliveryFee, locale)}</span>
      </div>
      <div className="mt-3 flex justify-between border-t border-zinc-200 pt-3 font-semibold">
        <span>{t("total")}</span>
        <span>{formatCurrency(total, locale)}</span>
      </div>
    </div>
  );
}
