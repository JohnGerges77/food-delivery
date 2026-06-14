import { OrderStatusBadge } from "@/components/features/orders/OrderStatusBadge";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { Order } from "@/types";
import { useLocale, useTranslations } from "next-intl";

export function OrderTrackingCard({ order }: { order: Order }) {
  const t = useTranslations("components");
  const locale = useLocale();

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-zinc-950">{order.orderNumber}</h2>
          <p className="text-sm text-zinc-600">{formatDateTime(order.createdAt, locale)}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-4 text-sm text-zinc-600">
        {t("orderCustomerTotal", {
          customerName: order.customerName,
          total: formatCurrency(order.total, locale),
        })}
      </p>
    </article>
  );
}
