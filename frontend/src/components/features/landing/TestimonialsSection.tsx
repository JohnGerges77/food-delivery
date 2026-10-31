import { EmptyState } from "@/components/common/EmptyState";
import { useTranslations } from "next-intl";

export function TestimonialsSection() {
  const t = useTranslations("components");

  return (
    <EmptyState
      title={t("testimonialsSection")}
      description={t("testimonialsDescription")}
    />
  );
}
