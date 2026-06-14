import { EmptyState } from "@/components/common/EmptyState";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { useTranslations } from "next-intl";

export function CartEmptyState() {
  const t = useTranslations("components");

  return (
    <EmptyState
      title={t("emptyCartTitle")}
      description={t("emptyCartDescription")}
      action={<Link href={routes.menu}>{t("browseMenu")}</Link>}
    />
  );
}
