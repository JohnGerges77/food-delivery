import { EmptyState } from "@/components/common/EmptyState";
import { useTranslations } from "next-intl";

export function OrderSummary() {
  const t = useTranslations("components");

  return (
    <EmptyState
      title={t("orderSummary")}
      description={t("orderSummaryDescription")}
    />
  );
}
