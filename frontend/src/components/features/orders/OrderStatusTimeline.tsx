import { ORDER_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@/types";
import { useTranslations } from "next-intl";

export function OrderStatusTimeline({ status }: { status: OrderStatus }) {
  const t = useTranslations("statuses");

  return (
    <ol className="grid gap-2 text-sm text-zinc-600">
      {ORDER_STATUSES.map((orderStatus) => (
        <li className={orderStatus === status ? "font-semibold text-zinc-950" : ""} key={orderStatus}>
          {t(orderStatus)}
        </li>
      ))}
    </ol>
  );
}
