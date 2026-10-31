import { Badge } from "@/components/common/Badge";
import type { OrderStatus } from "@/types";
import { useTranslations } from "next-intl";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const t = useTranslations("statuses");

  return <Badge>{t(status)}</Badge>;
}
