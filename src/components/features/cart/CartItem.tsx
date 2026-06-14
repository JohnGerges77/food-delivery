import { formatCurrency } from "@/lib/formatters";
import type { CartItem as CartItemType } from "@/types";
import { useLocale, useTranslations } from "next-intl";

export function CartItem({ item }: { item: CartItemType }) {
  const t = useTranslations("components");
  const locale = useLocale();

  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-4">
      <div>
        <h3 className="font-medium text-zinc-950">{item.name}</h3>
        <p className="text-sm text-zinc-600">{t("quantity", { quantity: item.quantity })}</p>
      </div>
      <span className="text-sm font-medium">
        {formatCurrency(item.price * item.quantity, locale)}
      </span>
    </div>
  );
}
