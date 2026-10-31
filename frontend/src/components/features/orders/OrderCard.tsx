import { OrderStatusBadge } from "@/components/features/orders/OrderStatusBadge";
import { formatCurrency } from "@/lib/formatters";
import type { Order } from "@/types";
import { useLocale } from "next-intl";

export function OrderCard({ order }: { order: Order }) {
  const locale = useLocale();

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-zinc-950">{order.orderNumber}</h3>
          <p className="text-sm text-zinc-600">{order.customerName}</p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="mt-3 text-sm font-medium">{formatCurrency(order.total, locale)}</p>
    </article>
  );
}
